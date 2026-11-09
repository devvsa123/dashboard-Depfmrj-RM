# 05 — Programação semanal

O módulo que monta, publica e documenta a semana de separação. É a única
parte do sistema que exige login e escreve no banco.

Arquivos: `components/programacao/*`, `hooks/useProgramacao.js`,
`utils/programacao/{motor,capacidade,rotas,prioridade,rms,versoes}.js`.

---

## As subabas

| Subaba | Para quê | Fala de uma semana? |
|---|---|---|
| **Montar a semana** | Informar demandas, capacidade, bloqueios; ver a grade; publicar | Sim |
| **Análise da fila** | Medir o que está em processamento agora | Não — é o estado de agora |
| **Andamento** | Cumprimento da semana publicada | Sim |
| **Expedição** | Agenda da linha de produção e filas | Não |
| **CAM e Rotas** | Cadastro de clientes, rotas e janelas | Não |

A semana aberta por padrão é a **seguinte à atual** (`segundaDaSemana(hoje + 7)`).
Demandas, bloqueios e CAMs forçados pertencem à semana em que foram
registrados — mudar de semana não arrasta informação de uma para outra.

---

## As entradas do programador

### Demandas com prazo (`DemandasPanel`)

O programador cola a relação de RMs de uma mensagem, e-mail ou conversa.
`utils/programacao/rms.js` extrai os números (aceita `15757540` e
`15.757.540`), remove duplicatas e confere cada um contra o WMS:

| Situação | Significa | Entra na grade? |
|---|---|---|
| `EM_FILA` | Em planejamento | Sim |
| `EM_PROCESSAMENTO` | Já reservada/em separação — já está na fila do WMS | Não |
| `CONFERIDA` | Já com a Expedição | Não |
| `JA_EXPEDIDA` | Já saiu | Não |
| `CANCELADA` | Cancelada no WMS | Não |
| `NAO_ENCONTRADA` | Não existe na base | Não |

Conferir **antes** de programar evita planejar trabalho que não existe. A
demanda guarda o total informado e quantas entraram na semana — a
mensagem cobra o lote inteiro, mesmo que parte já tenha saído.

Campos: origem (Mensagem, Gerência, Outra), referência, prazo e dias de
expedição (padrão 3). O prazo é de **prontificação**; a separação precisa
terminar antes, e esse desconto é o `limiteDeSeparacao`.

### Capacidade (`CapacidadePanel`)

Medida do histórico, não digitada (`capacidade.js → medirCapacidade`):
média de RMs expedidas por dia da semana, dentro de uma janela de 12
semanas, 6 meses ou 12 meses. Dias parados entram como zero, de propósito
— feriado faz parte da vazão média.

Por que média e não mediana: a operação trabalha em batelada. A mediana
somaria cerca de 275 RMs/semana enquanto a vazão real passa de 420;
planejar pela mediana subestimaria a semana em mais de um terço.

O programador pode sobrescrever a capacidade de um dia específico
(`capacidade_overrides`). É a alavanca para, por exemplo, caber um CAM
grande num dia só.

### Dias sem separação (`BloqueiosPanel`)

Data e motivo (feriado, inventário, licença). O campo só aceita dias da
semana programada. Dia bloqueado tem capacidade zero e o motivo vai
impresso no documento.

### Forçar um CAM (`ForcarCamPanel`)

Põe um CAM na frente de tudo, inclusive das demandas com prazo. Antes de
confirmar, a tela simula: quantas RMs entram, quantas saem, de quais CAMs,
e o que isso faz com a janela de entrega daquele cliente. O custo aparece
antes da decisão e fica registrado nos alertas depois.

### Cadastro de CAM e rotas (`ConfigCamPanel`)

A lista de CAMs não é digitada: sai do próprio movimento do WMS
(`useCamConfig`), de modo que um cliente novo aparece sozinho para ser
cadastrado. Para cada CAM:

| Campo | Significado |
|---|---|
| `sigla` | Nome curto, usado nos documentos |
| `tratamento` | `GTC` (nós entregamos), `STC` (terceiro retira), `OCULTO`, `PENDENTE` |
| `documento_esperado` | O que deve ser lançado no WMS (`GTC`/`STC`) |
| `dias_rota` | Dias da semana da rota (1=segunda … 5=sexta), para GTC |
| `janela_inicio` / `janela_fim` | Dias do mês da janela do CDAM, para STC |
| `observacao` | Texto livre |

---

## A régua de prioridade

`utils/programacao/prioridade.js` responde a uma pergunta só: *separei 17
CAMs hoje — qual atacar primeiro?* A resposta é por **data-limite**, não
por categoria. Cada RM carrega a data em que deixa de ser atendível a
tempo:

| Motivo | Data-limite |
|---|---|
| `FORCADO` | Sem limite — fura a fila por ordem do programador |
| `PRAZO` | A data da mensagem, descontados os dias de expedição |
| `ROTA` | A véspera útil da saída do CAM (GTC) |
| `JANELA` | A véspera útil da abertura, ou o fim, da janela do CDAM (STC) |
| `FILA` | Sem limite — entra por antiguidade |

Ordenar por essa data resolve o caso difícil sem regra especial: uma
mensagem com prazo em três semanas perde para uma rota que sai amanhã,
porque perder o caminhão custa uma semana inteira e a mensagem tem folga.

**Dias úteis, não corridos** (`rotas.js → prazoDaRota`): numa rota de
segunda, a véspera corrida é domingo — data que não existe em semana
programada nenhuma, e o CAM nunca seria priorizado. Em dia útil a véspera
é a sexta anterior, que é quando o trabalho precisa estar pronto. A saída
procurada é sempre a **próxima alcançável**: se já não dá tempo para a
rota desta semana, o prazo é o da seguinte.

---

## O motor

`utils/programacao/motor.js` — função pura `programarSemana({...})`.

### Entradas

```js
programarSemana({
  semanaRef,    // segunda-feira da semana, ISO
  demandas,     // [{ id, origem, referencia, prazo, diasExpedicao, rms: [...] }]
  fila,         // fila de separação, da mais antiga para a mais nova
  capacidade,   // { porDiaSemana: {1..5}, overrides: { 'AAAA-MM-DD': n } }
  bloqueios,    // [{ data, motivo }]
  rotas,        // Map cam → configuração
  forcados,     // [cam]
  hoje
})
```

### A regra dura: um CAM, um dia

Antes de qualquer alocação: **um CAM ocupa um único dia da semana**. A
razão é operacional. Para pôr a fila no WMS, o operador monta a capa de
lote na tela AK050 marcando pedido por pedido e reserva a capa na AK300;
a fila não se corrige depois — para mudar qualquer coisa é preciso
cancelar as reservas e refazer tudo. Com o CAM inteiro num dia, cada
cliente vira um bloco contíguo: marca o bloco, monta a capa, reserva.

Duas exceções, ambas declaradas no documento:

1. **CAM maior que um dia inteiro.** Nenhum dia o comporta; ele é dividido
   no menor número de dias possível (enchendo o dia mais vazio antes de
   abrir outro), e o alerta diz que aumentar a capacidade de um dia o
   junta de novo.
2. **Dia do CAM cheio.** O excedente fica para a semana seguinte em vez de
   escorrer para outro dia. Sai contado em `sobrasPorAgrupamento`, com CAM,
   quantidade e dia.

### As três filas, em ordem

| Ordem | Fila | Regra |
|---|---|---|
| 0 | **CAM forçado** | Entra antes de tudo. O que não couber vira alerta crítico |
| 1 | **Demandas com prazo** | Da mais apertada para a mais folgada, respeitando o `limiteDeSeparacao` |
| 2 | **Resto da fila, por urgência** | Blocos de CAM ordenados pela RM mais urgente de cada um |

Na fila 2, os CAMs que já têm dia (presos por demanda ou por ordem do
programador) são processados primeiro: completar o bloco deles é o que faz
a marcação no WMS virar "filtra o CAM e marca tudo".

### Dentro do bloco, a ordem é a da tela

As RMs de um CAM são ordenadas por data de liberação e, no empate, por
número da RM — a mesma ordem em que o WMS as lista. Isso garante que o
pedaço levado na semana seja sempre o **começo** da lista do cliente, e é
o que permite ao documento dizer "marque da primeira linha até a RM X" em
vez de pedir conferência linha a linha.

### Saídas

```js
{
  dias,                  // os cinco dias úteis
  grade,                 // [{ dia, capacidade, bloqueio, manual, restante, alocacoes }]
  porCam,                // [{ cam, total, porDia }]
  gradesConsideradas,    // prestação de contas de rota/janela por CAM
  blocos,                // marcação no WMS (ver abaixo)
  sobrasPorAgrupamento,  // [{ cam, qtd, dia }]
  camsDivididos,         // [{ cam, qtd, dias }]
  naoAlocadas,           // RMs de demanda que não couberam
  alertas,               // [{ nivel: 'atencao'|'critico', texto, demandaId? }]
  resumo                 // ver tabela
}
```

Cada alocação carrega **por que está ali**: `origem`
(`FORCADO`/`MENSAGEM`/`GERENCIA`/`OUTRO`/`ROTA`/`JANELA`/`FILA`),
`justificativa` em texto, `prazo`, `demandaId`, `diasEmFila` e `entrada`.
É isso que o documento imprime e o que permite auditar uma decisão meses
depois.

#### Campos do resumo

| Campo | Significado |
|---|---|
| `totalProgramado`, `capacidadeTotal`, `ocupacao` | Volume da semana |
| `comPrazo`, `porRota`, `porAntiguidade`, `forcadas` | Composição por origem |
| `camsAtendidos` | Clientes na semana |
| `camsNoLimite`, `camsForaDoLimite`, `camsSemGrade` | Cumprimento das grades de fornecimento |
| `sobraPorAgrupamento`, `camsComSobra` | Custo da regra do CAM num dia só |
| `camsDivididos` | CAMs maiores que um dia |
| `blocosTotais`, `blocosComAvulsas`, `rmsAvulsasNaMarcacao` | Esforço de marcação no WMS |
| `filaTotal`, `reemitidasNaFila` | Tamanho e composição da fila |
| `diasBloqueados`, `folgaAteOPrazo` | Restrições da semana |

### Os blocos de marcação no WMS

Um bloco por CAM por dia — é o que o operador marca de uma vez na AK050.
Cada bloco diz **até onde marcar**:

| Cobertura | Instrução no documento |
|---|---|
| `TOTAL` | Tudo o que o CAM tem em aberto |
| `ATE_O_CORTE` | Da primeira linha até a RM do corte, sem pular nenhuma |
| `CORTE_MAIS_AVULSAS` | Até o corte **mais** as RMs nomeadas (pedidas fora de ordem por uma demanda com prazo) |
| `SOMENTE_AVULSAS` | Só as RMs nomeadas |

O cálculo despreza o que já foi reservado em dia anterior da mesma semana
— no dia do bloco, aquilo não está mais na tela. E **nunca se pede para
desmarcar**: o que está fora do trecho contínuo é marcado à parte e
listado RM a RM.

O bloco também informa `comPrazo` (quantas RMs de demanda com prazo
carrega) e `empateNoCorte` (quantas RMs do CAM dividem a data do corte —
as únicas linhas que pedem atenção se a tela não desempatar por número).

### RMs com prazo, identificadas ao longo do documento

Demanda com prazo é compromisso formal e aparece destacada em âmbar:

- na **grade por CAM**, a casa do dia mostra `88 + 6` — fila e prazo;
- nos **blocos do WMS**, na coluna "C/ prazo";
- no **Anexo A**, com a marca `PRAZO dd/mm` no cabeçalho do grupo;
- na seção **Demandas com Prazo**, que diz o que a semana faz por cada
  uma: quantas entraram, em que dias, em que CAMs e a situação
  (no prazo, parcial, atrasa, não programada).

---

## Publicação e versões

`VersoesPanel` + `utils/programacao/versoes.js`.

| Ação | Efeito |
|---|---|
| **Publicar** | Grava uma linha em `programacoes` com o snapshot inteiro da grade |
| **Remover a última versão** | Apaga só a última publicação da semana |
| **Apagar a programação** | Remove todas as versões daquela semana (pede confirmação) |

A versão 0 chama-se *Original*; as seguintes, *Alteração nº N*.

O **snapshot** guarda grade (RM a RM, com origem, justificativa, prazo,
`demandaId` e data de liberação), `porCam`, grades consideradas, blocos do
WMS, resumo, alertas, bloqueios e demandas da semana. É prova: meses
depois dá para reconstruir exatamente o documento assinado, sem depender
da planilha daquele dia.

A partir da segunda versão, `compararVersoes` produz o diff — RMs que
entraram, saíram ou mudaram de dia, bloqueios criados ou removidos e
demandas novas — que vira o Anexo B do documento.

Enquanto houver diferença entre a grade na tela e a última versão
publicada, a tela avisa: o documento sai sempre da **versão publicada**,
nunca da proposta na tela.
