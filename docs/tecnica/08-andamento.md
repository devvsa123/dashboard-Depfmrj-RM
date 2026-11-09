# 08 — Andamento

Subaba que compara **o que foi publicado** para a semana com **o que o WMS
mostra agora**. Arquivos: `utils/programacao/acompanhamento.js`,
`components/programacao/AcompanhamentoPanel.jsx`.

## De onde sai a comparação

Do snapshot da versão publicada, que fica inteiro no banco, RM por RM —
não do PDF. O PDF é um documento de assinatura; o banco já tem o mesmo
conteúdo de forma exata. Ler do papel seria adivinhação.

O programador escolhe qual versão acompanhar (Original, Alteração nº 1…).

## A escada de estados

| Estado | Como é reconhecido no WMS | Conta como cumprido? |
|---|---|---|
| **Não separada** | Qualquer situação anterior a conferido | Não |
| **Separada** | `CONFERIDO` sem documento | Sim |
| **Prontificada** | `CONFERIDO` com STC ou GTC lançada | Sim |
| **Expedida** | `EXPEDIDO` | Sim |
| **Cancelada** | `CANCELADO` depois de programada | Não |
| **Fora da base** | Não consta mais no WMS | Não |

O trabalho do depósito termina em `CONFERIDO` — é a mesma régua que define
"atendido" para efeito de prazo. Se, além disso, já há documento, a
Expedição também fez a parte dela.

## O que a tela entrega

- **Números**: programadas, cumpridas, em aberto, taxa de cumprimento e
  prontificadas.
- **Situação das RMs programadas**: um cartão por estado; clicar abre a
  lista com RM, CAM, dia programado, documento e situação, com download
  em Excel.
- **Por dia**: planejado × cumprido em cada dia da semana.
- **Por CAM**: quem está atrasado, incluindo CAMs que apareceram no WMS
  mas não estavam na versão publicada.

## Onde o andamento *não* aparece

No documento da Expedição e no da separação. Na emissão, todas as RMs
estão em processamento: estado de pedido ali não informaria nada e tiraria
espaço do que importa, que é prazo. O documento traz prazos; o
acompanhamento é aqui, lendo o WMS ao vivo.
