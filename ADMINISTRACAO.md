# Administração do sistema — DepFMRJ

Documento de passagem. Quem assumir a administração do dashboard precisa
só deste arquivo para manter o sistema de pé e dar acesso a novas pessoas.

---

## 1. As peças e onde elas moram

| Peça | Onde fica | Para que serve |
|---|---|---|
| Site | Vercel | O dashboard em si |
| Código | GitHub, `devvsa123/dashboard-depfmrj-rm` | Fonte do site |
| Planilhas WMS/SINGRA | Vercel Blob | Dados que o dashboard lê, publicados pelos robôs |
| Banco da programação | Supabase, projeto `nrsjnsuicztneimlauwa` | Usuários, demandas, versões publicadas |

O site não tem servidor próprio: é uma página estática que lê as planilhas
da nuvem e, na aba Programação, conversa com o Supabase.

**Contas necessárias:** uma na Vercel (dona do site) e uma no Supabase
(dona do banco). Ao passar o sistema adiante, transfira as duas ou
adicione a pessoa como membro de cada uma. Não basta entregar senhas:
registre a pessoa como membro, para o acesso sobreviver a trocas.

---

## 2. Cadastrar uma pessoa nova

É a tarefa mais frequente. São dois passos — o segundo é fácil de
esquecer e faz o nome errado sair no documento assinado.

### Passo 1 — Criar o usuário

1. Entre no Supabase e abra o projeto.
2. Menu esquerdo → **Authentication** → aba **Users**.
3. **Add user** → **Create new user**.
4. Preencha e-mail e senha (mínimo 6 caracteres).
5. **Marque a opção de confirmar o e-mail automaticamente**
   (*Auto Confirm User*). Sem isso a pessoa não consegue entrar: o
   sistema fica esperando um link de confirmação que não chega.

### Passo 2 — Definir o nome de exibição

Sem este passo, o sistema usa a parte do e-mail antes do @ como nome — e
é esse nome que vai impresso no documento como "Programador do DepFMRJ".

Menu esquerdo → **SQL Editor** → **New query** → cole, troque os dados e
clique em **Run**:

```sql
update auth.users set raw_user_meta_data =
  coalesce(raw_user_meta_data, '{}'::jsonb) || '{"nome":"SG Fulano"}'::jsonb
where email = 'email.da.pessoa@exemplo.mil.br';

select email, raw_user_meta_data ->> 'nome' as nome from auth.users order by email;
```

A conferência no fim deve mostrar a pessoa com o nome preenchido.

### Tirar o acesso de alguém

**Authentication → Users**, localize a pessoa, menu `⋯` → **Delete user**.
O histórico do que ela publicou continua intacto: as versões guardam o
nome em texto, não um vínculo que se quebre.

---

## 3. Problemas comuns

### "Banco não configurado"

As variáveis de ambiente não chegaram ao site. A própria tela mostra qual
das duas faltou. Vercel → **Settings → Environment Variables**, confira
que existem nos três ambientes:

```
VITE_SUPABASE_URL        https://nrsjnsuicztneimlauwa.supabase.co
VITE_SUPABASE_ANON_KEY   (chave anon public do projeto)
```

**Depois de salvar é obrigatório republicar** (Deployments → ⋯ →
Redeploy, sem o cache). Essas variáveis entram no site no momento em que
ele é compilado, não quando alguém abre a página.

### "E-mail ou senha incorretos"

Usuário não existe, ou a senha está errada. Para trocar a senha:
**Authentication → Users** → `⋯` no usuário → **Reset password**.

### "Este usuário ainda não confirmou o e-mail"

Faltou o *Auto Confirm* do passo 1. Corrija com:

```sql
update auth.users set email_confirmed_at = now() where email = 'o-email@exemplo.mil.br';
```

### O projeto do Supabase hibernou

O plano gratuito pausa o projeto depois de cerca de uma semana sem
nenhum acesso. O sintoma é a aba Programação parar de carregar. Entre no
painel do Supabase e clique em **Restore project** — leva alguns minutos.
Para evitar, mantenha o acesso semanal ou assine o plano pago.

### O dashboard não atualiza os dados do WMS

Os dados vêm das planilhas publicadas pelos robôs no Vercel Blob. Se a
data de "Última atualização" estiver velha, o problema é no robô, não no
dashboard. Recarregar a página força uma nova verificação.

---

## 4. A chave que fica visível no site

A chave `anon public` do Supabase vai dentro do site e **qualquer pessoa
consegue lê-la**. Isso é o desenho correto da ferramenta, não uma falha:
ela identifica o projeto e não autoriza nada sozinha. Quem protege os
dados são as regras de acesso do banco, que só liberam leitura e escrita
para quem está autenticado.

**Nunca publique a chave `service_role`.** Essa sim ignora todas as
regras de acesso. Ela aparece ao lado da outra na mesma tela do Supabase;
se for parar no site, qualquer um lê e apaga o banco inteiro.

---

## 5. Mexer no banco

A estrutura está em `supabase/schema.sql`, no repositório. O arquivo é
seguro para rodar de novo: não apaga nada existente.

Cinco tabelas:

| Tabela | Guarda |
|---|---|
| `programacoes` | Versões publicadas (Original e Alterações), com a grade inteira |
| `demandas` | Mensagens e pedidos registrados, com as RMs coladas |
| `bloqueios` | Dias sem separação, com o motivo |
| `capacidade_overrides` | Capacidade ajustada na mão para um dia |
| `config` | Preferências compartilhadas |

Todas com controle de acesso ligado: quem não está autenticado não lê
nada. Os três programadores têm o mesmo poder — não há papel de chefe no
banco, porque eles se revezam no mesmo trabalho.

Para olhar os dados sem risco de estragar: **Table Editor**, no menu
esquerdo.

---

## 6. Publicar uma mudança no código

O site republica sozinho a cada envio para o branch `main` do GitHub.
Não há passo manual de publicação.
