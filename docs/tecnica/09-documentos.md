# 09 — Documentos gerados

A programação produz quatro arquivos. Os dois PDFs são os **arquivos de
assinatura**; as planilhas são os **arquivos de manuseio** — é com elas
que o operador trabalha a reserva no WMS.

| Arquivo | Origem | Nome |
|---|---|---|
| PDF da separação | Versão publicada | `Programacao_Semanal_<semana>_<versao>.pdf` |
| Planilha da separação | Versão publicada | `Programacao_Semanal_<semana>_<versao>.xlsx` |
| PDF da Expedição | Versão publicada + WMS de agora | `Programacao_Expedicao_<semana>_<versao>.pdf` |
| Planilha da Expedição | idem | `Programacao_Expedicao_<semana>_<versao>.xlsx` |
| Planilha da Análise da Fila | WMS de agora | `Analise_da_Fila_<data>.xlsx` |

O sufixo da versão é normalizado (`versoes.js → sufixoDeArquivo`): sem
acento e sem ordinal, de modo que o par PDF/planilha tenha o mesmo nome
(`..._Alteracao_n_2`) e se reconheça na pasta.

---

## O motor de PDF

`utils/programacao/pdfTexto.js` — camada fina sobre o **jsPDF**, com
layout em milímetros (A4, margens 12/12/16/12, largura útil 186 mm).

Oferece `cabecalho`, `secao`, `paragrafo`, `texto`, `tabela`,
`gradeDeRms`, `numeros`, `assinaturas`, `tituloDeAnexo`, `regua`,
`reservar` e `salvar`. Detalhes que importam:

- **Tabelas nunca partem uma linha ao meio** e repetem o cabeçalho na
  página seguinte;
- cada célula aceita cor própria (`<chave>_cor`) e também **texto em
  pedaços de cores diferentes** (`{ partes: [{ texto, cor, forte }] }`) —
  é o que permite `88 + 6` numa casa só, fila em cinza e prazo em âmbar;
- `salvar` tem plano B: se o download programático for recusado (comum em
  navegador de celular), abre o PDF numa aba nova.

### Por que texto e não imagem

A primeira versão fotografava a tela com html2canvas. Com os números
reais o documento passava de 50 mil pixels de altura — acima do limite de
canvas do Chrome (16.384 px por lado) —, e saíam páginas em branco. O PDF
de texto não tem limite de altura, é cerca de cem vezes menor, sai
instantâneo e é **pesquisável**: dá para procurar uma RM pelo número.
Ver [12 — Decisões](12-decisoes.md).

---

## PDF da programação semanal

`utils/programacao/documentoSeparacao.js`. Seções (numeradas conforme
existam):

| Seção | Conteúdo |
|---|---|
| **Resumo da Semana** | RMs programadas, capacidade, ocupação, com prazo, CAMs atendidos e um parágrafo que explica a composição e o tamanho da fila |
| **Grade de Atendimento por CAM** | A tabela que a chefia lê: quantas RMs cada CAM recebe em cada dia. Casas com dois números separam fila (cinza) de prazo (âmbar) |
| **Montagem da Fila no WMS** | Uma linha por capa de lote: dia, bloco, CAM, RMs, quantas com prazo e **o que marcar na tela** |
| **Grades de Fornecimento Consideradas** | Por CAM: a grade dele, até quando a separação tinha de terminar, até quando foi programada e se ficou dentro |
| **Dias sem Separação** | Data e motivo |
| **Demandas com Prazo** | O que a semana faz por cada demanda: RMs, quantas entraram, em que dias, prazo, separar até e situação |
| **Observações** | Os alertas do motor, com barra âmbar (atenção) ou vermelha (crítico) |
| **Assinaturas** | Programador e Encarregado do Abastecimento |
| **Anexo A** | Relação das RMs por dia e por CAM, agrupadas por motivo, na ordem de liberação do WMS, com a data ao lado. Grupos de demanda com prazo saem marcados |
| **Anexo B** | Só a partir da 2ª versão: o que mudou — RMs que entraram, saíram, mudaram de dia, bloqueios e demandas novas |

## Planilha da programação semanal

`utils/programacao/planilhaProgramacao.js → exportarExcelSeparacao`.

| Aba | Conteúdo |
|---|---|
| **Resumo** | Os números da semana, incluindo o custo do agrupamento e o esforço de marcação |
| **Montagem no WMS** | Uma linha por capa de lote, com RM do corte, quantas no trecho e as avulsas a marcar |
| **RMs** | Uma linha por RM, na ordem do serviço: dia → cliente → data de liberação. Coluna `Prioridade` marca as de prazo |
| **Uma aba por dia** (`09-11 Seg`, …) | As RMs daquele dia, com a coluna `Bloco` indicando a ordem de montagem no WMS |
| **Grade por CAM** | A grade, com uma coluna `c/ prazo` ao lado de cada dia |
| **Grades de fornecimento** | A mesma prestação de contas do PDF |
| **Demandas com prazo** | Com dias de separação, CAMs e situação |
| **Dias sem separação**, **Observações** | Idem PDF |

As colunas abrem com largura calculada pelo conteúdo — sem isso o Excel
abre tudo com 8 caracteres e o primeiro minuto do usuário é arrastando
borda.

---

## PDF da Expedição

`utils/programacao/documentoExpedicao.js`. É uma **ordem de serviço**:
traz prazos, não andamento.

| Seção | Conteúdo |
|---|---|
| **O Que a Semana Traz** | RMs programadas, clientes, a lançar GTC, a lançar STC, entregas na semana, e a explicação dos dois prazos |
| **Índice da Semana por Cliente** | Por CAM: documento, RMs, quando chega, até quando prontificar e quando sai — separado em GTC, STC e sem rota |
| **O Que Fazer em Cada Dia** | Uma linha por cliente, com ação, documento, quantidade, prazo de prontificação e próximo passo. Um bloco por dia, mais "Depois desta semana" |
| **CAMs sem Rota Cadastrada** | Quem entrou na semana sem classificação |
| **Anexo A** | As RMs da semana por CAM e por dia de chegada, na ordem de liberação |

## Planilha da Expedição

| Aba | Conteúdo |
|---|---|
| **Resumo** | Os números da semana |
| **Agenda** | Uma linha por cliente/dia/ação, com prazos, rota e janela |
| **RMs** | Uma linha por RM, na ordem do serviço (dia de chegada → cliente → liberação) |
| **Uma aba por dia** | As RMs que chegam naquele dia |
| **Por cliente** | Visão consolidada por CAM |

---

## Quem assina o quê

O documento sai sempre da **versão publicada**, não do que está na tela.
Se houver diferença, o cartão de emissão avisa antes. Os dois documentos
são emitidos no mesmo lugar e no mesmo momento, da mesma versão: um par
de documentos assinados que não bate é pior do que não ter o segundo.
