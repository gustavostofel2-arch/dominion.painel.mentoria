-- Migração 005: interações válidas dos alunos (base da competição) e ranking por período.
-- Rode UMA vez no SQL Editor do Supabase, ANTES de subir o novo resumo.py e o painel.
--
-- Uma "interação válida" é uma mensagem de ALUNO que a IA classificou como útil de verdade:
--   ajuda        = resposta que ajuda um colega
--   resolveu     = resposta que resolveu a dúvida de um colega
--   contribuicao = dica, resultado ou aprendizado útil ao grupo
--   duvida       = pergunta clara e específica
-- "kkk", "ok", "não sei" e conversa solta não entram. O texto da mensagem fica guardado como prova.

create table if not exists interacoes_validas (
  id uuid primary key default gen_random_uuid(),
  dia_id uuid not null references dias (id) on delete cascade,
  participante_id uuid not null references participantes (id) on delete cascade,
  tipo text not null check (tipo in ('ajuda', 'resolveu', 'contribuicao', 'duvida')),
  texto text,
  criado_em timestamptz not null default now()
);
create index if not exists interacoes_validas_dia on interacoes_validas (dia_id);
create index if not exists interacoes_validas_participante on interacoes_validas (participante_id);

alter table interacoes_validas enable row level security;
drop policy if exists "membro le interacoes" on interacoes_validas;
create policy "membro le interacoes" on interacoes_validas for select to authenticated using (public.eh_membro());

-- Ranking de qualquer período: soma no banco (o painel não precisa baixar milhares de linhas).
-- Roda com as regras de acesso de quem chama (só a equipe do painel enxerga).
create or replace function public.ranking_alunos(p_grupo uuid, p_desde date, p_ate date)
returns table (
  participante_id uuid,
  nome text,
  ajudas int,
  resolveu int,
  contribuicoes int,
  duvidas_validas int,
  dias_ativos int,
  mensagens int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    pa.id,
    pa.nome,
    coalesce(i.ajudas, 0)::int,
    coalesce(i.resolveu, 0)::int,
    coalesce(i.contribuicoes, 0)::int,
    coalesce(i.duvidas_validas, 0)::int,
    coalesce(a.dias_ativos, 0)::int,
    coalesce(a.mensagens, 0)::int
  from participantes pa
  left join (
    select
      iv.participante_id,
      count(*) filter (where iv.tipo = 'ajuda') as ajudas,
      count(*) filter (where iv.tipo = 'resolveu') as resolveu,
      count(*) filter (where iv.tipo = 'contribuicao') as contribuicoes,
      count(*) filter (where iv.tipo = 'duvida') as duvidas_validas
    from interacoes_validas iv
    join dias d on d.id = iv.dia_id
    where d.grupo_id = p_grupo and d.data between p_desde and p_ate
    group by iv.participante_id
  ) i on i.participante_id = pa.id
  left join (
    select
      ad.participante_id,
      count(*) filter (where ad.mensagens > 0) as dias_ativos,
      sum(ad.mensagens) as mensagens
    from atividade_dia ad
    join dias d on d.id = ad.dia_id
    where d.grupo_id = p_grupo and d.data between p_desde and p_ate
    group by ad.participante_id
  ) a on a.participante_id = pa.id
  where pa.grupo_id = p_grupo
    and not pa.eh_equipe
    and (i.participante_id is not null or a.participante_id is not null);
$$;

revoke all on function public.ranking_alunos(uuid, date, date) from public, anon;
grant execute on function public.ranking_alunos(uuid, date, date) to authenticated;

-- Gravação atômica do dia (versão 3: inclui as interações válidas)
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
  delete from insights          where dia_id = v_dia;
  delete from qualidade_dia     where dia_id = v_dia;
  delete from atividade_dia     where dia_id = v_dia;
  delete from alertas_alunos    where dia_id = v_dia;
  delete from interacoes_validas where dia_id = v_dia;
  delete from acoes             where dia_id = v_dia;

  -- Pessoas primeiro (perguntas, respostas, alertas e interações apontam para elas)
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

  insert into interacoes_validas (dia_id, participante_id, tipo, texto)
  select
    v_dia, pa.id, x ->> 'tipo', x ->> 'texto'
  from jsonb_array_elements(coalesce(p -> 'interacoes', '[]'::jsonb)) x
  join participantes pa
    on pa.grupo_id = v_grupo and pa.telegram_id = (x ->> 'telegram_id')::bigint
  where x ->> 'tipo' in ('ajuda', 'resolveu', 'contribuicao', 'duvida');

  -- Temas novos (os que já existem são mantidos)
  insert into temas (grupo_id, nome)
  select distinct v_grupo, i ->> 'tema'
  from jsonb_array_elements(coalesce(p -> 'insights', '[]'::jsonb)) i
  where coalesce(i ->> 'tema', '') <> ''
  on conflict (grupo_id, nome) do nothing;

  insert into insights (
    dia_id, tema_id, tipo, titulo, descricao, por_que, qtd_alunos, qtd_mencoes,
    intensidade, status, respondida_por, resposta_resumo, sugestao,
    pergunta_texto, pergunta_autor_id, resposta_texto, resposta_autor_id, tempo_resposta_min
  )
  select
    v_dia, t.id,
    i ->> 'tipo', i ->> 'titulo', i ->> 'descricao', i ->> 'por_que',
    coalesce((i ->> 'qtd_alunos')::int, 1),
    coalesce((i ->> 'qtd_mencoes')::int, 1),
    (i ->> 'intensidade')::smallint,
    i ->> 'status', i ->> 'respondida_por', i ->> 'resposta_resumo', i ->> 'sugestao',
    i ->> 'pergunta_texto', pq.id, i ->> 'resposta_texto', pr.id,
    (i ->> 'tempo_resposta_min')::int
  from jsonb_array_elements(coalesce(p -> 'insights', '[]'::jsonb)) i
  left join temas t on t.grupo_id = v_grupo and t.nome = i ->> 'tema'
  left join participantes pq on pq.grupo_id = v_grupo and pq.telegram_id = (i ->> 'pergunta_tid')::bigint
  left join participantes pr on pr.grupo_id = v_grupo and pr.telegram_id = (i ->> 'resposta_tid')::bigint;

  insert into qualidade_dia (dia_id, dimensao, positivas, neutras, negativas, nota)
  select
    v_dia, q ->> 'dimensao',
    coalesce((q ->> 'positivas')::int, 0),
    coalesce((q ->> 'neutras')::int, 0),
    coalesce((q ->> 'negativas')::int, 0),
    (q ->> 'nota')::numeric
  from jsonb_array_elements(coalesce(p -> 'qualidade', '[]'::jsonb)) q;

  insert into alertas_alunos (dia_id, participante_id, nivel, motivo, citacao)
  select
    v_dia, pa.id,
    greatest(1, least(3, coalesce((a ->> 'nivel')::int, 1))),
    coalesce(a ->> 'motivo', ''),
    a ->> 'citacao'
  from jsonb_array_elements(coalesce(p -> 'alertas', '[]'::jsonb)) a
  join participantes pa
    on pa.grupo_id = v_grupo and pa.telegram_id = (a ->> 'telegram_id')::bigint;

  insert into acoes (dia_id, texto)
  select v_dia, a #>> '{}'
  from jsonb_array_elements(coalesce(p -> 'acoes', '[]'::jsonb)) a
  where coalesce(a #>> '{}', '') <> '';

  -- Temas que ninguém usa mais (sobras de nomes repetidos) saem da lista
  delete from temas t
  where t.grupo_id = v_grupo
    and not exists (select 1 from insights i where i.tema_id = t.id);

  return v_dia;
end;
$$;

revoke all on function public.gravar_dia(jsonb) from public, anon, authenticated;
grant execute on function public.gravar_dia(jsonb) to service_role;
