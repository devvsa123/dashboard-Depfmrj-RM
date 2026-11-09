# 07 — Análise da Fila

Subaba da Programação que mede **o que está em processamento agora**.
Arquivos: `utils/programacao/fila.js`, `components/programacao/FilaPanel.jsx`.

## Definição

A fila aqui é o **meio do processo**. Lê só o arquivo de situação das RMs
que vem do PWA (o WMS) — nada de SINGRA, nada de versão publicada —,
porque a pergunta é o que está na mão do depósito neste instante, e esse
arquivo é atualizado com frequência alta.

Ficam **fora**:

| Situação | Por que não entra |
|---|---|
| `EM PLANEJAMENTO` | Primeiro status: o pedido chegou e ainda não entrou em trabalho |
| `AGUARDANDO CONFERÊNCIA` | Fora do giro da separação |
| `CONFERIDO` | A separação terminou — daqui é trabalho da Expedição |
| `EXPEDIDO` | Já saiu do depósito |
| `CANCELADO` | Cancelada — e não é mostrada em parte nenhuma da análise |

Qualquer outra situação **entra**. A regra é por exclusão de propósito:
quando o WMS passar a emitir uma situação nova, ela aparece na fila e na
tabela de situações, em vez de sumir da conta sem ninguém notar.

Grafia e acento não contam (`EM SEPARACAO` e `Em Separação` são a mesma
coisa) e "Aguardando conferência" é reconhecida por prefixo.

> As duas contas não se sobrepõem: a **fila de separação** que alimenta a
> grade é só `EM PLANEJAMENTO`; esta análise é só o meio do processo. O
> painel diz isso em uma linha, para ninguém comparar os dois números
> achando que um está errado.

## O que a tela mostra

| Bloco | Conteúdo |
|---|---|
| Números | RMs na fila · clientes · idade média · maior espera · **semanas para zerar** (fila ÷ vazão medida) |
| Onde a fila está parada | Por situação: quantidade, % e idade média |
| Idade da fila | Faixas de até 7, 8–15, 16–30, 31–60 e mais de 60 dias |
| A fila por cliente | Do maior para o menor, com média e maior espera |
| O que não entra na fila | Cada situação excluída, o motivo, e a conferência `total = fila + fora` |

Cada bloco abre a lista das RMs (mais antiga em cima, com busca por RM,
CAM ou situação). Tudo sai em Excel: `Analise_da_Fila_<data>.xlsx`, com as
abas Resumo, Fila, Por situação, Por cliente, Idade da fila e Fora da
fila.

## Detalhes de cálculo

- **Idade** = dias desde a `DATA_ENTRADA` (data de liberação). RM sem data
  fica sem idade, é contada em `semData` e sai das contas de média e das
  faixas — não vira zero nem vira hoje.
- **Reemissão**: vale o ciclo mais novo, como no resto do sistema; a
  contagem de reemitidas aparece no resumo.
- **Semanas para zerar** usa a vazão medida da aba de capacidade. É a
  conta que diz se a fila está sendo vencida ou apenas administrada.
- A conferência do arquivo (`total no arquivo = na fila + fora`) é
  exibida sempre: serve para provar que nenhuma RM sumiu da análise.
