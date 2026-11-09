# 04 — Indicadores e análises

As cinco abas que não exigem login. Todas leem as mesmas duas planilhas e
não escrevem nada.

---

## Aba Indicadores (`DashboardTab`)

Hook principal: `useDashboardAnalytics(data)`.

### Série diária

Para cada dia com movimento, calcula entradas (por `DATA_ENTRADA`),
separações (por `DATA_SEPARACAO`), lead time do dia, médias móveis de 7
dias e um canal de referência. RMs canceladas ficam de fora da série.

### Seleção de período

Presets: **7 dias, 30 dias, 90 dias, mês atual, mês anterior, ano atual,
tudo**; ou intervalo escolhido na mão. O período selecionado recalcula
todos os cartões da aba.

### Comparação

`comparisonMode` aceita:

| Modo | Compara com |
|---|---|
| `previous` | O período imediatamente anterior, de mesmo tamanho |
| `yearOverYear` | O mesmo período do ano anterior |
| `none` | Sem comparação |

A variação aparece nos `DeltaBadge` ao lado de cada número.

### SLA por tipo de documento

O prazo não é único — depende de quem leva o material
(`useStcGtcAnalysis.js`):

| Documento | Meta de prazo | Por quê |
|---|---|---|
| **GTC** | 10 dias | Entrega nossa, em rota semanal |
| **STC** | 45 dias | Depende de o CDAM vir retirar |
| Sem documento | 20 dias | Referência para o que ainda não foi prontificado |

O cálculo é sobre pedidos **expedidos**, de `DATA_ENTRADA` até
`DATA_SEPARACAO`.

### Os números do período

| Indicador | O que mede |
|---|---|
| **Entradas** | RMs liberadas no período (por `DATA_ENTRADA`) |
| **Saídas** | RMs expedidas no período (por `DATA_SEPARACAO`) |
| **Nível de Serviço** | % expedido dentro da meta do próprio documento |
| **Tempo Médio de Atendimento** | Lead time de entrada até expedição |
| **Balanço do Período** | Saídas menos entradas — a fila cresceu ou diminuiu |
| **Previsão para Zerar a Fila** | Dias na vazão atual |

Gráficos: entradas × saídas com média móvel de 7 dias, tempo de
atendimento com canal de volatilidade, qualidade do processo
(liberados × cancelados por mês) e PIs fornecidos × cancelados.

RMs canceladas ficam fora das séries diárias, para não distorcer a média
móvel.

### Cartões da aba

| Cartão | O que mostra |
|---|---|
| `HealthBanner` + `RiskAlertsPanel` | Semáforo geral e alertas derivados das metas |
| `GoalsPanel` | Metas editáveis (guardadas no navegador) |
| `StcGtcCard` | Documentos STC e GTC: fechados, parciais, pendentes, aging |
| `OmsHandoffCard` | Passagem para a OM cliente |
| `MonthlyReportCard` | Resumo mensal, com exportação |
| `CamAnalysisCard` | Desempenho por cliente |
| `RmTypeComparisonCard` | Comparação por tipo de RM |
| `YoySeasonalityCard` | Sazonalidade ano a ano |
| `PiDetailsModal` | Detalhe de um PI |

### Metas (`useGoals`)

Guardadas em `localStorage` (`supplyGoals`), por navegador — não são
compartilhadas entre pessoas. Valores padrão:

| Meta | Padrão |
|---|---|
| Idade média aceitável da fila | 15 dias |
| Idade máxima do pedido mais antigo | 30 dias |
| SLA de STC / GTC | 90% / 90% |
| Mais antigo com STC / GTC / sem documento | 60 / 15 / 10 dias |

`useRiskAlerts` não tem limiar escondido: o nível "crítico" é sempre um
múltiplo declarado da própria meta.

### Consultor (opcional)

`useAiConsultant` envia um resumo dos indicadores já exibidos ao Google
Gemini e devolve um diagnóstico em texto. Depende de chave configurada;
sem ela, o cartão simplesmente não oferece a análise. Nenhum dado de
pedido individual é enviado — apenas números agregados.

---

## Aba RM em processamento (`BacklogTab`)

Hook: `useBacklogAnalysis(data, singraData)`.

Fila em aberto na visão do dashboard: tudo que **não** está `EXPEDIDO` nem
`CANCELADO` — inclui, portanto, as conferidas aguardando a Expedição.

> Atenção à diferença de recortes, que é proposital:
> esta aba inclui conferidas; a **fila de separação** da Programação é só
> `EM PLANEJAMENTO`; a **Análise da Fila** é só o meio do processo.
> Ver [07 — Análise da Fila](07-analise-da-fila.md).

| Recurso | Detalhe |
|---|---|
| Filtros | Tipo de RM e intervalo de `DATA_ENTRADA` |
| Aging | Faixas de 0-3, 4-7, 8-14, 15-30 e 30+ dias |
| Composição | Distribuição por status do WMS, em pizza e em barras empilhadas |
| Cruzamento | Situação de cada RM no SINGRA |
| Top 10 | Os pedidos mais antigos, com detalhe em modal |
| Exportação | Excel da lista filtrada |

---

## Aba Interface SINGRA x WMS (`InterfaceTab`)

Hook: `useInterfaceAnalysis(data, singraData)`. Confronta os dois sistemas
RM a RM e separa em quatro grupos:

| Grupo | Significa |
|---|---|
| **Aguardando retirada** | SINGRA em trânsito, WMS conferido — pronto, esperando quem retira |
| **Aguardando arrecadação** | SINGRA em trânsito, WMS expedido — saiu daqui, falta a OM arrecadar |
| **Arrecadado pela OM** | Expedido no WMS e já fora do SINGRA |
| **Falhas de interface** | As combinações que não deveriam existir |

A última é a que importa para manutenção: cobre tanto a RM que está no
WMS e não chegou ao SINGRA quanto a que está no SINGRA em andamento e não
existe no WMS. Cada grupo traz resumo (pedidos, documentos distintos,
idade média, mais antigo) e lista exportável.

---

## Aba Por Item (`ItemAnalysisTab`)

Hook: `useItemAnalysis(data)`; parsing em `utils/nomenclatura.js`.

São milhares de nomenclaturas distintas, e olhar item a item não ajuda.
A nomenclatura é quebrada em três níveis de agrupamento:

| Nível | O que junta |
|---|---|
| **Família** | O primeiro termo (ex.: `CALCA`) |
| **Linha** | O modelo, sem peça e sem tamanho |
| **Grade** | A nomenclatura sem o tamanho — junta todos os tamanhos |

O tamanho é extraído em separado, para dar para olhar a grade por dentro.
Sobre os grupos é aplicada a **curva ABC**, que mostra quais poucos grupos
explicam a maior parte do movimento.

---

## Aba Busca por E-mail (`EmailSearchTab`)

Hook: `useEmailExtractor(data, singraData)`.

Cole o texto de uma mensagem ou e-mail: o sistema extrai os números de RM
(aceita `15757540` e `15.757.540`), consulta cada um nos dois sistemas e
devolve uma tabela com CAM, capa, STC, status no WMS, situação no SINGRA e
datas. Buscas podem ser salvas no navegador e o resultado sai em Excel.

É a ferramenta de resposta rápida a "e a minha RM?" — e a mesma extração
de números alimenta o registro de demandas da Programação
(`utils/programacao/rms.js`).
