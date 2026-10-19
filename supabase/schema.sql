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

-- ---------------------------------------------------------------------
-- Cadastro de CAM e rotas. Define, para cada cliente, quem entrega e
-- quando — o que transforma o quadro da parede em dado.
--
-- tratamento  GTC   = nós entregamos, em dia fixo da semana
--             STC   = terceiro retira (CDAM ou transportadora), em janela
--                     do mês combinada
--             OCULTO = CAM que existe na base mas não é mais usado
--
-- documento_esperado existe separado do tratamento porque os dois nem
-- sempre andam juntos: o NÚCLEO DE IMPLANTAÇÃO é entrega a empresa (quem
-- retira é terceiro, logo tratamento STC), mas o documento lançado no
-- sistema é GTC. Quem manda na fila é o tratamento; o documento esperado
-- serve para conferir o que aparece no WMS.
-- ---------------------------------------------------------------------
create table if not exists public.cam_config (
  cam                 text primary key,
  sigla               text not null default '',
  tratamento          text not null default 'PENDENTE'
                      check (tratamento in ('GTC','STC','OCULTO','PENDENTE')),
  documento_esperado  text check (documento_esperado in ('GTC','STC')),
  dias_rota           integer[] not null default '{}',
  janela_inicio       integer check (janela_inicio between 1 and 31),
  janela_fim          integer check (janela_fim between 1 and 31),
  observacao          text not null default '',
  atualizado_em       timestamptz not null default now(),
  atualizado_por      text not null default ''
);

-- ---------------------------------------------------------------------
-- Tabela de sinal de vida. Existe só para a verificação diária poder
-- tocar no banco sem precisar de senha: o projeto gratuito do Supabase
-- hiberna depois de cerca de uma semana sem nenhum acesso, e acordar
-- manualmente numa segunda de manhã, com a programação para fazer, é o
-- pior momento possível.
--
-- É a única tabela de leitura pública do sistema, e de propósito: ela
-- guarda uma data e nada mais. Nenhum dado de programação passa por aqui.
-- ---------------------------------------------------------------------
create table if not exists public.saude (
  id             integer primary key default 1,
  verificado_em  timestamptz not null default now(),
  constraint saude_linha_unica check (id = 1)
);
insert into public.saude (id) values (1) on conflict (id) do nothing;

alter table public.saude enable row level security;
drop policy if exists "leitura_publica_saude" on public.saude;
create policy "leitura_publica_saude" on public.saude for select to anon, authenticated using (true);
grant select on public.saude to anon, authenticated;

-- =====================================================================
-- Controle de acesso
-- =====================================================================
alter table public.programacoes          enable row level security;
alter table public.demandas              enable row level security;
alter table public.bloqueios             enable row level security;
alter table public.capacidade_overrides  enable row level security;
alter table public.config                enable row level security;
alter table public.cam_config            enable row level security;

do $$
declare t text;
begin
  foreach t in array array['programacoes','demandas','bloqueios','capacidade_overrides','config','cam_config'] loop
    execute format('drop policy if exists "programadores_autenticados" on public.%I', t);
    execute format(
      'create policy "programadores_autenticados" on public.%I
         for all to authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

grant usage on schema public to authenticated;

-- =====================================================================
-- Conferência: deve listar as 7 tabelas, todas com RLS ligada.
-- =====================================================================
select tablename, rowsecurity as rls_ligada
from pg_tables
where schemaname = 'public'
  and tablename in ('programacoes','demandas','bloqueios','capacidade_overrides','config','saude','cam_config')
order by tablename;
