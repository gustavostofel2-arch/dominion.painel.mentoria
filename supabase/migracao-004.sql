-- Migração 004: perguntas e respostas literais, alertas de alunos insatisfeitos e limpeza de temas.
-- Rode UMA vez no SQL Editor do Supabase, ANTES de subir o novo resumo.py para o GitHub.
--
-- ATENÇÃO (privacidade): a partir daqui o banco guarda o TEXTO das perguntas dos alunos e das respostas que receberam
-- (e uma citação curta de quem reclama), com o nome de quem escreveu. Continua protegido pelo login do
-- painel (só quem está em membros_painel lê), mas avise os alunos nos termos da mentoria (LGPD).

-- 1) Perguntas e respostas de verdade
alter table insights add column if not exists pergunta_texto text;
alter table insights add column if not exists pergunta_autor_id uuid references participantes (id) on delete set null;
alter table insights add column if not exists resposta_texto text;
alter table insights add column if not exists resposta_autor_id uuid references participantes (id) on delete set null;
alter table insights add column if not exists tempo_resposta_min int;

-- 2) Alunos que parecem insatisfeitos (nível 1 = leve, 2 = médio, 3 = alto)
create table if not exists alertas_alunos (
  id uuid primary key default gen_random_uuid(),
  dia_id uuid not null references dias (id) on delete cascade,
  participante_id uuid not null references participantes (id) on delete cascade,
  nivel smallint not null check (nivel between 1 and 3),
  motivo text not null,
  citacao text,
  criado_em timestamptz not null default now()
);
create index if not exists alertas_alunos_dia on alertas_alunos (dia_id);
create index if not exists alertas_alunos_participante on alertas_alunos (participante_id);

alter table alertas_alunos enable row level security;
drop policy if exists "membro le alertas" on alertas_alunos;
create policy "membro le alertas" on alertas_alunos for select to authenticated using (public.eh_membro());

-- 3) Gravação atômica do dia (versão 2: inclui perguntas/respostas, alertas e limpeza de temas sem uso)
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
  delete from insights       where dia_id = v_dia;
  delete from qualidade_dia  where dia_id = v_dia;
  delete from atividade_dia  where dia_id = v_dia;
  delete from alertas_alunos where dia_id = v_dia;
  delete from acoes          where dia_id = v_dia;

  -- Pessoas primeiro (perguntas, respostas e alertas apontam para elas)
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
