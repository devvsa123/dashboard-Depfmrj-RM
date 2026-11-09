# Documentação técnica — Monitor Logístico DepFMRJ

Documentação de engenharia do sistema: o que cada parte faz, como as
partes conversam e por que as regras de negócio são como são.

Para o passo a passo de quem opera, ver `../Manual_do_Operador.pdf`.
Para contas, publicação e banco, ver `../../ADMINISTRACAO.md`.

## Índice

| # | Documento | Leia quando precisar… |
|---|---|---|
| 01 | [Visão geral](01-visao-geral.md) | entender o problema, os usuários e o vocabulário |
| 02 | [Arquitetura](02-arquitetura.md) | saber onde o código está e como os dados fluem |
| 03 | [Fontes de dados](03-fontes-de-dados.md) | mexer em planilha, coluna, status ou cache |
| 04 | [Indicadores e análises](04-indicadores.md) | entender as abas analíticas e suas contas |
| 05 | [Programação semanal](05-programacao.md) | alterar o motor ou as regras da semana |
| 06 | [Expedição](06-expedicao.md) | mexer em prazos de prontificação e entrega |
| 07 | [Análise da Fila](07-analise-da-fila.md) | entender o que conta como "em processamento" |
| 08 | [Andamento](08-andamento.md) | acompanhar o cumprimento do que foi publicado |
| 09 | [Documentos gerados](09-documentos.md) | mudar PDF ou planilha de saída |
| 10 | [Banco de dados](10-banco-de-dados.md) | criar tabela, política ou chave de configuração |
| 11 | [Operação](11-operacao.md) | publicar, configurar ambiente ou investigar falha |
| 12 | [Decisões de projeto](12-decisoes.md) | questionar uma regra antes de mudá-la |
| 13 | [Verificação](13-testes.md) | testar uma alteração antes de publicar |

## Como manter esta documentação

Cada documento aponta os arquivos de código de que trata. Ao mudar uma
regra de negócio, atualize o documento correspondente **no mesmo commit** —
a regra escrita em dois lugares que discordam entre si é pior do que a
regra escrita em nenhum.

Valores numéricos que mudam sozinhos (quantidade de RMs, capacidade
medida) aparecem aqui apenas como exemplo, sempre identificados como tal.
Nenhum número neste diretório deve ser lido como configuração do sistema.
