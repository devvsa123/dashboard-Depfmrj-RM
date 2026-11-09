# 02 — Arquitetura

## Princípio

O sistema é uma **página estática que processa tudo no navegador**. Não há
servidor de aplicação, fila, worker nem banco intermediário entre a
planilha e a tela. A única peça de servidor é uma função serverless que
busca as planilhas num repositório privado — ela existe para o token do
GitHub não ir para o navegador, e não faz mais nada.

A consequência prática: toda regra de negócio está em JavaScript no
cliente, é testável como função pura e pode ser lida sem subir
infraestrutura.

## Camadas

```
┌───────────────────────────────────────────────────────────────┐
│ components/                                                   │
│   Telas, cartões, tabelas, modais. Sem regra de negócio.      │
├───────────────────────────────────────────────────────────────┤
│ hooks/                                                        │
│   Carga de dados, estado, efeitos, memoização das análises.   │
├───────────────────────────────────────────────────────────────┤
│ utils/                                                        │
│   Funções puras: motor de programação, documentos, datas,     │
│   nomenclatura. Não conhecem React nem Supabase.              │
├───────────────────────────────────────────────────────────────┤
│ lib/supabase.js · utils/programacao/armazenamento.js          │
│   Única fronteira com o banco.                                │
└───────────────────────────────────────────────────────────────┘
```

Regra de dependência: `components → hooks → utils`. Um `util` nunca
importa de `hooks` ou `components`; é o que permite rodar o motor fora do
navegador para testá-lo.

## Fluxo de dados

### Carga (a cada abertura do site)

```
useSpreadsheetSync
  ├─ carrega SheetJS por CDN (window.XLSX)
  ├─ HEAD /api/planilhas/wms      → Last-Modified
  ├─ HEAD /api/planilhas/singra   → Last-Modified
  ├─ cache do IndexedDB bate com as duas datas? → usa o cache e para aqui
  ├─ GET das planilhas, leitura com SheetJS, normalização das colunas
  └─ grava no cache e devolve { data, singraData, lastSync }
```

`data` (WMS) e `singraData` (SINGRA) são arrays de objetos, uma entrada por
linha de planilha. Todo o resto do sistema deriva desses dois arrays.

### Análise (memoizada por hook)

| Hook | Entrada | Saída |
|---|---|---|
| `useDashboardAnalytics` | WMS | série diária, SLA, comparação de período |
| `useBacklogAnalysis` | WMS + SINGRA | fila em aberto, aging, top ofensores |
| `useInterfaceAnalysis` | WMS + SINGRA | divergências entre os dois sistemas |
| `useStcGtcAnalysis` | WMS | documentos STC/GTC, fechamento, aging |
| `useItemAnalysis` | WMS | curva ABC por nomenclatura |
| `useCamAnalysis` | WMS | desempenho por cliente |
| `useYoyAnalysis` | WMS | sazonalidade ano a ano |
| `useRmTypeComparison` | WMS | comparação por tipo de RM |
| `useRiskAlerts` | análises + metas | alertas e semáforo de saúde |
| `useProgramacao` | WMS + banco | tudo da aba Programação |
| `useCamConfig` | WMS + banco | cadastro de CAM e rotas |

### Programação (a parte com estado persistente)

```
useProgramacao
  ├─ indexarWms(data)            → índice RM → situação (ciclo mais novo)
  ├─ filaPorAntiguidade(índice)  → fila de separação (EM PLANEJAMENTO)
  ├─ medirCapacidade(data)       → vazão média por dia da semana
  ├─ carregarTudo()              → demandas, bloqueios, overrides, config
  ├─ programarSemana({...})      → grade proposta (motor, função pura)
  └─ publicar()                  → grava o snapshot em `programacoes`
```

O motor (`utils/programacao/motor.js`) recebe tudo por parâmetro e devolve
um objeto; não lê estado global, não escreve no banco e não conhece a
tela. Trocar a regra de alocação é mexer num arquivo só.

## Mapa dos módulos

### `src/utils/programacao/` — o núcleo

| Arquivo | Responsabilidade |
|---|---|
| `semana.js` | Aritmética de datas ISO, dias úteis, rótulos de semana |
| `capacidade.js` | Medição da vazão, índice do WMS, definição da fila |
| `rotas.js` | Tratamentos, rotas semanais, janelas do mês, prazos de saída |
| `prioridade.js` | Régua única de urgência (forçado, prazo, rota, janela, fila) |
| `motor.js` | Montagem da grade semanal |
| `rms.js` | Extração de RMs de texto colado e conferência contra o WMS |
| `versoes.js` | Snapshot, comparação entre versões, agrupamentos do anexo |
| `expedicao.js` | Filas da Expedição e projeção da linha de produção |
| `fila.js` | Análise do que está em processamento |
| `acompanhamento.js` | Comparação entre o publicado e o WMS de agora |
| `pdfTexto.js` | Motor de layout dos PDFs (texto, não imagem) |
| `documentoSeparacao.js` | PDF da programação semanal |
| `documentoExpedicao.js` | PDF da ordem de serviço da Expedição |
| `planilhaProgramacao.js` | Exportações em Excel |
| `armazenamento.js` | Leitura e escrita no Supabase |

### `src/components/programacao/` — a tela do módulo

| Arquivo | Papel |
|---|---|
| `ProgramacaoTab.jsx` | Subabas, seleção de semana, orquestração |
| `LoginGate.jsx` | Barreira de autenticação |
| `DemandasPanel.jsx` | Registro de demandas com prazo |
| `CapacidadePanel.jsx` | Capacidade medida e ajuste manual por dia |
| `ForcarCamPanel.jsx` | Forçar um CAM, com simulação do impacto |
| `GradeSemanal.jsx` | A grade proposta, por dia e por CAM |
| `GradesPanel.jsx` | Prestação de contas das grades de fornecimento |
| `VersoesPanel.jsx` | Publicar, remover versão, apagar a semana |
| `DocumentoCard.jsx` | Emissão do documento da separação |
| `DocumentoExpedicaoCard.jsx` | Emissão do documento da Expedição |
| `ExpedicaoPanel.jsx` | Agenda e filas da Expedição |
| `FilaPanel.jsx` | Análise da Fila |
| `AcompanhamentoPanel.jsx` | Andamento da semana publicada |
| `ConfigCamPanel.jsx` | Cadastro de CAM e rotas |

## A função de servidor

`api/planilhas/[arquivo].js` (Vercel, Node):

| Rota | Faz |
|---|---|
| `GET /api/planilhas/wms` | Baixa `planilha_estoque.xls` do repositório privado e repassa em streaming |
| `GET /api/planilhas/singra` | O mesmo para `planilha_rms_unificada.csv` |
| `HEAD` de qualquer uma | Devolve só `Last-Modified` — é o que o cache usa |
| `GET /api/planilhas/status` | Diz onde cada planilha foi achada e quando foi enviada |

A planilha é procurada na raiz do repositório e nas pastas de
`GITHUB_STORAGE_PASTAS` (padrão `dados_wms,dados_singra`). O token nunca
sai do servidor: as variáveis não têm o prefixo `VITE_`, então o Vite não
as embute no pacote do navegador.

## Build e publicação

```
vercel.json
  installCommand : cd supply-monitor && npm install
  buildCommand   : cd supply-monitor && npm run build
  outputDirectory: supply-monitor/dist
```

Push na branch `main` publica. O build embute `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY`; mudar essas variáveis exige novo build.

## Rotina automática

`.github/workflows/manter-banco-acordado.yml` lê uma linha da tabela
`saude` todo dia às 11:00 UTC. O projeto gratuito do Supabase hiberna após
cerca de uma semana sem acesso, e o uso do sistema é semanal — sem essa
rotina o banco estaria dormindo exatamente na segunda de manhã, com a
programação para fazer.
