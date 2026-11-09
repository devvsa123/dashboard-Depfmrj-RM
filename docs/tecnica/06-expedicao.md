# 06 — Expedição

O trecho do processo que começa onde a separação termina. Arquivos:
`utils/programacao/expedicao.js`, `components/programacao/ExpedicaoPanel.jsx`,
`utils/programacao/documentoExpedicao.js`.

## O caminho de uma RM depois de conferida

```
CONFERIDA sem documento  → a Expedição monta o mapa de carregamento e
                           atrela o mapa a uma GTC ou a uma STC
CONFERIDA com GTC        → nós entregamos; acaba em EXPEDIDO
CONFERIDA com STC        → o CDAM retira; para nós acaba quando a STC
                           está lançada, mas o material só sai da casa
                           quando eles vêm buscar
```

Daí as filas da tela terem fins diferentes: cobrar `EXPEDIDO` de uma STC
seria cobrar trabalho que não é nosso. O que se pode fazer com a STC
parada é avisar o CDAM — e é para isso que serve a fila de cobrança.

> **Quem manda é o tratamento, não o documento.** O Núcleo de Implantação
> é retirada por terceiro (tratamento STC) e mesmo assim o documento
> lançado no WMS é GTC. Rotear pela coluna do documento tirava esse CAM da
> fila de cobrança. Ver [12 — Decisões](12-decisoes.md).

## As duas visões da aba

### 1. Agenda da semana (a ordem de serviço)

Vem de `projetarExpedicao({ snapshot, indiceWms, dias, porCam, forcados, hoje })`
e trabalha **só com as RMs da programação publicada**. Para cada dia, uma
linha por cliente, com a ação escrita:

| Ação | Significa |
|---|---|
| `Prontificar` | Lançar a STC ou a GTC em todas as RMs do lote que chegou |
| `Prontificar e entregar` | O lote chega e a rota do cliente é hoje |
| `Entregar` | Já foi prontificado; hoje o caminhão sai |

Regras de tempo:

- o material concluído pela estocagem num dia **chega à Expedição no dia
  útil seguinte** (`somaDiasUteis(dia, 1)`);
- o prazo de **prontificar** é de 3 dias úteis a partir da chegada
  (`DIAS_EXPEDICAO`), ou o prazo da mensagem nas RMs prioritárias, o que
  vier primeiro;
- **a rota não encurta o prazo de prontificação**: entregar é outro
  trabalho, com data própria. Nas linhas que entregam no mesmo dia o
  documento avisa que a GTC precisa estar lançada antes de o caminhão
  sair.

### 2. Filas de trabalho (o que ficou de trás)

`montarFilasExpedicao(indiceWms, porCam, hoje)` olha todo o WMS, não só a
semana:

| Fila | O que junta |
|---|---|
| **Prontificar STC** | CAMs de tratamento STC com RMs conferidas sem documento |
| **Fornecer GTC** | Entrega nossa, por dia de rota — só termina em `EXPEDIDO` |
| **Cobrar a retirada** | Documento já lançado, aguardando o CDAM (ou a empresa) vir buscar |

A fila de cobrança usa níveis por tempo de espera (`rotas.js → NIVEIS_COBRANCA`):

| Nível | Espera | Leitura |
|---|---|---|
| Verde | até 7 dias | No prazo |
| Amarelo | até 15 dias | Atenção |
| Vermelho | acima de 15 | Cobrar o CDAM |

O tempo é contado do último movimento (em linha conferida, a própria
conferência). O WMS não guarda quando a STC foi inserida, então essa é a
medida honesta: tempo de casa depois de pronto, não tempo de STC.

## Estados de cada RM na projeção

| Estado | Como é reconhecido |
|---|---|
| `NAO_CHEGOU` | Ainda não conferida |
| `A_PRONTIFICAR` | Conferida, sem documento |
| `PRONTA` | Conferida com STC lançada — para nós, acabou |
| `A_ENTREGAR` | Conferida com GTC lançada — falta sair |
| `EXPEDIDA` | Saiu |
| `CANCELADA` | Cancelada depois de programada |

Esses estados alimentam a tela. **O documento não os usa**: na emissão
tudo está em processamento, e acompanhamento é assunto da aba Andamento
— ver [09 — Documentos](09-documentos.md).

## Blocos e mesclagem

A projeção agrupa por CAM e por dia de chegada. Dois lotes do mesmo CAM
que chegam no mesmo dia são um serviço só (um lançamento, um caminhão).
Um CAM de GTC aparece duas vezes apenas quando a rota cai em dia
diferente do da chegada — e aí são dois trabalhos mesmo: lançar hoje,
carregar depois.

As RMs de cada bloco saem na ordem de liberação do WMS, mais antiga em
cima, igual ao resto do sistema.
