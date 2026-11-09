# 12 — Decisões de projeto

Por que cada regra é como é. Mudar qualquer uma delas sem entender o
custo original tende a reintroduzir o problema que ela resolveu.

---

## D1 — A fila de separação é só `EM PLANEJAMENTO`

**Contexto.** A fila era montada com tudo que não fosse conferido,
expedido ou cancelado, o que levava junto as RMs reservadas, em separação,
separadas e em conferência.

**Problema.** Essas já entraram na fila do WMS: têm capa de lote e
reserva. Reprogramá-las mandaria o operador montar uma capa que já existe,
e inflava a fila com trabalho em andamento.

**Decisão.** A programação parte só do primeiro status do ciclo. O meio do
processo é medido na Análise da Fila; o cumprimento da semana, no
Andamento. As contas não se sobrepõem.

**Consequência.** Existem três recortes de "fila" no sistema, cada um com
o seu lugar — a aba RM em processamento usa um quarto, mais largo, que
inclui as conferidas. Cada tela diz qual está usando.

---

## D2 — Um CAM ocupa um dia só da semana

**Contexto.** Para pôr a fila no WMS, o operador monta a capa de lote na
tela AK050 marcando pedido por pedido e reserva na AK300. A fila não se
corrige depois: mudar qualquer coisa exige cancelar as reservas e refazer
tudo.

**Decisão.** O motor aloca blocos de CAM, não RMs soltas: um CAM ocupa um
único dia. Exceção única, por impossibilidade física: CAM maior que um dia
inteiro é dividido no menor número de dias.

**Custo, medido.** O excedente de um CAM cujo dia encheu não escorre para
outro dia — fica para a semana seguinte. O motor conta e nomeia esse custo
(`sobrasPorAgrupamento`), e a saída está escrita no alerta: aumentar a
capacidade daquele dia.

---

## D3 — O bloco é sempre o **começo** da lista do cliente

**Contexto.** Agrupar o CAM num dia não bastava. A tela do WMS lista tudo
o que o cliente tem em aberto, por antiguidade, e o operador ainda
precisava conferir linha por linha quais daquelas RMs estavam na
programação.

**Decisão.** Dentro de um CAM, as RMs são tomadas na ordem da tela (data
de liberação e, no empate, número da RM). Assim o pedaço levado na semana
é sempre um prefixo, e o documento pode dizer "marque da primeira linha
até a RM X".

**Tentativa descartada.** Exigir o CAM inteiro ou nada. Medido: a semana
caiu de 519 para 341 RMs, com um dia ocioso. Bloco parcial é aceitável
desde que seja prefixo.

**Caso residual.** Quando uma mensagem com prazo nomeia RMs do meio da
fila, o bloco vira "trecho contínuo + avulsas nomeadas". Nunca se pede
para desmarcar: somar três RMs nomeadas é um minuto, conferir setenta e
cinco era o problema original.

---

## D4 — Prioridade por data-limite, não por categoria

Uma mensagem com prazo em três semanas perde para uma rota que sai
amanhã, porque perder o caminhão custa uma semana inteira de espera e a
mensagem ainda tem folga. O contrário também vale. Ordenar por data-limite
resolve o caso difícil sem regra especial.

---

## D5 — Prazos de rota em dias úteis

Numa rota de segunda, a véspera corrida é domingo — data que não cai em
semana programada nenhuma, de modo que o CAM nunca seria priorizado e o
depósito separaria para ele sempre depois do caminhão passar. Em dia útil
a véspera é a sexta anterior, que é quando o trabalho precisa estar
pronto. E a saída procurada é a próxima **alcançável**: prometer um
caminhão que já passou não ajuda ninguém.

---

## D6 — A rota não encurta o prazo de prontificação

Prontificar (lançar STC/GTC) e entregar são trabalhos diferentes, cada um
com a sua data. Misturar os dois escondia a conta: um CAM com rota amanhã
passava a ter "prontificar até amanhã", e a Expedição perdia a referência
do próprio prazo. O prazo de prontificação é fixo — 3 dias úteis da
chegada, ou o prazo da mensagem. Nas linhas que entregam no mesmo dia, o
documento avisa que a GTC precisa estar lançada antes de o caminhão sair.

---

## D7 — Capacidade por média, não por mediana

A operação trabalha em batelada: há segundas com 677 RMs e segundas com
zero. A mediana de cada dia somaria cerca de 275 RMs/semana enquanto a
vazão real passa de 420 — planejar pela mediana subestimaria a semana em
mais de um terço. Dias parados entram como zero, porque feriado faz parte
da vazão média de um dia daquele tipo.

---

## D8 — Documentos em PDF de texto, não em imagem

A primeira versão fotografava a tela com html2canvas. Com números reais o
documento chegava a 53 mil pixels de altura, contra o limite de 16.384 px
por lado do canvas do Chrome: saíam dezenas de páginas em branco.

O PDF de texto não tem limite de altura, é cerca de cem vezes menor, sai
instantâneo e é pesquisável — dá para achar uma RM pelo número com
Ctrl+F. O custo é manter um motor de layout próprio (`pdfTexto.js`), que
se pagou na primeira semana.

---

## D9 — O documento traz prazos; o andamento fica na tela

Na emissão, todas as RMs estão em processamento. Estado de pedido num
documento assinado não informa nada e tira espaço do que importa. O
acompanhamento do que já foi feito está na aba Andamento, que lê o WMS ao
vivo.

---

## D10 — O documento sai da versão publicada, nunca da tela

Publicar é o ato que congela a decisão. O snapshot guarda a grade inteira,
RM a RM, e é dele que saem os documentos e o acompanhamento. Enquanto
houver diferença entre a tela e a última versão, o sistema avisa antes de
emitir.

---

## D11 — Quem manda na fila é o tratamento, não o documento

O Núcleo de Implantação é retirada por terceiro (tratamento STC) e mesmo
assim o documento lançado no WMS é GTC. A primeira versão roteava pela
coluna do documento e esse CAM sumia da fila de cobrança. Por isso
`tratamento` e `documento_esperado` são campos separados: o primeiro
define a fila, o segundo serve para apontar divergência com o WMS.

---

## D12 — Reemissão conta pelo ciclo mais novo

Uma RM cancelada que volta tem nova data de entrada. Somar os dois ciclos
faria uma RM reaberta ontem parecer de meses atrás e furar a fila de quem
espera de verdade; e, no sentido contrário, manteria em fila uma RM cujo
ciclo novo já foi expedido. Vale o ciclo mais recente, e a RM fica
marcada como reemitida para explicar o salto na tela.

---

## D13 — Tudo ordenado pela data de liberação

A `DATA_ENTRADA` é a ordem em que o WMS mostra as RMs. Listas em qualquer
outra ordem obrigam o operador a procurar. Anexos, abas de Excel e blocos
de marcação seguem essa ordem, com a data ao lado de cada RM.

---

## D14 — Informação de uma semana não vaza para outra

Demandas, dias sem separação e CAMs forçados pertencem à semana em que
foram registrados (coluna `semana` nas demandas, chave
`forcados:<semana>` na configuração). Antes disso, uma mensagem colada
numa semana reaparecia em todas as seguintes e o programador via a tela de
outra semana já preenchida.

---

## D15 — O motor nunca decide sozinho o que sacrificar

Quando a demanda com prazo não cabe, o motor aloca o que couber e devolve
o conflito escrito, com nome, número e dia. O validador é o programador.
Toda regra que custa alguma coisa — agrupamento, rota perdida, CAM
dividido — aparece nas observações do documento com a saída proposta.
