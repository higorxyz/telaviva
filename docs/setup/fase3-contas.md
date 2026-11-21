# Guia de contas: Firebase e Neon (Fase 3)

Este guia é para quem mantém o TelaViva e já conhece a Vercel, mas nunca usou o Firebase. Tudo aqui é gratuito (Firebase Spark, Neon Free, Vercel Hobby). Sem estas contas o site continua funcionando como visitante: o botão "Entrar" simplesmente não aparece.

Os nomes de menus e botões do Firebase e do Google Cloud mudam conforme o idioma do console e a versão, então onde o guia diz "procure por" use a busca do console ou o texto mais parecido.

Hosts do site usados neste guia:

- produção: `telaviva.vercel.app`
- preview da branch v2: `telaviva-git-v2-higorxyz-projects.vercel.app`
- local: `localhost:3000`

## 1. Firebase

### 1.1 Criar o projeto

1. Abra <https://console.firebase.google.com> e entre com a sua conta Google.
2. Clique em **Criar um projeto** (ou **Adicionar projeto**).
3. Nome: `TelaViva`. Clique em **Continuar**.
4. Desative o **Google Analytics** para este projeto e clique em **Criar projeto**. O plano é o **Spark** (gratuito), que é o padrão: não informe cartão.
5. Anote o **ID do projeto** que o Firebase gerou (por exemplo `telaviva-1a2b3`). Ele aparece em **Configurações do projeto** (engrenagem ao lado de "Visão geral do projeto") → **Geral** → "ID do projeto".

### 1.2 Ativar o login

1. No menu da esquerda: **Build** (Criação) → **Authentication** → **Vamos começar**.
2. Aba **Sign-in method** (Método de login) → **Google** → ative o interruptor **Ativar**. Escolha um e-mail de suporte do projeto e clique em **Salvar**.
3. Ainda em **Sign-in method** → **Adicionar novo provedor** → **E-mail/senha** → ative apenas a primeira opção (**E-mail/senha**). Deixe "Link por e-mail" desativado. Clique em **Salvar**.

### 1.3 Domínios autorizados

1. **Authentication** → aba **Configurações** → procure por **Domínios autorizados** → **Adicionar domínio**.
2. Adicione, um por vez:
   - `telaviva.vercel.app`
   - `telaviva-git-v2-higorxyz-projects.vercel.app`
3. `localhost` já vem na lista; não precisa adicionar.
4. Esses domínios também valem para o link do e-mail de confirmação: ele leva de volta a `/conta` no mesmo endereço em que a pessoa criou a conta.

### 1.4 Registrar o app web (configuração pública)

1. **Configurações do projeto** (engrenagem) → aba **Geral** → seção **Seus apps** → botão **</>** (Web).
2. Apelido do app: `telaviva-web`. **Não** marque "Firebase Hosting". Clique em **Registrar app**.
3. Na tela seguinte aparece um trecho `const firebaseConfig = { ... }`. Copie estes três valores:
   - `apiKey` → vai para `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `projectId` → vai para `NEXT_PUBLIC_FIREBASE_PROJECT_ID` e `FIREBASE_PROJECT_ID`
   - `appId` → vai para `NEXT_PUBLIC_FIREBASE_APP_ID`
4. Ignore `authDomain`, `storageBucket` e `messagingSenderId`: o TelaViva usa o próprio host do site como `authDomain` (veja o passo 3). Depois clique em **Continuar para o console**.

Esses três valores são públicos por natureza (vão no JavaScript do navegador), então não há problema em usá-los com `NEXT_PUBLIC_`.

### 1.5 Chave da conta de serviço (segredo do servidor)

1. **Configurações do projeto** → aba **Contas de serviço**.
2. Em "Firebase Admin SDK" deixe **Node.js** selecionado e procure por **Gerar nova chave privada** (botão) e confirme em **Gerar chave**. O navegador baixa um arquivo `.json`.
3. Abra o arquivo. Dele você precisa de dois campos:
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (texto longo que começa com `-----BEGIN PRIVATE KEY-----`; no JSON as quebras de linha aparecem como `\n`)
4. Guarde o arquivo fora da pasta do projeto (ou apague-o depois de copiar). Não envie por e-mail nem chat.

### 1.6 Conferir o URI de redirecionamento do Google

O TelaViva faz o login do Google pelo próprio host (via `/__/auth`, veja o passo 3). Confira:

Localmente (`http://localhost:3000`) não é preciso cadastrar nada: o login usa o handler hospedado pelo Firebase (`https://<ID-DO-PROJETO>.firebaseapp.com/__/auth/handler`), que já vem cadastrado. O URI `http://localhost:3000/__/auth/handler` **não** é necessário.

Nos hosts da Vercel, como `authDomain` é o host do próprio site, o navegador envia ao Google `redirect_uri=https://<host>/__/auth/handler`. Se esse endereço não estiver cadastrado, o login com Google falha com "redirect_uri_mismatch".

1. Abra <https://console.cloud.google.com> com a mesma conta e selecione o projeto do Firebase no seletor no topo.
2. No menu, procure por **Credenciais** (em **APIs e serviços**). Em "IDs do cliente OAuth 2.0", procure por **Web client (auto created by Google Service)**, o cliente criado automaticamente pelo Firebase, e abra-o. Se ele não aparecer, volte ao passo 1.2 e ative o provedor Google no Firebase primeiro: é isso que cria o cliente.
3. Em **URIs de redirecionamento autorizados** (procure por esse título), adicione, **obrigatoriamente um para cada host do site**:
   - `https://telaviva.vercel.app/__/auth/handler`
   - `https://telaviva-git-v2-higorxyz-projects.vercel.app/__/auth/handler`
4. Mantenha o que já existe (`https://<ID-DO-PROJETO>.firebaseapp.com/__/auth/handler`) e clique em **Salvar**. A alteração pode levar alguns minutos para valer.

## 2. Neon (banco Postgres) pela Vercel

1. Abra o painel da Vercel → projeto **telaviva** → aba **Storage**.
2. **Create Database** → escolha **Neon** (Postgres) → plano **Free** → siga o assistente (região **São Paulo**, `sa-east-1`: as funções do site rodam em São Paulo, `gru1` no `vercel.json`, e cada pedido da lista conversa com o banco) → **Create**.
3. Na tela de conexão, marque os ambientes **Preview** e **Development** e confirme. Você pode marcar Production depois, na hora de publicar.
4. A integração cria a variável `DATABASE_URL` sozinha. Para conferir: projeto → **Settings** → **Environment Variables**.
5. Para usar o banco localmente, copie o valor: **Settings** → **Environment Variables** → `DATABASE_URL` → ícone de olho (mostrar) → copiar. Se preferir, rode `vercel env pull .env.local` na pasta do projeto.

## 3. Variáveis de ambiente na Vercel (ambiente Preview)

Projeto **telaviva** → **Settings** → **Environment Variables**. Para cada linha, clique em **Add New**, desmarque **Production** e **Development** e deixe marcado só **Preview**. Em **Preview**, escolha **Select a custom Preview branch** e informe `v2`: assim as variáveis valem só para a branch `v2`, cujo host é o `telaviva-git-v2-higorxyz-projects.vercel.app` do `AUTH_DOMAIN`. Outras URLs de preview (de outras branches ou de deploys avulsos) não terão login. Marque `FIREBASE_PRIVATE_KEY` e `DATABASE_URL` como **Sensitive** (opção na hora de criar a variável).

| Variável | Valor | De onde vem |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` | passo 1.4 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` | passo 1.4 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` | passo 1.4 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `telaviva-git-v2-higorxyz-projects.vercel.app` | o host do preview, sem `https://` |
| `FIREBASE_PROJECT_ID` | `projectId` | passo 1.4 |
| `FIREBASE_CLIENT_EMAIL` | `client_email` | passo 1.5 |
| `FIREBASE_PRIVATE_KEY` | `private_key` | passo 1.5 |
| `DATABASE_URL` | URL do Neon | já criada no passo 2 |

Notas:

- **`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` deve ser igual ao host de cada ambiente.** O site repassa `/__/auth/*` para o Firebase (proxy), e é isso que faz o login funcionar no Safari/iOS e no app instalado sem cookies de terceiros. Se o domínio for o do Firebase (`*.firebaseapp.com`) ou o de outro ambiente, o login por redirecionamento quebra. No preview use o host do preview; em produção (quando for a hora) use `telaviva.vercel.app`.
- **`FIREBASE_PRIVATE_KEY`:** cole o valor **exatamente como aparece no JSON**, com os `\n` literais (barra invertida seguida de `n`), sem aspas e em uma única linha. O servidor converte esses `\n` em quebras de linha reais.
- Depois de criar ou alterar variáveis, é preciso **um novo deploy** (aba **Deployments** → menu `...` do último deploy → **Redeploy**) para elas valerem.
- `TMDB_READ_TOKEN` continua sendo obrigatória, como já era.

## 4. `.env.local` (desenvolvimento local)

Crie o arquivo `.env.local` na raiz do projeto (ele já está no `.gitignore`) com estas variáveis, preenchidas com os mesmos valores do passo 3:

```
TMDB_READ_TOKEN=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<ID-DO-PROJETO>.firebaseapp.com
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
DATABASE_URL=
```

Atenção ao local: use `<ID-DO-PROJETO>.firebaseapp.com` em `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, porque o SDK do Firebase sempre abre `https://<authDomain>/__/auth/handler` e o servidor local roda em `http`. Se você deixar `localhost:3000` (ou `127.0.0.1`), o site troca automaticamente por `<ID-DO-PROJETO>.firebaseapp.com`. O `FIREBASE_PRIVATE_KEY` também vai com os `\n` literais, numa linha só.

**Login por `http://` só funciona em `localhost`.** Os cookies de sessão levam `Secure` em qualquer outro endereço, e o navegador descarta cookie `Secure` recebido por `http`. Por isso, abrir o servidor local pelo celular na rede (`http://192.168.x.x:3000`) mostra o site, mas o login não "pega": a sessão some no próximo pedido. Para testar o login no celular, use o preview da Vercel (que é `https`).

Para desenvolver sem usar a conta real, existe o emulador do Firebase Auth: `npm run emulators` (porta 9099). Ele não precisa de chave nenhuma. Os testes automatizados (`npm run e2e`) sobem o emulador sozinhos e usam um PGlite (Postgres dentro do processo, em `.e2e/pglite`), nunca as contas reais.

## 5. Migrações do banco

Com `DATABASE_URL` definido (no `.env.local` ou no terminal), crie as tabelas no Neon:

```
npm run db:migrate -- --confirm
```

O script imprime o alvo (`Migrando: Neon (<host>)`, sem senha) antes de aplicar. Em um banco Neon ele exige `--confirm` (ou `MIGRATE_CONFIRM=1`), porque o `.env.local` pode apontar para a produção; sem a confirmação ele só mostra o alvo e sai com erro.

Rode de novo sempre que o esquema mudar (cada migração é aplicada só uma vez). Para gerar uma migração nova depois de editar o esquema, use `npm run db:generate`.

## 6. O que nunca fazer

- **Nunca** commite o arquivo `.json` da conta de serviço, a `private_key`, o `.env.local` ou o `DATABASE_URL`.
- **Nunca** coloque a chave privada, o `client_email` ou o `DATABASE_URL` em variável com prefixo `NEXT_PUBLIC_`: tudo que tem esse prefixo vai para o navegador de qualquer visitante.
- **Nunca** cole esses valores em issues, PRs, prints ou conversas.
- **Não** adicione restrição por "referenciadores HTTP" à chave de API web (`NEXT_PUBLIC_FIREBASE_API_KEY`) no Google Cloud: o servidor usa essa chave para pedir o e-mail de nova senha, e a restrição faria esse envio falhar sem aviso.
- Se a chave vazar: Firebase → **Configurações do projeto** → **Contas de serviço** → procure por **Gerenciar permissões da conta de serviço** (abre o Google Cloud) → **Chaves** → apague a chave comprometida e gere outra.
- **Não** atualize o `firebase-admin` para a versão 14 ou superior por enquanto: ele fica fixado em 13.x (versão exata no `package.json`) até que o `jwks-rsa`/`jose` voltem a funcionar no runtime da Vercel. O `firebase-admin@14` depende do `jwks-rsa@4`, que usa `require()` em um módulo ESM (`jose@6`), e o runtime Node da Vercel recusa isso (`ERR_REQUIRE_ESM`), o que derruba as rotas `/api/auth/*` com erro 500. Localmente funciona, então o problema só aparece no deploy. Para conferir antes de atualizar: `node --no-experimental-require-module -e "require('firebase-admin/auth')"`.
