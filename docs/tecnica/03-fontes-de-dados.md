# 03 — Fontes de dados

## As duas planilhas

| Planilha | Arquivo | Origem | Formato |
|---|---|---|---|
| WMS | `planilha_estoque.xls` | Exportação do WMS, publicada por robô | Excel |
| SINGRA | `planilha_rms_unificada.csv` | Exportação do SINGRA, publicada por robô | CSV `;` |

Os robôs gravam os arquivos num **repositório privado do GitHub**; o
dashboard os busca pela função `/api/planilhas/...`
(ver [02 — Arquitetura](02-arquitetura.md)). Endereços em
`supply-monitor/src/constants.js`.

> A planilha do WMS é a fonte de verdade para situação de RM. É ela que
> alimenta a fila, a programação, a Expedição e o andamento. O SINGRA
> entra apenas no cruzamento da aba Interface e na busca por e-mail.

## Colunas do WMS usadas

As colunas são normalizadas na leitura (`utils/spreadsheet.js` →
`normalizeKeys`): aspas removidas, acentos removidos, tudo em maiúsculas,
espaços aparados. Uma coluna renomeada na origem só quebra o sistema se
mudar de nome de verdade, não por acento ou caixa.

| Coluna | Uso no sistema |
|---|---|
| `PEDIDO` | O número da RM. Chave de tudo. |
| `CAM` | O cliente. Agrupa a grade, a capa de lote e as rotas. |
| `STATUS` | A situação no WMS. Define fila, processamento e conclusão. |
| `STC` | O documento lançado: `GTC 002/2026` (GTC) ou `003/2026` (STC). Vazio = ainda não prontificada. |
| `DATA_ENTRADA` | Data de liberação da RM. **É por ela que o WMS ordena**, e por ela que o sistema ordena todas as listas. |
| `DATA_SEPARACAO` | Último movimento. Em linha conferida é a conferência; em expedida, a expedição. |
| `TIPO_RM` | Tipo (ex.: SEDE). Usado em filtros e comparações. |
| `NOMENCLATURA` | Descrição do item. Base da curva ABC. |
| `QUANTIDADE` | Quantidade de peças. |
| `PI` | Pedido de importação, usado nos indicadores. |
| `CAPA`, `LOTE` | Exibidos na busca por e-mail. |

### Datas

`utils/dates.js → safeGetISODate` aceita os três formatos que aparecem nas
exportações e devolve sempre `AAAA-MM-DD`:

- `Date` do SheetJS (`cellDates: true`);
- número serial do Excel (dias desde 1900);
- texto `dd/mm/aaaa`.

Qualquer outra coisa vira `null` — e `null` é tratado como "sem data",
nunca como hoje.

## Taxonomia de situações

O WMS usa um status por linha. O sistema os divide em três grupos, e essa
divisão é a espinha dorsal de tudo:

| Grupo | Situações | Quem olha |
|---|---|---|
| **Fila de separação** | `EM PLANEJAMENTO` (e a grafia `PLANEJAMENTO`) | A programação semanal |
| **Em processamento** | `RESERVADO`, `EM SEPARACAO`, `SEPARADO`, `EM CONFERENCIA` e qualquer situação nova | A Análise da Fila |
| **Fora de giro / encerradas** | `AGUARDANDO CONFERENCIA`, `CONFERIDO`, `EXPEDIDO`, `CANCELADO` | Expedição, Andamento, indicadores |

Definições no código:

- `utils/programacao/capacidade.js`
  - `estaNaFila(situacao)` — entra na programação (só planejamento);
  - `dependeDoDeposito(situacao)` — o trabalho ainda é do depósito (tudo
    menos conferido, expedido e cancelado);
  - `normalizarStatus(s)` — maiúscula, sem acento, espaço colapsado.
- `utils/programacao/fila.js`
  - `motivoDeFicarFora(situacao)` — o que **não** é "em processamento", e
    por quê. A regra é por exclusão: situação nova no WMS aparece na
    análise em vez de sumir da conta.

Por que a fila é só o planejamento: uma RM em situação intermediária já
tem capa de lote e reserva no WMS. Reprogramá-la mandaria o operador
montar uma capa que já existe. Ver [12 — Decisões](12-decisoes.md).

## Índice do WMS e o problema dos ciclos

`indexarWms(data)` transforma as linhas num `Map` de RM → estado atual. Uma
RM aparece em mais de uma linha por dois motivos opostos:

| Caso | O que significa | Como é lido |
|---|---|---|
| **Liberação parcial** | Mesmo atendimento, mesma `DATA_ENTRADA`, partes em situações diferentes | Uma RM só; vale a linha que ainda depende do depósito e, entre essas, a mais atrás |
| **Reemissão** | RM cancelada que voltou com `DATA_ENTRADA` nova | Dois ciclos; **só o mais novo conta** |

Ler os dois ciclos juntos faria uma RM reaberta ontem parecer de meses
atrás e furar a fila de quem espera de verdade — e, no sentido contrário,
manteria em fila uma RM cujo ciclo novo já foi expedido.

Cada entrada do índice traz:

```js
{ rm, entrada, situacao, cam, documento, tipoRm, movimento, linhas, ciclos, reemitida }
```

`reemitida: true` sinaliza que houve ciclo anterior — é o que explica, na
tela, por que uma RM antiga aparece como nova na fila.

## Sincronização e cache

`hooks/useSpreadsheetSync.js`:

1. Carrega o SheetJS por CDN e o deixa em `window.XLSX`.
2. Faz `HEAD` nas duas planilhas e guarda o `Last-Modified`.
3. Compara com o que está no **IndexedDB** (`utils/cache.js`, base
   `SupplyMonitorDB`, store `cacheStore`, chave `supplyData`).
4. Se as duas datas baterem, usa o cache e não baixa nada.
5. Caso contrário baixa, lê, normaliza, grava no cache e atualiza
   `lastSync`.

Consequência importante para quem testa: **só um `Last-Modified` novo
invalida o cache**. Trocar o conteúdo da planilha mantendo a data faz o
sistema continuar mostrando o conteúdo antigo.

A sincronização acontece sozinha ao abrir o site. O hook exporta
`performSync(true)`, que ignora o cache, mas **hoje nenhum controle da
interface chama essa função**: para forçar a releitura, limpe os dados do
site no navegador (o IndexedDB `SupplyMonitorDB`) e recarregue. Ligar um
botão de "sincronizar agora" a essa função é uma melhoria pendente de
baixo custo.

## Par WMS x SINGRA (aba Interface)

O WMS é publicado a cada ~5 min; o SINGRA, a cada ~30 (a extração leva ~12 min e o robô espera mais 20 depois dela).
Cruzar o SINGRA de 20 min atrás com o WMS de agora faz a aba **Interface SINGRA x WMS** acusar como "falha" tudo que um
operador mexeu no WMS nesse intervalo (ex.: `WMS: CONFERIDO` × `SINGRA: Em Separação`): o SINGRA ainda não tinha recebido,
mas a lista pede ao operador que vá corrigir.

Por isso o robô do SINGRA publica, a cada ciclo, o **par** na pasta `dados_interface/` do repositório de planilhas:

| Arquivo | Conteúdo | Rota |
|---|---|---|
| `dados_interface/planilha_estoque.xls` | O WMS que estava publicado **quando o SINGRA começou a extrair** | `/api/planilhas/wms-par` |
| `dados_interface/planilha_rms_unificada.csv` | O SINGRA desse ciclo | `/api/planilhas/singra-par` |

O WMS do par é o do início da extração (e não o do fim) de propósito: o erro que se quer evitar é o WMS estar à frente do
SINGRA, e um WMS mais velho que o SINGRA nunca produz esse falso positivo. O robô não reenvia dados para montar o par: o
commit só aponta para arquivos que já existem no repositório (ver o README do RPA).

`hooks/useParInterface.js` carrega o par **depois** da carga normal (não atrasa as outras abas) e o guarda no IndexedDB
(chave `supplyPar`), validado pelo SHA (`X-Blob-Sha`) e pelo `Last-Modified` de cada metade. A hora de cada metade vem do
`atualizado.json` (chave = caminho, ex.: `dados_interface/planilha_estoque.xls`) e aparece numa faixa no topo da aba.

| Estado | O que a aba faz |
|---|---|
| `idle` / `loading` | Mostra "Carregando…" e **não** a lista (ela ainda estaria no WMS ao vivo) |
| `ok` | Cruza o par; faixa azul "Dados do mesmo momento: WMS de … × SINGRA de …" |
| `indisponivel` | O robô ainda não publicou o par (404) ou ele veio vazio: cai para WMS/SINGRA ao vivo, com faixa amarela avisando que pode haver divergência que é só defasagem |

Só o hook `useInterfaceAnalysis` recebe o par; ele alimenta a aba Interface, os cartões que dependem do cruzamento na aba
Indicadores, os alertas de risco e a análise de IA. As demais abas continuam com o WMS ao vivo (5 min). Busca por e-mail e
Fila em processamento também cruzam com o SINGRA, mas mostram situação (não apontam falha), então seguem ao vivo.

## O que vem do SINGRA

CSV separado por `;`, lido em `utils/spreadsheet.js → fetchSingraOnly`.
Colunas usadas: identificador da RM (`ID`, `PEDIDO`, `RM` ou `DOCUMENTO`),
`SITUACAO`/`STATUS`, `PI` e datas. O cruzamento com o WMS é feito por
número de RM normalizado (zeros à esquerda removidos, maiúsculas).

## Dados que o sistema guarda (não vêm de planilha)

Tudo o que é decisão humana vive no Supabase, nunca na planilha:
demandas com prazo, dias sem separação, ajustes de capacidade, cadastro de
CAM e rotas, versões publicadas e preferências.
Ver [10 — Banco de dados](10-banco-de-dados.md).
