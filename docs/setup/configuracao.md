# Guia de configuração: TMDb, Firebase, Neon e Vercel

Este é o guia único para configurar o TelaViva: do `.env.local` de quem vai rodar o projeto até as variáveis de produção
na Vercel. Ele é para quem mantém o site e já conhece a Vercel, mas nunca usou o Firebase. Tudo aqui é gratuito
(Firebase Spark, Neon Free, Vercel Hobby).

**As contas são opcionais.** Só o token do TMDb é obrigatório. Sem o Firebase e o banco, o site funciona como visitante,
com a lista guardada no navegador, e o botão "Entrar" não aparece. Mas é tudo ou nada: com só parte das variáveis de
conta, o login também fica desligado. `npm run env:check` aponta o que falta.

Os nomes de menus e botões do Firebase e do Google Cloud mudam conforme o idioma do console e a versão. Onde o guia diz
"procure por", use a busca do console ou o texto mais parecido.

Hosts do site usados neste guia:

- produção: `telaviva.vercel.app`
- preview da branch v2: `telaviva-git-v2-higorxyz-projects.vercel.app`
- local: `localhost:3000`

## 0. Conferir as variáveis: `npm run env:check`

```
npm run env:check                         # o que o `next dev` enxerga (.env.local e os outros .env*), alvo local
npm run env:check -- --target=preview
npm run env:check -- --target=production --file=.env.production.local
```

O comando lista **só os nomes** das variáveis ausentes ou malformadas, nunca os valores, e sai com erro quando falta
alguma coisa. As regras por alvo ficam documentadas em `src/lib/check-env.ts`:

| Variável                                                          | local        | preview      | production   |
| ----------------------------------------------------------------- | ------------ | ------------ | ------------ |
| `TMDB_READ_TOKEN`                                                 | obrigatória  | obrigatória  | obrigatória  |
| `NEXT_PUBLIC_SITE_URL`                                            | opcional     | opcional     | obrigatória  |
| Firebase (7 variáveis) e `DATABASE_URL`                           | tudo ou nada | tudo ou nada | obrigatórias |
| `TMDB_API_BASE_URL`, `TMDB_TIMEOUT_MS`, `NEXT_PUBLIC_SW_DISABLED` | opcionais    | opcionais    | opcionais    |
| emulador do Auth, `DATABASE_DRIVER=pglite`                        | permitidos   | proibidos    | proibidos    |

Também conta como inválida: uma `FIREBASE_PRIVATE_KEY` sem o formato de chave, um `NEXT_PUBLIC_SITE_URL` que não é URL e
um `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` com `localhost` fora da máquina local (em produção, ele precisa ser o mesmo host do
`NEXT_PUBLIC_SITE_URL`). Localmente, `DATABASE_DRIVER=pglite` dispensa `DATABASE_URL`.

Para conferir as variáveis da Vercel, baixe-as num arquivo, rode a checagem e apague o arquivo:

```
vercel env pull .env.production.local --environment=production
npm run env:check -- --target=production --file=.env.production.local
rm .env.production.local
```

Variáveis marcadas como **Sensitive** na Vercel não podem ser lidas de volta e vêm vazias nesse arquivo: a checagem as
lista como ausentes. Para essas (`FIREBASE_PRIVATE_KEY` e `DATABASE_URL`), confira no painel que existem no ambiente
certo.

## 1. TMDb

1. Crie uma conta em <https://www.themoviedb.org> e abra **Configurações** → **API**.
2. Peça uma chave de desenvolvedor (uso pessoal, gratuito).
3. Copie o **Token de Leitura da API** (o token longo, "API Read Access Token"), não a "Chave da API" curta. Ele vai para
   `TMDB_READ_TOKEN` e só é usado no servidor, como `Authorization: Bearer`.

## 2. Firebase

### 2.1 Criar o projeto

1. Abra <https://console.firebase.google.com> e entre com a sua conta Google.
2. Clique em **Criar um projeto** (ou **Adicionar projeto**).
3. Nome: `TelaViva`. Clique em **Continuar**.
4. Desative o **Google Analytics** para este projeto e clique em **Criar projeto**. O plano é o **Spark** (gratuito),
   que é o padrão: não informe cartão.
5. Anote o **ID do projeto** que o Firebase gerou (por exemplo `telaviva-1a2b3`). Ele aparece em **Configurações do
   projeto** (engrenagem ao lado de "Visão geral do projeto") → **Geral** → "ID do projeto".

### 2.2 Ativar o login

1. No menu da esquerda: **Build** (Criação) → **Authentication** → **Vamos começar**.
2. Aba **Sign-in method** (Método de login) → **Google** → ative o interruptor **Ativar**. Escolha um e-mail de suporte
   do projeto e clique em **Salvar**.
3. Ainda em **Sign-in method** → **Adicionar novo provedor** → **E-mail/senha** → ative apenas a primeira opção
   (**E-mail/senha**). Deixe "Link por e-mail" desativado. Clique em **Salvar**.

Não ative o reCAPTCHA (proteção contra abuso do login) sem rever a CSP: ele carrega scripts e iframes de hosts que a
política atual não libera (`src/lib/security-headers.ts`).

### 2.3 Domínios autorizados

1. **Authentication** → aba **Configurações** → procure por **Domínios autorizados** → **Adicionar domínio**.
2. Adicione, um por vez:
   - `telaviva.vercel.app`
   - `telaviva-git-v2-higorxyz-projects.vercel.app`
3. `localhost` já vem na lista; não precisa adicionar.
4. Esses domínios também valem para o link do e-mail de confirmação: ele leva de volta a `/conta` no mesmo endereço em
   que a pessoa criou a conta.

### 2.4 Registrar o app web (configuração pública)

1. **Configurações do projeto** (engrenagem) → aba **Geral** → seção **Seus apps** → botão **</>** (Web).
2. Apelido do app: `telaviva-web`. **Não** marque "Firebase Hosting". Clique em **Registrar app**.
3. Na tela seguinte aparece um trecho `const firebaseConfig = { ... }`. Copie estes três valores:
   - `apiKey` → vai para `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `projectId` → vai para `NEXT_PUBLIC_FIREBASE_PROJECT_ID` e `FIREBASE_PROJECT_ID`
   - `appId` → vai para `NEXT_PUBLIC_FIREBASE_APP_ID`
4. Ignore `authDomain`, `storageBucket` e `messagingSenderId`: o TelaViva usa o próprio host do site como `authDomain`
   (veja a seção 4). Depois clique em **Continuar para o console**.

Esses três valores são públicos por natureza (vão no JavaScript do navegador), então não há problema em usá-los com
`NEXT_PUBLIC_`.

### 2.5 Chave da conta de serviço (segredo do servidor)

1. **Configurações do projeto** → aba **Contas de serviço**.
2. Em "Firebase Admin SDK" deixe **Node.js** selecionado, procure por **Gerar nova chave privada** (botão) e confirme
   em **Gerar chave**. O navegador baixa um arquivo `.json`.
3. Abra o arquivo. Dele você precisa de dois campos:
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (texto longo que começa com `-----BEGIN PRIVATE KEY-----`; no JSON as
     quebras de linha aparecem como `\n`)
4. Guarde o arquivo fora da pasta do projeto (ou apague-o depois de copiar). Não envie por e-mail nem chat.

### 2.6 URIs de redirecionamento do Google

O TelaViva faz o login do Google pelo próprio host (via `/__/auth`, veja a seção 4).

Localmente (`http://localhost:3000`) não é preciso cadastrar nada: o login usa o handler hospedado pelo Firebase
(`https://<ID-DO-PROJETO>.firebaseapp.com/__/auth/handler`), que já vem cadastrado. O URI
`http://localhost:3000/__/auth/handler` **não** é necessário.

Nos hosts da Vercel, como `authDomain` é o host do próprio site, o navegador envia ao Google
`redirect_uri=https://<host>/__/auth/handler`. Se esse endereço não estiver cadastrado, o login com Google falha com
"redirect_uri_mismatch".

1. Abra <https://console.cloud.google.com> com a mesma conta e selecione o projeto do Firebase no seletor no topo.
2. No menu, procure por **Credenciais** (em **APIs e serviços**). Em "IDs do cliente OAuth 2.0", procure por **Web client
   (auto created by Google Service)**, o cliente criado automaticamente pelo Firebase, e abra-o. Se ele não aparecer,
   volte ao passo 2.2 e ative o provedor Google no Firebase primeiro: é isso que cria o cliente.
3. Em **URIs de redirecionamento autorizados** (procure por esse título), adicione, **obrigatoriamente um para cada
   host do site**:
   - `https://telaviva.vercel.app/__/auth/handler`
   - `https://telaviva-git-v2-higorxyz-projects.vercel.app/__/auth/handler`
4. Mantenha o que já existe (`https://<ID-DO-PROJETO>.firebaseapp.com/__/auth/handler`) e clique em **Salvar**. A
   alteração pode levar alguns minutos para valer.

## 3. Neon (banco Postgres) pela Vercel

1. Abra o painel da Vercel → projeto **telaviva** → aba **Storage**.
2. **Create Database** → escolha **Neon** (Postgres) → plano **Free** → siga o assistente (região **São Paulo**,
   `sa-east-1`: as funções do site rodam em São Paulo, `gru1` no `vercel.json`, e cada pedido da lista conversa com o
   banco) → **Create**.
3. Na tela de conexão, marque os ambientes **Production**, **Preview** e **Development** e confirme. O banco é um só
   para produção e previews (previews são só do autor); um branch do Neon para previews fica recomendado no futuro.
4. A integração cria a variável `DATABASE_URL` sozinha. Para conferir: projeto → **Settings** → **Environment
   Variables**.
5. Para usar o banco localmente, copie o valor: **Settings** → **Environment Variables** → `DATABASE_URL` → ícone de
   olho (mostrar) → copiar. Se preferir, rode `vercel env pull .env.local` na pasta do projeto.

## 4. Variáveis de ambiente na Vercel

Projeto **telaviva** → **Settings** → **Environment Variables** → **Add New**. Marque `FIREBASE_PRIVATE_KEY` e
`DATABASE_URL` como **Sensitive** (opção na hora de criar a variável).

### 4.1 Production

Marque só **Production**.

| Variável                           | Valor                         | De onde vem                      |
| ---------------------------------- | ----------------------------- | -------------------------------- |
| `TMDB_READ_TOKEN`                  | o token de leitura            | seção 1                          |
| `NEXT_PUBLIC_SITE_URL`             | `https://telaviva.vercel.app` | o endereço público               |
| `NEXT_PUBLIC_FIREBASE_API_KEY`     | `apiKey`                      | passo 2.4                        |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`  | `projectId`                   | passo 2.4                        |
| `NEXT_PUBLIC_FIREBASE_APP_ID`      | `appId`                       | passo 2.4                        |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `telaviva.vercel.app`         | o host de produção, sem https:// |
| `FIREBASE_PROJECT_ID`              | `projectId`                   | passo 2.4                        |
| `FIREBASE_CLIENT_EMAIL`            | `client_email`                | passo 2.5                        |
| `FIREBASE_PRIVATE_KEY`             | `private_key`                 | passo 2.5                        |
| `DATABASE_URL`                     | URL do Neon                   | criada no passo 3                |

Nunca defina na Vercel `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST` nem
`DATABASE_DRIVER=pglite`: são só para a máquina local, e o servidor os recusa.

### 4.2 Preview (branch v2)

Marque só **Preview**, escolha **Select a custom Preview branch** e informe `v2`: assim as variáveis valem só para a
branch `v2`, cujo host é o do `AUTH_DOMAIN` abaixo. Outras URLs de preview (de outras branches ou de deploys avulsos) não
terão login. Os valores são os da produção, menos:

| Variável                           | Valor                                                         |
| ---------------------------------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `telaviva-git-v2-higorxyz-projects.vercel.app`                |
| `NEXT_PUBLIC_SITE_URL`             | opcional: sem ela, os links canônicos apontam para a produção |

### 4.3 Notas

- **`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` deve ser igual ao host de cada ambiente.** O site repassa `/__/auth/*` para o
  Firebase (proxy em `next.config.ts`), e é isso que faz o login funcionar no Safari/iOS e no app instalado sem cookies
  de terceiros. Se o domínio for o do Firebase (`*.firebaseapp.com`) ou o de outro ambiente, o login por
  redirecionamento quebra.
- **A CSP conta com isso.** O `frame-src` da política (`src/lib/security-headers.ts`) libera `'self'` para o iframe
  escondido do login (`/__/auth/iframe`) e `<projeto>.firebaseapp.com` só para o uso local. Um `authDomain` diferente do
  host do site em produção seria bloqueado pela CSP. `npm run env:check -- --target=production` aponta esse caso.
- **`FIREBASE_PRIVATE_KEY`:** cole o valor **exatamente como aparece no JSON**, com os `\n` literais (barra invertida
  seguida de `n`), sem aspas e em uma única linha. O servidor também aceita a chave com quebras reais ou o JSON inteiro
  da conta de serviço.
- Variáveis `NEXT_PUBLIC_*` entram no JavaScript na hora do build. Depois de criar ou alterar variáveis, é preciso **um
  novo deploy** (aba **Deployments** → menu `...` do último deploy → **Redeploy**) para elas valerem.

## 5. `.env.local` (desenvolvimento local)

Copie o `.env.example` para `.env.local` na raiz do projeto (o `.gitignore` já ignora os `.env*`, menos o exemplo) e
preencha:

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

Só o `TMDB_READ_TOKEN` é obrigatório; deixe as variáveis de conta todas vazias para rodar como visitante.

Atenção ao local: use `<ID-DO-PROJETO>.firebaseapp.com` em `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, porque o SDK do Firebase
sempre abre `https://<authDomain>/__/auth/handler` e o servidor local roda em `http`. Se você deixar `localhost:3000`
(ou `127.0.0.1`), o site troca automaticamente por `<ID-DO-PROJETO>.firebaseapp.com`. O `FIREBASE_PRIVATE_KEY` também
vai com os `\n` literais, numa linha só.

**Login por `http://` só funciona em `localhost`.** Os cookies de sessão levam `Secure` em qualquer outro endereço, e o
navegador descarta cookie `Secure` recebido por `http`. Por isso, abrir o servidor local pelo celular na rede
(`http://192.168.x.x:3000`) mostra o site, mas o login não "pega": a sessão some no próximo pedido. Para testar o login
no celular, use o preview da Vercel (que é `https`).

### 5.1 Sem as contas reais: emulador e PGlite

Para desenvolver o login sem tocar no Firebase e no Neon de verdade:

1. `npm run emulators` sobe o emulador do Firebase Auth na porta 9099, com o projeto `demo-telaviva`. Ele roda só com o
   Node (sem Java) e não precisa de chave nenhuma.
2. No `.env.local`, use:

   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=qualquer-coisa
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-telaviva
   NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:0000000000000000000000
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=localhost:3000
   NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
   FIREBASE_PROJECT_ID=demo-telaviva
   FIREBASE_CLIENT_EMAIL=dev@demo-telaviva.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY=nao-usada-com-o-emulador
   DATABASE_DRIVER=pglite
   PGLITE_DIR=.e2e/pglite-local
   ```

3. `npm run db:migrate` cria as tabelas no PGlite (não pede `--confirm`, porque não é o Neon).

Os testes automatizados nunca usam as contas reais: `npm test` roda o banco num PGlite em memória, e `npm run e2e` sobe o
emulador, um mock do TMDb e um PGlite em `.e2e/pglite` sozinhos (veja `e2e/e2e-env.ts`).

## 6. Migrações do banco

Com `DATABASE_URL` definido (no `.env.local` ou no terminal), crie ou atualize as tabelas no Neon:

```
npm run db:migrate -- --confirm
```

O script imprime o alvo (`Migrando: Neon (<host>)`, sem senha) antes de aplicar. Em um banco Neon ele exige `--confirm`
(ou `MIGRATE_CONFIRM=1`), porque o `.env.local` pode apontar para a produção; sem a confirmação ele só mostra o alvo e
sai com erro.

Rode de novo sempre que o esquema mudar (cada migração é aplicada só uma vez). Para gerar uma migração nova depois de
editar o esquema (`src/server/db/schema.ts`), use `npm run db:generate`. Como produção e previews usam o mesmo banco,
uma migração precisa ser compatível com o código que está no ar: só adicionar, nunca quebrar.

## 7. Lançamento e operação em produção

### 7.1 Antes do merge na `main`

1. Variáveis de Production conferidas (seção 4.1) e `npm run env:check -- --target=production --file=...` sem nada além
   das Sensitive (seção 0).
2. `telaviva.vercel.app` nos domínios autorizados do Firebase (passo 2.3) e
   `https://telaviva.vercel.app/__/auth/handler` nas URIs de redirecionamento (passo 2.6).
3. **Migração aplicada antes do merge:** `npm run db:migrate -- --confirm` com o `DATABASE_URL` de produção. As
   migrações da v2 só adicionam tabelas e não afetam o código que está no ar.
4. CI verde no pull request.

### 7.2 Depois do deploy

- Abrir a página inicial, entrar com Google e com e-mail (com o console do navegador aberto, procurando erros de CSP),
  fazer uma ação na lista e testar o modo offline no celular.
- Conferir os erros de execução na Vercel (**Logs** ou **Observability**).

### 7.3 Botão de emergência do service worker

Se o service worker causar problemas (por exemplo, amigos presos numa versão velha), defina
`NEXT_PUBLIC_SW_DISABLED=1` no ambiente Production e faça um **Redeploy**. Como a variável entra no build, só vale
depois do novo deploy. Na próxima visita, o site remove o service worker instalado e passa a funcionar só online. Para
religar, apague a variável e faça outro deploy.

### 7.4 Plano de volta

- **Rollback instantâneo da Vercel:** **Deployments** → o deploy de produção anterior → menu `...` → **Instant
  Rollback**. Volta o código na hora, sem build. As variáveis de ambiente e o banco não voltam junto (por isso as
  migrações só adicionam).
- A tag `v1` do git marca a última versão da v1, como referência.
- Se o problema for o service worker, use o botão de emergência (7.3) em vez de voltar tudo.

## 8. O que nunca fazer

- **Nunca** commite o arquivo `.json` da conta de serviço, a `private_key`, o `.env.local` ou o `DATABASE_URL`.
- **Nunca** coloque a chave privada, o `client_email` ou o `DATABASE_URL` em variável com prefixo `NEXT_PUBLIC_`: tudo
  que tem esse prefixo vai para o navegador de qualquer visitante.
- **Nunca** cole esses valores em issues, PRs, prints ou conversas. `npm run env:check` mostra só nomes, e é seguro
  colar a saída dele.
- **Não** adicione restrição por "referenciadores HTTP" à chave de API web (`NEXT_PUBLIC_FIREBASE_API_KEY`) no Google
  Cloud: o servidor usa essa chave para pedir o e-mail de nova senha, e a restrição faria esse envio falhar sem aviso.
- Se a chave vazar: Firebase → **Configurações do projeto** → **Contas de serviço** → procure por **Gerenciar
  permissões da conta de serviço** (abre o Google Cloud) → **Chaves** → apague a chave comprometida e gere outra.
- **Não** atualize o `firebase-admin` para a versão 14 ou superior por enquanto: ele fica fixado em 13.x (versão exata no
  `package.json`) até que o `jwks-rsa`/`jose` voltem a funcionar no runtime da Vercel. O `firebase-admin@14` depende do
  `jwks-rsa@4`, que usa `require()` em um módulo ESM (`jose@6`), e o runtime Node da Vercel recusa isso
  (`ERR_REQUIRE_ESM`), o que derruba as rotas `/api/auth/*` com erro 500. Localmente funciona, então o problema só
  aparece no deploy. Para conferir antes de atualizar: `node --no-experimental-require-module -e "require('firebase-admin/auth')"`.
