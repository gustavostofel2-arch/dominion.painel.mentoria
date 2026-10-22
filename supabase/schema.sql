-- =====================================================================
-- Painel Chat Alunos: estrutura do banco (Supabase / Postgres)
-- Cole TUDO isto no SQL Editor do Supabase e clique em "Run".
-- Pode rodar de novo sem medo: usa "if not exists" onde possível.
--
-- Regras de privacidade deste desenho:
--  * NÃO guarda mensagens dos alunos, só o que a IA extraiu delas.
--  * Guarda contagens por aluno (mensagens, respostas úteis, dúvidas).
-- =====================================================================

-- Grupos (hoje só o "Chat Alunos"; no futuro, outros)
create table if not exists grupos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  referencia text,
  criado_em timestamptz not null default now()
);

-- Quem pode entrar no painel (equipe). O login em si fica no Supabase Auth.
create table if not exists membros_painel (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  papel text not null default 'equipe' check (papel in ('admin', 'equipe')),
  criado_em timestamptz not null default now()
);

-- Um registro por grupo por dia
create table if not exists dias (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos (id) on delete cascade,
  data date not null,
  n_mensagens int not null default 0,
  n_participantes int not null default 0,
  msgs_por_hora int[] not null default '{}',      -- 24 posições (0h a 23h)
  clima_positivo int not null default 0,          -- nº de mensagens por tom
  clima_neutro int not null default 0,
  clima_negativo int not null default 0,
  frase text,                                     -- "o dia em uma frase"
  visao_geral text,
  nivel text check (nivel in ('iniciante', 'intermediario', 'avancado')),
  tempo_resposta_min int,                         -- mediana do tempo até a 1ª resposta
  conteudo jsonb not null default '{}'::jsonb,    -- extras (assuntos, ideias...)
  modelo_ia text,
  gerado_em timestamptz not null default now(),
  unique (grupo_id, data)
);
create index if not exists dias_grupo_data on dias (grupo_id, data desc);

-- Temas reaproveitados entre os dias (para contar e comparar)
create table if not exists temas (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos (id) on delete cascade,
  nome text not null,
  criado_em timestamptz not null default now(),
  unique (grupo_id, nome)
);

-- Tudo o que a IA extraiu do dia: dores, dúvidas, desejos, elogios, críticas, dicas
create table if not exists insights (
  id uuid primary key default gen_random_uuid(),
  dia_id uuid not null references dias (id) on delete cascade,
  tema_id uuid references temas (id) on delete set null,
  tipo text not null check (tipo in ('dor', 'duvida', 'desejo', 'elogio', 'critica', 'dica')),
  titulo text not null,
  descricao text,                                 -- o que aconteceu
  por_que text,                                   -- por que aconteceu / por que importa
  qtd_alunos int not null default 1,
  qtd_mencoes int not null default 1,
  intensidade smallint check (intensidade between 1 and 3),
  status text check (status in ('resolvida', 'aberta', 'divergente')),   -- só para dúvidas
  respondida_por text check (respondida_por in ('equipe', 'colegas')),
  resposta_resumo text,
  sugestao text,
  criado_em timestamptz not null default now()
);
create index if not exists insights_dia on insights (dia_id);
create index if not exists insights_tema on insights (tema_id);

-- Notas de qualidade por dia. A nota é calculada em código a partir de
-- positivas / (positivas + negativas), não é opinião solta da IA.
create table if not exists qualidade_dia (
  dia_id uuid not null references dias (id) on delete cascade,
  dimensao text not null,
  positivas int not null default 0,
  neutras int not null default 0,
  negativas int not null default 0,
  nota numeric(3, 1),
  primary key (dia_id, dimensao)
);

-- Pessoas do grupo (alunos e equipe)
create table if not exists participantes (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos (id) on delete cascade,
  telegram_id bigint,
  nome text not null,
  eh_equipe boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (grupo_id, telegram_id)
);

-- Só contagens por pessoa por dia (nenhuma mensagem é guardada)
create table if not exists atividade_dia (
  dia_id uuid not null references dias (id) on delete cascade,
  participante_id uuid not null references participantes (id) on delete cascade,
  mensagens int not null default 0,
  respostas_uteis int not null default 0,
  duvidas int not null default 0,
  primary key (dia_id, participante_id)
);

-- Ações sugeridas para a equipe (podem ser marcadas como feitas)
create table if not exists acoes (
  id uuid primary key default gen_random_uuid(),
  dia_id uuid not null references dias (id) on delete cascade,
  texto text not null,
  feita boolean not null default false,
  feita_em timestamptz,
  criado_em timestamptz not null default now()
);

-- Relatórios semanais e mensais (escritos pela IA). "parcial" = período incompleto
create table if not exists relatorios (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos (id) on delete cascade,
  tipo text not null check (tipo in ('semanal', 'mensal')),
  inicio date not null,
  fim date not null,
  parcial boolean not null default false,
  dias_com_dados int not null default 0,
  frase text,
  texto text,
  conteudo jsonb not null default '{}'::jsonb,
  modelo_ia text,
  gerado_em timestamptz not null default now(),
  unique (grupo_id, tipo, inicio)
);

-- =====================================================================
-- Segurança (RLS): só quem está em membros_painel consegue LER os dados.
-- Quem grava é o programa do GitHub, usando a chave "secret" do Supabase,
-- que passa por cima destas regras. O navegador nunca recebe essa chave.
-- =====================================================================
create or replace function public.eh_membro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.membros_painel where user_id = auth.uid());
$$;

alter table grupos          enable row level security;
alter table membros_painel  enable row level security;
alter table dias            enable row level security;
alter table temas           enable row level security;
alter table insights        enable row level security;
alter table qualidade_dia   enable row level security;
alter table participantes   enable row level security;
alter table atividade_dia   enable row level security;
alter table acoes           enable row level security;
alter table relatorios      enable row level security;

drop policy if exists "membro le grupos" on grupos;
create policy "membro le grupos" on grupos for select to authenticated using (public.eh_membro());
drop policy if exists "membro le dias" on dias;
create policy "membro le dias" on dias for select to authenticated using (public.eh_membro());
drop policy if exists "membro le temas" on temas;
create policy "membro le temas" on temas for select to authenticated using (public.eh_membro());
drop policy if exists "membro le insights" on insights;
create policy "membro le insights" on insights for select to authenticated using (public.eh_membro());
drop policy if exists "membro le qualidade" on qualidade_dia;
create policy "membro le qualidade" on qualidade_dia for select to authenticated using (public.eh_membro());
drop policy if exists "membro le participantes" on participantes;
create policy "membro le participantes" on participantes for select to authenticated using (public.eh_membro());
drop policy if exists "membro le atividade" on atividade_dia;
create policy "membro le atividade" on atividade_dia for select to authenticated using (public.eh_membro());
drop policy if exists "membro le relatorios" on relatorios;
create policy "membro le relatorios" on relatorios for select to authenticated using (public.eh_membro());

-- Ações: a equipe lê e também marca como feita
drop policy if exists "membro le acoes" on acoes;
create policy "membro le acoes" on acoes for select to authenticated using (public.eh_membro());
drop policy if exists "membro atualiza acoes" on acoes;
create policy "membro atualiza acoes" on acoes for update to authenticated
  using (public.eh_membro()) with check (public.eh_membro());

-- Cada pessoa só enxerga a própria linha em membros_painel
drop policy if exists "ve o proprio acesso" on membros_painel;
create policy "ve o proprio acesso" on membros_painel for select to authenticated
  using (user_id = auth.uid());
