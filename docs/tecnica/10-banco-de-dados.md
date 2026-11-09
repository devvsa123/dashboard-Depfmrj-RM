# 10 — Banco de dados

Supabase (PostgreSQL + Auth). Guarda **apenas decisão humana**: nada que
venha da planilha é persistido. Script completo e idempotente em
`supabase/schema.sql` — pode ser rodado de novo sem quebrar nada.

## Tabelas

### `programacoes` — as versões publicadas

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid | PK |
| `semana` | date | Segunda-feira da semana |
| `versao` | integer | 0 = Original, 1+ = Alterações |
| `publicada_em` | timestamptz | `now()` |
| `publicada_por` | uuid | FK para `auth.users`, `on delete set null` |
| `publicada_por_nome` | text | Nome impresso no documento |
| `snapshot` | **jsonb** | A grade inteira como foi publicada |

`unique (semana, versao)` e índice por `semana`. O snapshot é o que
permite reemitir o documento meses depois e alimentar a aba Andamento.

### `demandas` — o que foi pedido com prazo

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | text | PK, gerado no cliente (`D<timestamp>`) |
| `origem` | text | `MENSAGEM`, `GERENCIA`, `OUTRO` |
| `referencia` | text | Ex.: "Msg 150/2026" |
| `prazo` | date | Prazo de prontificação |
| `dias_expedicao` | integer | Padrão 3 |
| `rms` | text[] | As RMs coladas |
| `semana` | date | **A semana a que a demanda pertence** |
| `criada_em`, `criada_por_nome` | | Autoria |

A coluna `semana` foi acrescentada depois, com migração no próprio
schema: sem ela uma mensagem colada numa semana reaparecia em todas as
seguintes.

### `bloqueios` — dias sem separação

`data` (PK), `motivo`, `criado_em`. O motivo vai impresso no documento.

### `capacidade_overrides` — ajuste manual de capacidade

`data` (PK), `rms` (integer, `check >= 0`). O que não estiver aqui usa a
capacidade medida no histórico.

### `config` — preferências compartilhadas

Chave/valor (`chave` text PK, `valor` jsonb). Chaves em uso:

| Chave | Conteúdo |
|---|---|
| `janelaDias` | Janela de medição da capacidade (84, 182 ou 365) |
| `encarregado` | Nome do Encarregado do Abastecimento, para o documento |
| `forcados:<AAAA-MM-DD>` | Lista de CAMs forçados **daquela semana** |

### `cam_config` — cadastro de CAM e rotas

| Coluna | Observação |
|---|---|
| `cam` | PK, o nome como aparece no WMS |
| `sigla` | Nome curto para os documentos |
| `tratamento` | `GTC`, `STC`, `OCULTO` ou `PENDENTE` (check) |
| `documento_esperado` | `GTC` ou `STC` (check) — separado do tratamento de propósito |
| `dias_rota` | integer[] com 1..5 |
| `janela_inicio`, `janela_fim` | 1..31 (check) |
| `observacao`, `atualizado_em`, `atualizado_por` | |

Carga inicial em `supabase/rotas_iniciais.sql`, com `ON CONFLICT DO
NOTHING` — nunca sobrescreve um CAM já ajustado na tela.

### `saude` — sinal de vida

Uma linha só (`check (id = 1)`), com `verificado_em`. Existe para a rotina
diária do GitHub Actions tocar no banco sem senha e adiar a hibernação do
projeto gratuito. É a **única tabela de leitura pública** do sistema, e de
propósito: guarda uma data e nada mais.

## Controle de acesso

Todas as tabelas têm **RLS ligada**. Uma política só, aplicada às seis
tabelas de programação:

```sql
create policy "programadores_autenticados" on public.<tabela>
  for all to authenticated using (true) with check (true);
```

Ou seja: **qualquer usuário autenticado lê e escreve tudo**; quem não
está logado não enxerga nada. Os programadores se revezam no mesmo
trabalho, então não há papel diferente entre eles.

A chave `anon` publicada no site é pública por desenho — ela identifica o
projeto, não autoriza nada. Quem protege os dados é a RLS.

`saude` tem política própria, de leitura para `anon` e `authenticated`.

## Autenticação

- Supabase Auth, e-mail e senha. Usuários criados à mão no painel
  (Authentication → Users), com *Auto Confirm User* marcado.
- O nome de exibição vem de `raw_user_meta_data.nome`; sem ele o sistema
  usa a parte do e-mail antes do `@` — e é esse nome que sai impresso
  como "Programador do DepFMRJ". `supabase/usuarios.sql` preenche os
  nomes.
- `hooks/useAuth.js` traduz as mensagens do Supabase, que vêm em inglês e
  técnicas demais para quem só quer entrar.
- A sessão é persistida e renovada automaticamente.

## Camada de acesso no código

`utils/programacao/armazenamento.js` é a única porta para o banco:
`carregarTudo`, `salvarDemanda`, `apagarDemanda`, `salvarBloqueio`,
`apagarBloqueio`, `salvarOverride`, `salvarConfig`, `carregarVersoes`,
`salvarVersao`, `apagarVersao`, `apagarSemana`, `carregarCamConfig`,
`salvarCamConfig`.

A escrita é otimista: a tela atualiza primeiro e o indicador "salvando"
mostra o estado da gravação; falha vira mensagem visível, não silêncio.
