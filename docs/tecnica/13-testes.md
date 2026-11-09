# 13 — Verificação

## O que é verificado hoje

| Camada | Como |
|---|---|
| Estilo e erros estáticos | `npm run lint` (ESLint + regras de hooks do React) |
| Build | `npm run build` (Vite) |
| Regras de negócio | Suítes de lógica em Node, sobre os módulos de `utils/programacao` |
| Fluxo completo | Roteiros de navegador (Playwright) contra o site em modo dev |
| Saída dos documentos | Inspeção do texto do PDF (PyMuPDF) e das planilhas (SheetJS) |

> **Lacuna conhecida.** As suítes de lógica e os roteiros de navegador
> descritos abaixo **ainda não estão versionados neste repositório**:
> rodam a partir do ambiente de desenvolvimento de quem faz a alteração.
> Trazê-los para `supply-monitor/testes/`, com `npm test`, é o próximo
> passo recomendado — está registrado em
> [Pendências](#pendências-de-engenharia).

## Como as regras de negócio são testáveis

O motor e os módulos de apoio são **funções puras**: recebem tudo por
parâmetro e não conhecem React, Supabase nem o DOM. Testar é chamar a
função com uma fila montada à mão e conferir o objeto devolvido — sem
subir banco, sem renderizar tela.

```js
const r = programarSemana({
  semanaRef: '2026-11-09',
  demandas: [], fila, capacidade, bloqueios: [], rotas, hoje: '2026-11-03'
});
// conferir: r.grade, r.blocos, r.resumo, r.alertas
```

As suítes em uso cobrem, entre outros casos:

| Suíte | Verifica |
|---|---|
| Fila de separação | Quem entra e quem não entra; as duas réguas; liberação parcial; conferência de RMs coladas |
| Agrupamento | Um CAM num dia só em todos os caminhos; CAM maior que o dia; bloco parcial como prefixo; marcação sem conferência |
| Cadeia | Prazo de mensagem × rota próxima; forçar CAM; impacto antes de confirmar; separação alimentando a Expedição |
| Rota e motor | Priorização por rota e janela; aviso de quem perde a saída |
| Linha de produção | Prazos da Expedição; estados lidos do WMS; agenda por dia |
| Reemissão | Ciclo mais novo prevalece |
| Planilhas | As abas, a ordem das RMs e as colunas de prioridade, com o SheetJS real |
| Bordas do PDF | Oito cenários degenerados (campo faltando, texto longo, CAM sem espaço) sem estourar |

## Roteiros de navegador

Sobem o site em modo dev e dirigem o Playwright com dados de exemplo —
nenhum pedido real. O ambiente de teste intercepta a rede: as planilhas
são servidas de um fixture sintético e o Supabase é substituído por um
banco em memória.

Casos cobertos: publicação da semana ponta a ponta, isolamento entre
semanas, Análise da Fila, emissão dos quatro arquivos em escala real
(mais de 30 mil linhas de WMS) e verificação de que nenhuma página
quebra.

## Checklist antes de publicar

1. `npm run lint` — limpo.
2. `npm run build` — sem erro.
3. Rodar as suítes de lógica que tocam o que foi alterado.
4. Se mexeu em documento: gerar o PDF e a planilha e **ler a saída**, não
   só conferir que o arquivo existe.
5. Se mexeu em regra de negócio: atualizar o documento correspondente em
   `docs/tecnica/` no mesmo commit.

## Dados de teste

Nunca usar planilha de produção em teste automatizado. O fixture é
gerado sinteticamente, com a mesma forma dos dados reais: milhares de RMs
expedidas para a capacidade ter histórico, fila em planejamento, RMs em
situação intermediária, conferidas aguardando retirada e canceladas.

## Pendências de engenharia

| Pendência | Por que importa |
|---|---|
| Versionar as suítes em `supply-monitor/testes/` com `npm test` | Hoje dependem do ambiente de quem alterou |
| Rodar lint, build e suítes em CI a cada push | O repositório já usa GitHub Actions para outra rotina |
| Teste de regressão visual dos PDFs | Hoje a conferência do layout é manual |
