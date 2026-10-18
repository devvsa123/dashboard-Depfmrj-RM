# Documentação para usuários

| Arquivo | Para quem |
|---|---|
| `Manual_do_Operador.pdf` | Programadores — passo a passo com telas |
| `Documentacao_da_Ferramenta.pdf` | Quem precisa entender o funcionamento e as decisões |
| `../ADMINISTRACAO.md` | Quem administra o sistema |

## Como refazer os PDFs

Os dois PDFs são gerados a partir dos arquivos HTML desta pasta. As
imagens do manual são capturas reais da ferramenta, feitas com dados de
exemplo — nenhum pedido verdadeiro aparece neles.

```bash
# 1. subir o site em modo desenvolvimento
cd supply-monitor && npx vite --port 5183

# 2. recapturar as telas (sobrescreve docs/img)
cd docs && node capturar.mjs

# 3. gerar os PDFs
node gerar_pdf.mjs manual.html Manual_do_Operador.pdf "DepFMRJ — Manual do Operador — Programação Semanal"
node gerar_pdf.mjs documentacao.html Documentacao_da_Ferramenta.pdf "DepFMRJ — Documentação da Ferramenta — Programação Semanal"
```

Refaça as capturas sempre que a interface mudar de forma visível — um
manual com telas antigas confunde mais do que ajuda.
