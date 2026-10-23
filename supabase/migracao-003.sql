-- Migração 003: gravação atômica do dia ("tudo ou nada").
-- Rode UMA vez no SQL Editor do Supabase, ANTES de subir o novo resumo.py para o GitHub.
--
-- O resumo.py passa a mandar o dia inteiro numa única chamada (rpc/gravar_dia). Esta função apaga o que
-- havia do dia e grava de novo dentro de UMA transação: se qualquer parte falhar, o Postgres desfaz tudo
-- e o dia antigo continua intacto.
--
-- Segurança: só a chave secret (service_role) pode chamar. O navegador (anon/authenticated) não pode.

create or replace function public.gravar_dia(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo uuid := (p ->> 'grupo_id')::uuid;
  v_dia   uuid;
  d       jsonb := p -> 'dia';
begin
  insert into dias (
    grupo_id, data, n_mensagens, n_participantes, msgs_por_hora,
    clima_positivo, clima_neutro, clima_negativo,
    frase, visao_geral, nivel, tempo_resposta_min, conteudo, modelo_ia, gerado_em
  )
  values (
    v_grupo,
    (d ->> 'data')::date,
    coalesce((d ->> 'n_mensagens')::int, 0),
    coalesce((d ->> 'n_participantes')::int, 0),
    coalesce(array(select x::int from jsonb_array_elements_text(d -> 'msgs_por_hora') x), '{}'),
    coalesce((d ->> 'clima_positivo')::int, 0),
    coalesce((d ->> 'clima_neutro')::int, 0),
    coalesce((d ->> 'clima_negativo')::int, 0),
    d ->> 'frase',
    d ->> 'visao_geral',
    d ->> 'nivel',
    (d ->> 'tempo_resposta_min')::int,
    coalesce(d -> 'conteudo', '{}'::jsonb),
    d ->> 'modelo_ia',
    coalesce((d ->> 'gerado_em')::timestamptz, now())
  )
  on conflict (grupo_id, data) do update set
    n_mensagens        = excluded.n_mensagens,
    n_participantes    = excluded.n_participantes,
    msgs_por_hora      = excluded.msgs_por_hora,
    clima_positivo     = excluded.clima_positivo,
    clima_neutro       = excluded.clima_neutro,
    clima_negativo     = excluded.clima_negativo,
    frase              = excluded.frase,
    visao_geral        = excluded.visao_geral,
    nivel              = excluded.nivel,
    tempo_resposta_min = excluded.tempo_resposta_min,
    conteudo           = excluded.conteudo,
    modelo_ia          = excluded.modelo_ia,
    gerado_em          = excluded.gerado_em
  returning id into v_dia;

  -- Refazer o dia: apaga o que havia antes (tudo na mesma transação)
  delete from insights      where dia_id = v_dia;
  delete from qualidade_dia where dia_id = v_dia;
  delete from atividade_dia where dia_id = v_dia;
  delete from acoes         where dia_id = v_dia;

  -- Temas novos (os que já existem são mantidos)
  insert into temas (grupo_id, nome)
  select distinct v_grupo, i ->> 'tema'
  from jsonb_array_elements(coalesce(p -> 'insights', '[]'::jsonb)) i
  where coalesce(i ->> 'tema', '') <> ''
  on conflict (grupo_id, nome) do nothing;

  insert into insights (
    dia_id, tema_id, tipo, titulo, descricao, por_que, qtd_alunos, qtd_mencoes,
    intensidade, status, respondida_por, resposta_resumo, sugestao
  )
  select
    v_dia, t.id,
    i ->> 'tipo', i ->> 'titulo', i ->> 'descricao', i ->> 'por_que',
    coalesce((i ->> 'qtd_alunos')::int, 1),
    coalesce((i ->> 'qtd_mencoes')::int, 1),
    (i ->> 'intensidade')::smallint,
    i ->> 'status', i ->> 'respondida_por', i ->> 'resposta_resumo', i ->> 'sugestao'
  from jsonb_array_elements(coalesce(p -> 'insights', '[]'::jsonb)) i
  left join temas t on t.grupo_id = v_grupo and t.nome = i ->> 'tema';

  insert into qualidade_dia (dia_id, dimensao, positivas, neutras, negativas, nota)
  select
    v_dia, q ->> 'dimensao',
    coalesce((q ->> 'positivas')::int, 0),
    coalesce((q ->> 'neutras')::int, 0),
    coalesce((q ->> 'negativas')::int, 0),
    (q ->> 'nota')::numeric
  from jsonb_array_elements(coalesce(p -> 'qualidade', '[]'::jsonb)) q;

  -- Pessoas (cria as novas e atualiza nome/equipe das que já existem)
  insert into participantes (grupo_id, telegram_id, nome, eh_equipe)
  select v_grupo, (x ->> 'telegram_id')::bigint, x ->> 'nome', coalesce((x ->> 'eh_equipe')::boolean, false)
  from jsonb_array_elements(coalesce(p -> 'pessoas', '[]'::jsonb)) x
  on conflict (grupo_id, telegram_id) do update set
    nome = excluded.nome,
    eh_equipe = excluded.eh_equipe;

  insert into atividade_dia (dia_id, participante_id, mensagens, respostas_uteis, duvidas)
  select
    v_dia, pa.id,
    coalesce((x ->> 'mensagens')::int, 0),
    coalesce((x ->> 'respostas_uteis')::int, 0),
    coalesce((x ->> 'duvidas')::int, 0)
  from jsonb_array_elements(coalesce(p -> 'pessoas', '[]'::jsonb)) x
  join participantes pa
    on pa.grupo_id = v_grupo and pa.telegram_id = (x ->> 'telegram_id')::bigint;

  insert into acoes (dia_id, texto)
  select v_dia, a #>> '{}'
  from jsonb_array_elements(coalesce(p -> 'acoes', '[]'::jsonb)) a
  where coalesce(a #>> '{}', '') <> '';

  return v_dia;
end;
$$;

-- Só a chave secret (service_role) pode chamar
revoke all on function public.gravar_dia(jsonb) from public, anon, authenticated;
grant execute on function public.gravar_dia(jsonb) to service_role;
