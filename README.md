# Monitor Logístico — DepFMRJ

Painel de acompanhamento e programação do Depósito de Fardamento da Marinha
no Rio de Janeiro. Reúne num só lugar os dados do **WMS** (o sistema de
armazém) e do **SINGRA** (o sistema de abastecimento da Marinha), e sobre
eles constrói a programação semanal de separação e a ordem de serviço da
Expedição.

O sistema responde a quatro perguntas de rotina:

| Pergunta | Onde |
|---|---|
| Como está o atendimento? | Aba **Indicadores** |
| O que está parado e há quanto tempo? | Abas **RM em processamento** e **Análise da Fila** |
| O que o depósito vai separar nesta semana, e por quê? | Aba **Programação** |
| O que a Expedição faz em cada dia? | Subaba **Expedição** |

---

## Visão rápida

```
Planilhas (robôs)            Navegador                      Supabase
┌────────────────┐           ┌─────────────────────────┐    ┌──────────────┐
│ planilha_      │  /api/    │ React 19 + Vite         │    │ auth.users   │
│  estoque.xls   │ planilhas │  · hooks de análise     │◄──►│ programacoes │
│ planilha_rms_  │──────────►│  · motor de programação │    │ demandas     │
│  unificada.csv │           │  · geração de PDF/Excel │    │ cam_config … │
└────────────────┘           └─────────────────────────┘    └──────────────┘
  repositório privado          hospedado na Vercel            Postgres + RLS
```

Não há servidor de aplicação: o site é estático e faz todo o processamento
no navegador. A única função de servidor (`api/planilhas/[arquivo].js`)
existe para buscar as planilhas no repositório privado sem expor o token.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Interface | React 19, Vite 7, Tailwind CSS 3.4, lucide-react |
| Gráficos | Recharts 3 |
| Planilhas | SheetJS (`xlsx`), carregado por CDN em tempo de execução |
| PDF | jsPDF 4 (documentos da programação) e html2pdf (relatório do painel) |
| Banco e autenticação | Supabase (PostgreSQL + Auth + RLS) |
| IA (opcional) | Google Gemini, na análise textual dos indicadores |
| Hospedagem | Vercel (site estático + função serverless) |

---

## Estrutura do repositório

```
├── api/planilhas/[arquivo].js   Função serverless que serve WMS, SINGRA e o par da interface
├── docs/                        Documentação (ver abaixo)
├── supabase/                    schema.sql, rotas_iniciais.sql, usuarios.sql
├── supply-monitor/              A aplicação React
│   └── src/
│       ├── components/          Telas e cartões
│       │   └── programacao/     Módulo de programação semanal
│       ├── hooks/               Carga de dados e análises
│       ├── utils/               Funções puras
│       │   └── programacao/     Motor, documentos, regras de negócio
│       └── lib/supabase.js      Cliente do banco
├── .github/workflows/           Rotina diária que evita a hibernação do banco
└── vercel.json                  Comandos de build da hospedagem
```

---

## Rodando localmente

```bash
cd supply-monitor
npm install
npm run dev        # http://localhost:5173
npm run lint       # ESLint
npm run build      # build de produção em supply-monitor/dist
```

A aba Programação exige banco. Crie `supply-monitor/.env` com:

```
VITE_SUPABASE_URL=https://<projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<chave anon public>
```

As duas variáveis são embutidas no **build** — mudá-las exige publicar de
novo. Para as planilhas em ambiente local, ver
[docs/tecnica/11-operacao.md](docs/tecnica/11-operacao.md).

---

## Documentação

### Técnica — como o sistema funciona por dentro

| Documento | Conteúdo |
|---|---|
| [01 — Visão geral](docs/tecnica/01-visao-geral.md) | Propósito, usuários, escopo e glossário do domínio |
| [02 — Arquitetura](docs/tecnica/02-arquitetura.md) | Camadas, fluxo de dados, módulos e build |
| [03 — Fontes de dados](docs/tecnica/03-fontes-de-dados.md) | Planilhas, colunas, status, cache e sincronização |
| [04 — Indicadores e análises](docs/tecnica/04-indicadores.md) | As abas analíticas e suas métricas |
| [05 — Programação semanal](docs/tecnica/05-programacao.md) | O motor, suas regras e a publicação |
| [06 — Expedição](docs/tecnica/06-expedicao.md) | Filas, projeção e prazos da linha de produção |
| [07 — Análise da Fila](docs/tecnica/07-analise-da-fila.md) | O que está em processamento agora |
| [08 — Andamento](docs/tecnica/08-andamento.md) | Cumprimento da semana publicada |
| [09 — Documentos gerados](docs/tecnica/09-documentos.md) | PDFs de assinatura e planilhas de manuseio |
| [10 — Banco de dados](docs/tecnica/10-banco-de-dados.md) | Tabelas, RLS, chaves de configuração |
| [11 — Operação](docs/tecnica/11-operacao.md) | Deploy, variáveis, rotina e solução de problemas |
| [12 — Decisões de projeto](docs/tecnica/12-decisoes.md) | Por que cada regra é como é |
| [13 — Verificação](docs/tecnica/13-testes.md) | Como o sistema é testado |

### Para quem usa e para quem administra

| Documento | Para quem |
|---|---|
| [docs/Manual_do_Operador.pdf](docs/Manual_do_Operador.pdf) | Programadores — passo a passo com telas |
| [docs/Documentacao_da_Ferramenta.pdf](docs/Documentacao_da_Ferramenta.pdf) | Quem precisa entender o funcionamento e as decisões |
| [ADMINISTRACAO.md](ADMINISTRACAO.md) | Quem administra contas, banco e publicação |

---

## Convenções do código

- **Idioma**: domínio e comentários em português; termos do WMS mantidos
  como aparecem no sistema (`CONFERIDO`, `EM PLANEJAMENTO`, `STC`, `GTC`).
- **Datas**: sempre ISO `AAAA-MM-DD` em memória, sem fuso. A formatação
  brasileira acontece só na exibição (`utils/programacao/semana.js`).
- **Funções puras em `utils/`**, efeitos e estado em `hooks/`, apresentação
  em `components/`. O motor de programação não conhece React nem o banco.
- **Comentários explicam o porquê**, não o quê. Regra de negócio sem
  justificativa escrita é regra que ninguém poderá mudar com segurança
  depois.
