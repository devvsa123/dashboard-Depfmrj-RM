-- =====================================================================
-- Programação Semanal do DepFMRJ — estrutura do banco
--
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em RUN.
-- Pode rodar mais de uma vez sem problema: tudo é "if not exists".
--
-- Quem pode o quê: qualquer usuário autenticado lê e escreve tudo. Os
-- três programadores se revezam no mesmo trabalho, então não há papel
-- diferente entre eles. Quem NÃO está logado não enxerga nada — é isso
-- que protege os dados, e não o segredo da chave do site (que é pública
-- por desenho).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Versões publicadas da programação. Uma linha por (semana, versão):
-- versão 0 é a Original, 1 em diante são as Alterações. O snapshot
-- guarda a fotografia da grade como foi publicada.
-- ---------------------------------------------------------------------
create table if not exists public.programacoes (
  id                  uuid primary key default gen_random_uuid(),
  semana              date not null,
  versao              integer not null,
  publicada_em        timestamptz not null default now(),
  publicada_por       uuid references auth.users (id) on delete set null,
  publicada_por_nome  text not null default '',
  snapshot            jsonb not null,
  unique (semana, versao)
);
create index if not exists programacoes_semana_idx on public.programacoes (semana);

-- ---------------------------------------------------------------------
-- Demandas registradas (mensagens, gerência, informais) com as RMs
-- coladas pelo programador.
-- ---------------------------------------------------------------------
create table if not exists public.demandas (
  id               text primary key,
  origem           text not null,
  referencia       text not null default '',
  prazo            date,
  dias_expedicao   integer not null default 3,
  rms              text[] not null default '{}',
  criada_em        timestamptz not null default now(),
  criada_por_nome  text not null default ''
);

-- ---------------------------------------------------------------------
-- Dias sem separação, com o motivo que vai impresso no documento.
-- ---------------------------------------------------------------------
create table if not exists public.bloqueios (
  data       date primary key,
  motivo     text not null,
  criado_em  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Capacidade ajustada na mão para um dia específico. O que não estiver
-- aqui usa o valor medido no histórico.
-- ---------------------------------------------------------------------
create table if not exists public.capacidade_overrides (
  data  date primary key,
  rms   integer not null check (rms >= 0)
);

-- ---------------------------------------------------------------------
-- Preferências compartilhadas (janela de medição, nome do Encarregado).
-- ---------------------------------------------------------------------
create table if not exists public.config (
  chave  text primary key,
  valor  jsonb not null
);

-- =====================================================================
-- Controle de acesso
-- =====================================================================
alter table public.programacoes          enable row level security;
alter table public.demandas              enable row level security;
alter table public.bloqueios             enable row level security;
alter table public.capacidade_overrides  enable row level security;
alter table public.config                enable row level security;

do $$
declare t text;
begin
  foreach t in array array['programacoes','demandas','bloqueios','capacidade_overrides','config'] loop
    execute format('drop policy if exists "programadores_autenticados" on public.%I', t);
    execute format(
      'create policy "programadores_autenticados" on public.%I
         for all to authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

grant usage on schema public to authenticated;

-- =====================================================================
-- Conferência: deve listar as 5 tabelas, todas com RLS ligada.
-- =====================================================================
select tablename, rowsecurity as rls_ligada
from pg_tables
where schemaname = 'public'
  and tablename in ('programacoes','demandas','bloqueios','capacidade_overrides','config')
order by tablename;
