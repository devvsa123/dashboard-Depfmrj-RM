# 01 — Visão geral

## O problema

O DepFMRJ recebe requisições de material (RMs) das organizações militares
clientes, separa o fardamento no armazém e entrega — ou entrega para
alguém retirar. Esse trabalho é registrado em dois sistemas que não
conversam bem entre si:

- **WMS** (ALCIS/KWAY): o sistema do armazém. Sabe o que está reservado,
  separado, conferido e expedido.
- **SINGRA**: o sistema de abastecimento da Marinha. Sabe o que foi pedido
  e o que foi arrecadado pela OM cliente.

Antes deste sistema, três coisas não existiam em lugar nenhum:

1. **Uma medida do que está parado.** O gargalo era discutido de memória.
2. **Uma programação escrita da semana.** A ordem de atendimento era
   decidida no dia, pelo que estava mais à mão.
3. **Uma ligação entre a separação e a saída.** O depósito separava para
   um cliente cujo caminhão já tinha passado, e o material ficava pronto
   esperando a semana seguinte.

## O que o sistema faz

| Função | Resultado prático |
|---|---|
| Consolida WMS e SINGRA | Uma base só, com o estado de cada RM |
| Mede atendimento, lead time e SLA | Indicadores com meta e comparação de período |
| Mede a fila e sua idade | Quanto há, de quem, há quanto tempo |
| Monta a programação semanal | Grade por CAM e por dia, com a razão de cada alocação |
| Emite documento assinável | PDF de assinatura e planilha de manuseio |
| Projeta a linha de produção | O que a Expedição prontifica e entrega em cada dia |
| Acompanha o cumprimento | O que foi publicado contra o que o WMS mostra hoje |
| Audita a interface | Divergências entre SINGRA e WMS |

## Quem usa

| Perfil | Usa | Precisa de login |
|---|---|---|
| Direção e encarregados | Indicadores, relatório mensal | Não |
| Programador do abastecimento | Programação, Expedição, Análise da Fila, Andamento | **Sim** |
| Expedição | Documento da Expedição, subaba Expedição | Não (lê o documento) |
| Administrador | Supabase, Vercel, cadastro de usuários | Sim |

Só o módulo de Programação exige autenticação: ele escreve no banco e
produz documento assinado. As abas analíticas são de leitura e ficam
abertas.

## Fronteiras do sistema

O que ele **não** faz, de propósito:

- Não escreve no WMS nem no SINGRA. É leitura e planejamento; o lançamento
  continua sendo feito nas telas dos sistemas de origem.
- Não decide sozinho o que sacrificar. Quando a demanda não cabe, o motor
  aloca o que cabe e devolve o conflito escrito para o programador
  resolver.
- Não guarda dado operacional de origem. As planilhas são lidas a cada
  sincronização; o banco guarda só o que é decisão humana (demandas,
  bloqueios, cadastro de rotas, versões publicadas).

## Glossário

Termos do domínio que aparecem no código exatamente como aqui.

| Termo | Significado |
|---|---|
| **RM** | Requisição de Material. A unidade de trabalho. No WMS é a coluna `PEDIDO`. |
| **PI** | Pedido de Importação, agrupador usado no SINGRA. |
| **CAM** | A organização militar cliente. Um CAM pode ter várias RMs em aberto. |
| **CDAM** | Centro de Distribuição que **retira** material no depósito, em janela do mês. |
| **GTC** | Guia de Transporte de Carga. Tratamento em que **nós entregamos**, em dia fixo da semana (a "rota" do CAM). |
| **STC** | Solicitação de Transporte de Carga. Tratamento em que **terceiro retira** (CDAM ou transportadora), dentro de uma janela do mês. |
| **Tratamento** | Quem leva o material ao cliente: GTC, STC, OCULTO (CAM fora de uso) ou PENDENTE (sem cadastro). |
| **Documento esperado** | O que deve ser lançado no WMS (GTC ou STC). Nem sempre acompanha o tratamento — ver [12 — Decisões](12-decisoes.md). |
| **Prontificar** | Lançar o número da STC ou da GTC em todas as RMs de um lote. É o trabalho da Expedição depois que a separação termina. |
| **Capa de lote** | Agrupador do WMS (tela AK050) que reúne vários pedidos para serem reservados de uma vez (tela AK300). |
| **Fila de separação** | As RMs em **EM PLANEJAMENTO**: o que ainda vai ser reservado e separado. É o universo da programação. |
| **Em processamento** | As RMs em situação intermediária (reservada, em separação, separada, em conferência): já entraram na fila do WMS. |
| **Janela do CDAM** | Intervalo de dias do mês em que o CDAM retira o material de um CAM. |
| **Rota** | Dia da semana em que o depósito entrega num CAM de tratamento GTC. |
| **Semana programada** | A semana de segunda a sexta que a programação cobre. O sistema abre por padrão na semana seguinte à atual. |
| **Versão** | Cada publicação da programação de uma semana. Versão 0 é a *Original*; as seguintes são *Alterações*. |
| **Reemissão** | RM cancelada que volta depois com nova data de entrada. Vale sempre o ciclo mais novo. |

## Ciclo de vida de uma RM

```
SINGRA  ─emite─►  WMS
                   │
                   ▼
          EM PLANEJAMENTO ──────────────────► entra na FILA DE SEPARAÇÃO
                   │                           (universo da programação)
      reserva no WMS (AK050 + AK300)
                   │
                   ▼
    RESERVADO / EM SEPARAÇÃO / SEPARADO  ───► EM PROCESSAMENTO
          / EM CONFERÊNCIA                    (Análise da Fila)
                   │
                   ▼
              CONFERIDO ───────────────────►  entregue à EXPEDIÇÃO
                   │                           (prontificar: STC ou GTC)
                   ▼
               EXPEDIDO ───────────────────►  saiu do depósito
```

`CANCELADO` encerra o ciclo em qualquer ponto; se a RM voltar, começa um
ciclo novo e só ele conta.
