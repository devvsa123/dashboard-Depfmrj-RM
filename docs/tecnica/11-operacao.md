# 11 — Operação

Runbook técnico. Para contas, cadastro de pessoas e tarefas do dia a dia
da administração, ver [`../../ADMINISTRACAO.md`](../../ADMINISTRACAO.md).

## Ambientes

| Peça | Onde |
|---|---|
| Site | Vercel, build a partir da branch `main` |
| Código | GitHub, `devvsa123/dashboard-depfmrj-rm` |
| Planilhas | Repositório **privado** do GitHub, publicadas pelos robôs |
| Banco | Supabase (PostgreSQL + Auth) |

## Variáveis de ambiente

### Do site (embutidas no build — exigem publicar de novo)

| Variável | Para quê |
|---|---|
| `VITE_SUPABASE_URL` | Endereço do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave `anon public` (pública por desenho) |

Se faltarem, a aba Programação explica qual delas falta em vez de só
falhar.

### Da função de planilhas (só no servidor — **nunca** com prefixo `VITE_`)

| Variável | Padrão | Para quê |
|---|---|---|
| `GITHUB_STORAGE_REPO` *ou* `GITHUB_OWNER` + `GITHUB_REPO` | — | Repositório privado das planilhas |
| `GITHUB_STORAGE_TOKEN` *ou* `GITHUB_TOKEN` | — | Token com leitura naquele repositório |
| `GITHUB_STORAGE_BRANCH` / `GITHUB_BRANCH` | `main` | Branch de onde ler |
| `GITHUB_STORAGE_PASTAS` | `dados_wms,dados_singra` | Pastas a procurar, além da raiz |
| `GITHUB_PASTA_INTERFACE` | `dados_interface` | Pasta do par WMS x SINGRA (aba Interface); deve ser a mesma do `.env` do robô |
| `GITHUB_API_URL` | `https://api.github.com` | Para GitHub Enterprise |

O token fica só no servidor: sem o prefixo `VITE_`, o Vite não o embute no
pacote do navegador.

### Segredos do GitHub Actions

`SUPABASE_URL` e `SUPABASE_ANON_KEY`, cadastrados em **Repository
secrets** (não em Environment secrets — segredo cadastrado lá não chega ao
workflow).

## Publicar

```bash
git push origin main      # a Vercel constrói e publica
```

Build local equivalente:

```bash
cd supply-monitor && npm ci && npm run lint && npm run build
```

Rode o lint antes de publicar: o build não falha por variável não usada,
mas o código entra no repositório.

## Rotina semanal do programador

1. Abrir a aba **Programação** (a semana aberta é a seguinte à atual).
2. Conferir a **capacidade** medida e ajustar o dia se for o caso.
3. Registrar **demandas com prazo** e **dias sem separação**.
4. Forçar um CAM, se houver emergência — vendo a simulação antes.
5. Ler a **grade** proposta e as **observações**.
6. **Publicar** (Original).
7. Baixar os **quatro arquivos**: PDF e Excel da separação e da Expedição.
8. Durante a semana, acompanhar em **Andamento**; se mudar algo, publicar
   uma **Alteração** e reemitir.

## Verificações de saúde

| O quê | Como |
|---|---|
| As planilhas estão chegando? | `GET /api/planilhas/status` diz onde cada uma foi achada e de quando é |
| O banco está acordado? | A aba Actions mostra a execução diária "Manter o banco acordado" |
| O site publicou? | Painel da Vercel, último deploy da `main` |

## Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Dados parecem antigos | Cache do IndexedDB; só um `Last-Modified` novo o invalida | Conferir em `/api/planilhas/status` de quando é o arquivo; se o arquivo é novo e a tela não, limpar os dados do site (IndexedDB `SupplyMonitorDB`) e recarregar |
| "Erro ao carregar motor de Excel" | CDN do SheetJS bloqueada | Liberar `cdn.sheetjs.com` na rede |
| Aba Programação pede configuração | Falta `VITE_SUPABASE_*` **no build** | Cadastrar e publicar de novo |
| Login recusado | Usuário sem *Auto Confirm* | Confirmar o usuário no painel do Supabase |
| Nome errado no documento assinado | Falta `nome` no metadata do usuário | Rodar `supabase/usuarios.sql` |
| Banco fora do ar numa segunda | Projeto hibernou | Painel do Supabase → *Restore project*; conferir o workflow diário |
| Aba Interface com faixa amarela "Par WMS × SINGRA indisponível" | O robô do SINGRA ainda não publicou `dados_interface/` (primeiro ciclo depois da atualização do robô, `DESTINO_SINGRA` sem `github`, ou `GITHUB_PASTA_INTERFACE` diferente nos dois lados) | `GET /api/planilhas/status`: `wms-par` e `singra-par` devem estar `achado: true`; conferir o log do robô por "par da interface atualizado" |
| Planilha não encontrada (404 na função) | Nome ou pasta diferentes no repositório privado | Conferir `GITHUB_STORAGE_PASTAS` e o nome do arquivo |
| PDF não baixa no celular | Download programático recusado | O sistema abre o PDF numa aba nova; salvar dali |
| Um CAM não é priorizado nunca | Sem rota cadastrada (`PENDENTE`) | Cadastrar em **CAM e Rotas** |
| Um CAM aparece em dois dias | Ele é maior que um dia inteiro | Aumentar a capacidade de um dia, ou aceitar a divisão (está nas observações) |

## Manutenção periódica

| Quando | O quê |
|---|---|
| Ao entrar CAM novo no WMS | Cadastrar tratamento, rota ou janela |
| Ao mudar o quadro de rotas | Atualizar **CAM e Rotas** — é dele que sai a priorização |
| Ao mudar a interface | Recapturar as telas do manual (`docs/README.md`) |
| Semestralmente | Revisar a janela de medição da capacidade |
