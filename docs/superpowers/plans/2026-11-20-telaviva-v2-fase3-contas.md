# TelaViva v2 — Fase 3: Contas e sincronização — Plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** login opcional (Google ou e-mail e senha) com a biblioteca salva em Postgres e sincronizada entre aparelhos; mesclagem da biblioteca do visitante no primeiro login; página de conta com sair, exportar dados e excluir conta (LGPD).

**Arquitetura:**
- **Login:** Firebase Auth só no cliente, carregado sob demanda: quem não loga nunca baixa o SDK. O servidor troca o ID token por um *session cookie* httpOnly (firebase-admin) e conhece o usuário por esse cookie.
- **Dados:** Postgres (Neon) via Drizzle. Uma implementação de servidor da `LibraryRepository` usa o mesmo redutor `applyCommand` da Fase 2: o servidor carrega o estado do usuário, aplica o comando e grava só as linhas que mudaram, em lote.
- **Testes:** usam o Firebase Auth Emulator e o PGlite (Postgres em processo). Nenhum teste depende das contas reais.

**Stack:** a da Fase 2 mais `firebase@13.4.0` (cliente), `firebase-admin@14.5.1`, `drizzle-orm@0.45.4`, `drizzle-kit@0.31.11` (dev), `@neondatabase/serverless@1.2.1`, `@electric-sql/pglite@0.5.17` (dev) e `firebase-tools@15.37.0` (dev, para o emulador). Fixe as versões exatas.

**Spec:** [docs/superpowers/specs/2026-11-18-telaviva-v2-design.md](../specs/2026-11-18-telaviva-v2-design.md). Valem as seções 4 (subdecisão de login), 6 (Stack, Modelo de dados, Detalhes decididos, Visitante e logado), 7 (Qualidade) e 10 (o que o autor precisa fazer). Quem executar deve ler o spec e este plano.

## Restrições globais

- Valem todas as restrições da Fase 2: Node 24, versões fixadas, pt-BR, tokens só no `@theme`, `prefers-reduced-motion`, arquivos curtos (~200 linhas), sem eyebrow, ícones só lucide.
- **Commits** em inglês (`feat:`/`fix:`/`chore:`/`test:`), **sem `Co-Authored-By` e sem menção a Claude ou IA**. **Sem push**: os commits ficam locais até o autor aprovar.
- Testes: `npm test` (nunca `npx vitest`), `npm run lint` (0 avisos), `npm run typecheck`, `npm run build` e `npm run e2e`, uma suíte por vez. Servidores e emuladores iniciados são encerrados por PID.
- Leia `node_modules/next/dist/docs/` antes de usar `cookies()`, rotas, `'use cache'` ou `rewrites` (AGENTS.md avisa que esta versão do Next mudou).
- **Custo zero**: Firebase Spark, Neon Free e Vercel Hobby. Nenhum serviço pago e nenhum domínio próprio.
- **Segredos:**
  - A credencial de serviço do Firebase e o `DATABASE_URL` só existem no servidor (`server-only`, sem `NEXT_PUBLIC_`).
  - A configuração web do Firebase (`apiKey`, `projectId`, `appId`) é pública por natureza e pode ter `NEXT_PUBLIC_`.
  - Nunca imprima nem commite valores de `.env.local`.
- **Login opcional e desligável:** se as variáveis do Firebase ou do banco estiverem ausentes, o site funciona exatamente como na Fase 2 (visitante), sem botão "Entrar" e sem erro no build. Isso mantém o build verde antes de o autor criar as contas.
- **Páginas continuam estáticas ou parcialmente pré-renderizadas.** Nenhuma página existente passa a ler `cookies()` no nível da página. Quem precisa do usuário lê no cliente, ou dentro de Suspense (`/conta`). Rotas `[id]-[slug]` mantêm os 308/404 reais.
- **Hidratação:** a UI que depende do login renderiza um estado neutro no servidor e no primeiro render do cliente.
- **Mudanças de estado** (POST/PUT/DELETE em `/api/auth/*`, `/api/library/*` e `/api/account/*`) exigem que o header `Origin` corresponda ao host. Cookies são `HttpOnly; Secure; SameSite=Lax; Path=/` (sem `Secure` só em `http://localhost`). As rotas também usam o limitador por IP de `src/lib/api-guard.ts`.

## Valores fixados (usar exatamente)

- **Cookies:**
  - de sessão: `tv_session` (httpOnly), validade de 14 dias;
  - indicador público: `tv_auth=1` (não httpOnly, mesma validade), que só serve para o cliente saber que deve carregar o modo logado. Nunca é usado para autorização.
- **Login recente:** para excluir a conta, `auth_time` deve ter no máximo 5 minutos.
- **Variáveis de ambiente:**
  - públicas: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` (o host do próprio site, por causa do proxy) e, opcional, `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST`;
  - de servidor: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (com `\n` escapados), `DATABASE_URL` e, só nos testes, `DATABASE_DRIVER=pglite` com `PGLITE_DIR`. `FIREBASE_AUTH_EMULATOR_HOST` é reconhecido pelo admin SDK.
- **Proxy do login:** rewrite de `/__/auth/:path*` para `https://<NEXT_PUBLIC_FIREBASE_PROJECT_ID>.firebaseapp.com/__/auth/:path*`. É a opção recomendada pelo Firebase para o redirect funcionar sem cookies de terceiros (Safari/iOS, PWA).
- **Limites:**
  - corpo de `/api/library/commands` até 64 KB;
  - corpo de `/api/library/merge` até 2 MB;
  - por usuário, até 5.000 itens, 5.000 notas e 60.000 marcas de episódio (acima disso, 413 com `{ error }`);
  - até 2.000 marcas por comando `setEpisodes`.
- **Textos** (exatos):
  - Página `/entrar`: título `{ lead: 'Entrar no', accent: 'TelaViva' }`; botões "Continuar com Google", "Entrar", "Criar conta" e "Esqueci minha senha"; abas "Entrar" / "Criar conta"; campos "Nome" (opcional, só no cadastro), "E-mail" e "Senha".
  - Aviso de privacidade em `/entrar`: "Guardamos seu nome, seu e-mail e sua lista. Você pode exportar ou excluir tudo em Sua conta."
  - Recuperação de senha (sempre a mesma resposta): "Se esse e-mail estiver cadastrado e confirmado, você vai receber um link para criar uma nova senha."
  - Faixa de verificação: "Confirme seu e-mail para proteger sua conta." e o botão "Reenviar e-mail". Depois do reenvio: "E-mail enviado."
  - Erros do Firebase:
    - `auth/invalid-credential`, `auth/wrong-password` e `auth/user-not-found` → "E-mail ou senha incorretos.";
    - `auth/email-already-in-use` → "Já existe uma conta com esse e-mail.";
    - `auth/weak-password` → "Use uma senha com pelo menos 8 caracteres." (o cliente exige 8 antes de chamar);
    - `auth/invalid-email` → "Confira o e-mail digitado.";
    - `auth/too-many-requests` → "Muitas tentativas. Espere um pouco e tente de novo.";
    - `auth/network-request-failed` → "Sem conexão. Verifique sua internet.";
    - `auth/popup-closed-by-user` e `auth/cancelled-popup-request` → nenhuma mensagem;
    - qualquer outro → "Não foi possível entrar agora. Tente de novo.".
  - Página `/conta`: título `{ lead: 'Sua', accent: 'conta' }`; botões "Sair", "Exportar meus dados" e "Excluir minha conta".
  - Confirmação da exclusão: texto "Isso apaga sua conta e toda a sua lista para sempre. Digite EXCLUIR para confirmar.", campo com rótulo "Digite EXCLUIR" e botão "Excluir para sempre" (habilitado só com `EXCLUIR` exato). Se o login não for recente: "Por segurança, entre de novo para excluir a conta."
  - Toasts:
    - "Sua lista foi salva na sua conta." (depois da mesclagem);
    - "Sua sessão expirou. Entre de novo para sincronizar.";
    - "Não foi possível salvar na sua conta. Tente de novo." (erro do repositório de servidor);
    - "Conta excluída." (na home, depois da exclusão).
  - Header: link "Entrar" para visitantes. Para logados, botão com a inicial do nome (ou ícone `User`), `aria-label` "Sua conta", que leva a `/conta`.
  - Minha lista, só para visitante com login habilitado: linha discreta "Entre para ver sua lista em todos os aparelhos." com o link "Entrar".
- **Exportação:** `GET /api/account/export` → JSON `{ exportedAt, user: { id, email, name, photoUrl, createdAt }, library: LibraryState }`, com `Content-Disposition: attachment; filename="telaviva-meus-dados-AAAA-MM-DD.json"`.
- **Backup local antes de limpar na mesclagem:** chave `telaviva:library:v1:pre-merge:<uid>`, gravada uma vez e nunca apagada automaticamente.

## Foco de revisão

1. **A sessão expira, ou o cookie some, com o usuário ainda logado no Firebase.** O cliente renova a sessão em silêncio com um ID token novo. Se não der, volta ao modo visitante com o toast de sessão expirada, desfaz a ação pendente e não perde nada do servidor. *Teste:* Task 7.
2. **Mesclagem interrompida ou repetida** (rede cai no meio; login em dois aparelhos com listas locais diferentes; mesclar duas vezes). A cópia local só é limpa depois de o servidor confirmar. Reenviar não duplica nada. Itens repetidos ficam com o status e a nota de atualização mais recente, e com a união dos episódios. *Teste:* Tasks 5 e 7.
3. **Dois aparelhos editando o mesmo título.** Vale a última escrita, linha por linha, por `updatedAt`. Um "Desfazer" não sobrescreve uma edição mais nova feita em outro aparelho: a restauração é condicional e devolve 409 → toast "A lista mudou em outro aparelho." *Teste:* Task 4.
4. **Exclusão de conta que falha no meio.** A ordem é apagar os dados no banco (transação) e depois o usuário no Firebase. Se o Firebase falhar, a rota devolve 502 e repetir é seguro (idempotente). Nunca sobram dados de um usuário sem conta. *Teste:* Task 10.
5. **Popup bloqueado no iPhone ou no PWA instalado.** Com `auth/popup-blocked` ou `auth/operation-not-supported-in-this-environment`, o login cai para o redirect pelo proxy `/__/auth`, e a volta do redirect é tratada (`getRedirectResult`) sem loop. *Teste:* Task 7 (unidade) e Task 11 (o redirect não é exercitado no E2E; documente por quê).

---

### Task 1: Dependências, ambiente e guia de contas

**Arquivos:**
- Modificar: `package.json` (dependências fixadas; scripts `db:generate`, `db:migrate`, `emulators`), `src/lib/env-schema.ts`, `src/lib/env.ts`, `.gitignore` (`.e2e/`, `firebase-debug.log`)
- Criar: `src/lib/auth-config.ts` (config pública do Firebase e `authEnabled`, seguro no cliente), `firebase.json` (só o emulador de Auth, porta 9099), `docs/setup/fase3-contas.md`
- Testes: `src/lib/env-schema.test.ts` e `src/lib/auth-config.test.ts`

**Interfaces:**
- Produz:
  - `parseServerAuthEnv(source): { firebase: { projectId; clientEmail; privateKey } | null; databaseUrl: string | null; databaseDriver: 'neon' | 'pglite'; pgliteDir: string | null }`. O `privateKey` converte `\n` escapado em quebra real. `databaseDriver` é `'pglite'` só com `DATABASE_DRIVER=pglite`; lança erro se `VERCEL` estiver definido junto com `pglite`.
  - `serverAuthEnabled(): boolean`: firebase e banco presentes.
  - `publicFirebaseConfig: { apiKey; authDomain; projectId; appId } | null`, `authEnabled: boolean` (config pública completa) e `authEmulatorHost: string | null`.

- [ ] **Step 1: Testes que falham:** variáveis completas → objetos preenchidos; sem nenhuma → `null` e `authEnabled === false`; chave com `\n` escapado vira multilinha; `pglite` com `VERCEL=1` lança erro; `TMDB_READ_TOKEN` continua obrigatório e as variáveis novas são opcionais.
- [ ] **Step 2:** `npm test -- src/lib` → FAIL.
- [ ] **Step 3: Implementar.** `npm install` as versões exatas. O guia `docs/setup/fase3-contas.md` (pt-BR, passo a passo com o caminho de cada clique) cobre:
  1. **Firebase:** criar o projeto "TelaViva" no plano Spark, sem Analytics. Ativar Authentication com os provedores Google e E-mail/senha. Em domínios autorizados, adicionar `telaviva.vercel.app` e `telaviva-git-v2-higorxyz-projects.vercel.app` (`localhost` já vem). Registrar o app web e copiar `apiKey`, `projectId` e `appId`. Gerar a chave da conta de serviço (Configurações do projeto → Contas de serviço → Gerar nova chave privada) e de onde tirar `client_email` e `private_key`. No provedor Google, verificar se o URI de redirecionamento inclui `https://<host>/__/auth/handler` para cada host do site.
  2. **Neon:** pela Vercel, projeto telaviva → Storage → Create Database → Neon (Free). Conectar ao ambiente Preview (e Development para usar localmente). A integração cria `DATABASE_URL`.
  3. **Variáveis na Vercel (Preview):** a lista exata, com `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` igual ao host do preview.
  4. **`.env.local`** para desenvolvimento local (sem valores no guia).
  5. **Migrações:** `npm run db:migrate` com o `DATABASE_URL` do Neon.
  6. **O que nunca fazer:** commitar a chave ou colocá-la em variável `NEXT_PUBLIC_`.
- [ ] **Step 4:** `npm test`, `npm run lint`, `npm run typecheck` e `npm run build` (sem as variáveis novas) → verdes.
- [ ] **Step 5: Commit.** `git commit -m "chore: add auth and database dependencies, env parsing and the account setup guide"`

---

### Task 2: Banco: esquema Drizzle, migrações e cliente

**Arquivos:**
- Criar: `src/server/db/schema.ts`, `src/server/db/client.ts`, `drizzle.config.ts`, `drizzle/` (migrações geradas), `scripts/db-migrate.ts`, `src/test/db.ts` (helper de PGlite em memória já migrado)
- Testes: `src/server/db/schema.test.ts`

**Interfaces:**
- Produz:
  - As tabelas do spec, com nomes em snake_case e PK/uniques exatos:
    - `users(id text pk /*uid*/, email text, name text, photo_url text, created_at timestamptz default now(), updated_at timestamptz default now())`;
    - `library_items(user_id text fk→users.id on delete cascade, media_type text check in ('movie','tv'), tmdb_id integer, status text check in ('want','watching','watched'), added_at, updated_at, watched_at timestamptz null, title text not null, poster_path text null, release_date text null, genre_ids integer[] not null default '{}', unique(user_id, media_type, tmdb_id))`;
    - `episode_progress(user_id fk cascade, tv_id integer, season_number integer, episode_number integer, watched_at timestamptz, unique(user_id, tv_id, season_number, episode_number))`;
    - `ratings(user_id fk cascade, media_type, tmdb_id, score integer check 1..10, rated_at, updated_at, unique(user_id, media_type, tmdb_id))`;
    - índice por `user_id` em cada tabela.
  - `getDb(): Database`, singleton por processo. Usa `drizzle-orm/neon-http` com `DATABASE_URL`, ou `drizzle-orm/pglite` com `PGLITE_DIR` quando `databaseDriver === 'pglite'`. É `server-only`.
  - `createTestDb(): Promise<Database>`: PGlite em memória com as migrações aplicadas.
  - `npm run db:migrate` aplica as migrações no banco configurado (Neon ou PGlite).
- [ ] **Step 1: Testes que falham** (com `createTestDb`): inserir um usuário e itens; a unique impede duplicatas; `score 11` falha pelo check; apagar o usuário apaga as linhas filhas (cascade); `genre_ids` guarda array.
- [ ] **Step 2:** `npm test -- src/server/db` → FAIL.
- [ ] **Step 3: Implementar.** Gere a migração com `npm run db:generate` e commite os SQL gerados.
- [ ] **Step 4:** `npm test` e `npm run typecheck` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: add the Postgres schema, migrations and a Neon or PGlite database client"`

---

### Task 3: Sessão no servidor (firebase-admin) e rotas de autenticação

**Arquivos:**
- Criar: `src/server/auth/admin.ts`, `src/server/auth/session.ts`, `src/server/auth/guard.ts`, `src/server/users.ts`, `src/app/api/auth/session/route.ts`, `src/app/api/auth/me/route.ts`
- Testes: `src/server/auth/session.test.ts`, `src/app/api/auth/session/route.test.ts`, `src/app/api/auth/me/route.test.ts`

**Interfaces:**
- Consome: Tasks 1 e 2; `src/lib/api-guard.ts` (limitador e `readJsonBody`).
- Produz:
  - `getAdminAuth(): Auth`, singleton. Usa o emulador quando `FIREBASE_AUTH_EMULATOR_HOST` existe.
  - `createSession(idToken: string): Promise<{ cookie: string; user: SessionUser }>`. Verifica o ID token, cria o session cookie de 14 dias e faz upsert de `users` (email, name, photo_url, updated_at).
  - `type SessionUser = { id: string; email: string | null; name: string | null; photoUrl: string | null; emailVerified: boolean; authTime: number }`.
  - `readSession(cookieValue: string | undefined, opts?: { checkRevoked?: boolean }): Promise<SessionUser | null>`. Inválido ou expirado → null.
  - `requireUser(request: Request, opts?): Promise<SessionUser | Response>` (em guard.ts). Devolve 401 `{ error: 'unauthenticated' }` sem sessão. Para métodos que alteram estado, também confere o `Origin` (403 se não bater).
  - `POST /api/auth/session` com `{ idToken }`: grava `tv_session` e `tv_auth`, responde 200 `{ user }`.
  - `DELETE /api/auth/session`: apaga os dois cookies e revoga os refresh tokens se havia sessão. Responde 204.
  - `GET /api/auth/me`: 200 `{ user }` ou 401.
  - Com login desligado (Task 1), todas as rotas `/api/auth/*`, `/api/library/*` e `/api/account/*` respondem 404.
- [ ] **Step 1: Testes que falham** (mockando `firebase-admin/auth`):
  - token válido → cookies com as flags exatas (HttpOnly, SameSite=Lax, Max-Age 1209600) e usuário gravado;
  - token inválido → 401;
  - `Origin` diferente → 403;
  - corpo acima de 64 KB → 413;
  - `DELETE` limpa os cookies (Max-Age=0);
  - `me` sem cookie → 401;
  - login desligado → 404.
- [ ] **Step 2:** `npm test -- src/server/auth src/app/api/auth` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: exchange Firebase ID tokens for an httpOnly session cookie"`

---

### Task 4: Biblioteca no servidor (store e rotas)

**Arquivos:**
- Criar:
  - `src/features/library/command-schema.ts` (Zod de `LibraryCommand`, reaproveitando os esquemas de linha exportados de `schema.ts`);
  - `src/server/library/store.ts` (`loadLibrary`, `applyLibraryCommand`, diff → upserts e deletes);
  - `src/server/library/diff.ts` (puro);
  - `src/app/api/library/route.ts` (GET);
  - `src/app/api/library/commands/route.ts` (POST).
- Modificar: `src/features/library/schema.ts` (exportar `itemSchema`, `ratingSchema` e `episodeSchema`), `src/features/library/commands.ts` (`restore` condicional)
- Testes: `src/server/library/diff.test.ts`, `src/server/library/store.test.ts` (PGlite), `src/app/api/library/commands/route.test.ts`, `src/features/library/command-schema.test.ts` e o caso novo em `commands.test.ts`

**Interfaces:**
- Consome: Tasks 2 e 3; `applyCommand` e `LibraryState` da Fase 2.
- Produz:
  - `parseCommand(raw: unknown): LibraryCommand | null`, com os limites de "Valores fixados".
  - `diffStates(before: LibraryState, after: LibraryState): { upsertItems; deleteItems; upsertRatings; deleteRatings; upsertMarks; deleteMarks }`. Puro, por chave.
  - `loadLibrary(db, userId): Promise<LibraryState>`.
  - `applyLibraryCommand(db, userId, command, now): Promise<LibraryState>`. Carrega, aplica `applyCommand`, valida os limites por usuário (413), grava o diff num único `db.batch`/transação e devolve o novo estado.
  - **`restore` condicional:** o comando ganha `expectedUpdatedAt?: string | null`, que é o `updatedAt` do item logo depois da ação desfeita. Se o item atual tiver `updatedAt` diferente, o servidor recusa com `LibraryConflictError` e a rota responde 409 `{ error: 'conflict' }`. Localmente, o `applyCommand` ignora o campo, porque não há concorrência. Em `useLibraryActions` (hooks.ts), o inverso passa a carregar `expectedUpdatedAt`.
  - `GET /api/library` → 200 `LibraryState` ou 401.
  - `POST /api/library/commands` com `{ command }` → 200 `LibraryState`. Erros: 400 inválido, 401, 403 por Origin, 409 conflito, 413 limite.
- [ ] **Step 1: Testes que falham:**
  - `diffStates` cobre cada tipo de linha;
  - o store aplica `setStatus`, `setEpisodes` e `remove` de série (marcas apagadas, nota mantida) e devolve o mesmo estado que `applyCommand` local;
  - dois `apply` em sequência em itens diferentes não se sobrescrevem;
  - `restore` com `expectedUpdatedAt` desatualizado → 409 (Foco 3);
  - limite de itens → 413;
  - comando inválido → 400;
  - a rota sem sessão → 401.
- [ ] **Step 2:** `npm test -- src/server/library src/app/api/library src/features/library` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: store the library in Postgres through the shared command reducer"`

---

### Task 5: Mesclagem visitante → conta

**Arquivos:**
- Criar: `src/features/library/merge.ts` (puro), `src/app/api/library/merge/route.ts`
- Testes: `src/features/library/merge.test.ts`, `src/app/api/library/merge/route.test.ts`

**Interfaces:**
- Produz:
  - `mergeLibraries(account: LibraryState, guest: LibraryState): LibraryState`. Regras do spec: item repetido fica com o de `updatedAt` mais recente (status, retrato e datas juntos); nota repetida, com a de `updatedAt` mais recente; marcas, com a união, e numa marca repetida fica o `watchedAt` mais recente. Depois, `normalizeLibraryState`.
  - `POST /api/library/merge` com `{ library: LibraryState }` (Zod, até 2 MB): mescla com o estado do servidor, grava o diff (Task 4), aplica os limites e devolve 200 `LibraryState`. É idempotente: mesclar o mesmo estado de novo não muda nada.
- [ ] **Step 1: Testes que falham:**
  - item na conta e no visitante → vence o mais recente;
  - nota idem;
  - marcas unidas;
  - idempotência (`merge(merge(a, g), g)` igual a `merge(a, g)`);
  - visitante vazio → conta inalterada;
  - a rota mesclar duas vezes não duplica (Foco 2);
  - corpo acima de 2 MB → 413.
- [ ] **Step 2:** `npm test -- src/features/library/merge.test.ts src/app/api/library/merge` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: merge the guest library into the account on first login"`

---

### Task 6: Repositório de servidor no cliente e troca de repositório

**Arquivos:**
- Criar: `src/features/library/server-repository.ts`
- Modificar:
  - `src/features/library/repository.ts`: campo opcional `errorMessage?: string`, avisos `'session-expired'` e `'conflict'`;
  - `src/features/library/hooks.ts`: a mensagem de erro vem do repositório, com padrão no copy local;
  - `src/features/library/LibraryProvider.tsx`: recebe `mode: { kind: 'guest' } | { kind: 'account'; uid: string }`, recria o repositório quando o modo muda e limpa as queries `['library']`, `['recommendations']` e `['tv-progress']`;
  - `src/features/library/copy.ts`;
  - `src/features/library/view/LibraryView.tsx`: o default congelado da aba reseta quando o modo muda (`key` pelo uid).
- Testes: `src/features/library/server-repository.test.ts` (MSW) e casos novos em `LibraryProvider.test.tsx` e `hooks.test.tsx`

**Interfaces:**
- Consome: Tasks 4 e 5; `LibraryRepository` da Fase 2.
- Produz:
  - `createServerRepository(opts: { onUnauthenticated: () => void }): LibraryRepository`.
    - `load` = `GET /api/library`; `apply` = `POST /api/library/commands`;
    - 401 → chama `onUnauthenticated` e rejeita com `LibrarySessionError`;
    - 409 → rejeita com `LibraryConflictError` e emite o aviso `'conflict'`;
    - `persistent = true`, `errorMessage` = "Não foi possível salvar na sua conta. Tente de novo.";
    - `subscribe`: invalida ao voltar o foco da janela (`visibilitychange` para visible), no máximo uma vez a cada 30 s, para pegar mudanças de outro aparelho.
  - O provider mostra "A lista mudou em outro aparelho." no aviso `'conflict'`.
- [ ] **Step 1: Testes que falham:**
  - `load` e `apply` chamam as rotas certas;
  - 401 → `onUnauthenticated` e rejeição;
  - 409 → aviso `'conflict'` e o toast;
  - trocar o modo de visitante para conta recria o repositório e limpa as três queries;
  - o erro de `apply` mostra a mensagem do repositório de servidor;
  - a aba congelada da Minha lista reseta com outro uid.
- [ ] **Step 2:** `npm test -- src/features/library` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: add the account library repository and switch repositories by sign-in state"`

---

### Task 7: Login no cliente (AuthProvider, Firebase sob demanda, renovação e mesclagem)

**Arquivos:**
- Criar:
  - `src/features/auth/firebase-client.ts` (import dinâmico de `firebase/app` e `firebase/auth`; `connectAuthEmulator` quando houver host);
  - `src/features/auth/AuthProvider.tsx` (contexto);
  - `src/features/auth/useAuth.ts`;
  - `src/features/auth/session-client.ts` (fetch das rotas da Task 3);
  - `src/features/auth/sign-in.ts` (Google popup → redirect, e-mail, cadastro, verificação);
  - `src/features/auth/merge-on-login.ts`;
  - `src/features/auth/errors.ts` (código do Firebase → texto).
- Modificar: `src/app/providers.tsx` (AuthProvider por fora do LibraryProvider, passando o `mode`), `next.config.ts` (rewrite `/__/auth/:path*`)
- Testes: `src/features/auth/*.test.ts(x)`, com o Firebase mockado

**Interfaces:**
- Consome: Tasks 1, 3, 5 e 6.
- Produz:
  - `useAuth(): { status: 'loading' | 'guest' | 'signed-in' | 'disabled'; user: SessionUser | null; signInWithGoogle(): Promise<void>; signInWithEmail(email, password): Promise<void>; signUpWithEmail(name, email, password): Promise<void>; sendVerification(): Promise<void>; signOut(): Promise<void>; refresh(): Promise<void> }`.
  - **Regras do provider:**
    - `authEnabled === false` → `disabled`, e nada de Firebase é baixado.
    - No início do cliente: sem o cookie `tv_auth` → `guest`, sem baixar Firebase. Com o cookie → `GET /api/auth/me`; 200 → `signed-in`.
    - 401 → carrega o Firebase e, se houver `currentUser`, gera um ID token novo e chama `POST /api/auth/session` (renovação silenciosa); senão, vira `guest` e mostra o toast de sessão expirada (Foco 1). O `onUnauthenticated` do repositório de servidor dispara o mesmo fluxo.
    - Depois de qualquer login: ID token → `POST /api/auth/session` → se a biblioteca local não estiver vazia, `mergeOnLogin`.
  - `mergeOnLogin(uid)`: lê o estado local e grava o backup `telaviva:library:v1:pre-merge:<uid>` (só se ainda não existir). Chama `POST /api/library/merge`. **Só depois do 200** limpa a chave `telaviva:library:v1` e mostra o toast "Sua lista foi salva na sua conta.". Em erro, mantém tudo local e tenta de novo no próximo início (Foco 2).
  - **Google:** `signInWithPopup`. Com `auth/popup-blocked` ou `auth/operation-not-supported-in-this-environment` → `signInWithRedirect`. No início, se houver um redirect pendente, trata `getRedirectResult` uma vez (Foco 5).
  - `signOut`: `DELETE /api/auth/session` e `signOut` do Firebase; vira `guest` com a biblioteca local (vazia, se foi limpa na mesclagem).
  - O cadastro com e-mail envia a verificação logo depois (`sendEmailVerification`).
- [ ] **Step 1: Testes que falham:**
  - sem `tv_auth`, o Firebase não é importado (spy no import dinâmico);
  - com `tv_auth` e `me` 200 → `signed-in`;
  - `me` 401 com `currentUser` → renova e volta a `signed-in`;
  - 401 sem `currentUser` → `guest` com toast;
  - a mesclagem só limpa o local depois do 200, e com 500 mantém;
  - o backup é gravado uma vez;
  - popup bloqueado → redirect;
  - os códigos de erro viram os textos exatos;
  - `disabled` sem config;
  - o rewrite `/__/auth` existe na config.
- [ ] **Step 2:** `npm test -- src/features/auth` → FAIL.
- [ ] **Step 3: Implementar.** O Firebase entra só por `import()` dentro de `firebase-client.ts`. Confira no build que a página inicial não carrega o chunk do Firebase.
- [ ] **Step 4:** `npm test` e `npm run build` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: add optional sign-in with lazy Firebase, silent session renewal and guest merge"`

---

### Task 8: Página `/entrar` e recuperação de senha

**Arquivos:**
- Criar: `src/app/entrar/page.tsx` (estática, metadados "Entrar"), `src/features/auth/SignInView.tsx`, `src/features/auth/EmailForm.tsx`, `src/features/auth/ForgotPassword.tsx`, `src/app/api/auth/password-reset/route.ts`
- Testes: os componentes e `src/app/api/auth/password-reset/route.test.ts`

**Interfaces:**
- Consome: Task 7 (`useAuth`), Task 3 (admin).
- Produz:
  - `SignInView`:
    - "Continuar com Google" (botão largo);
    - divisor, abas "Entrar" / "Criar conta" (padrão ARIA de abas);
    - formulário com rótulos visíveis, `autocomplete` correto (`email`, `current-password` / `new-password`) e senha com no mínimo 8 caracteres no cadastro;
    - erros em `role="alert"` com os textos fixados;
    - "Esqueci minha senha" abre um formulário de e-mail no lugar;
    - o aviso de privacidade.
  - Já logado: redireciona para o destino de `?voltar=` (só caminhos internos começando com `/`, senão `/conta`). Com login desligado: `notFound()`.
  - `POST /api/auth/password-reset` com `{ email }`:
    - sempre responde 200 com a mensagem genérica fixada;
    - no servidor, só se o usuário existir **e** tiver `emailVerified`, chama a API REST `accounts:sendOobCode` (`requestType: PASSWORD_RESET`, com a `NEXT_PUBLIC_FIREBASE_API_KEY`) para o Firebase enviar o e-mail;
    - limitado por IP, com checagem de Origin.
  - Depois do login, a página vai para `?voltar=` ou `/minha-lista`.
- [ ] **Step 1: Testes que falham:**
  - as abas e o teclado;
  - senha curta no cadastro → mensagem sem chamar o Firebase;
  - erro do Firebase → texto exato;
  - `?voltar=https://mal.com` → ignorado;
  - a rota de reset dispara para um e-mail verificado, não dispara para um não verificado ou inexistente, e a resposta é idêntica nos três casos.
- [ ] **Step 2:** `npm test -- src/features/auth src/app/api/auth` → FAIL.
- [ ] **Step 3: Implementar.** Leia o craft floor antes da UI: `C:/Users/higorxyz/.claude/plugins/cache/impeccable/impeccable/4.9.2/skills/impeccable/reference/craft-floor.md`. É uma tela de tarefa (modo Operate): sóbria, centrada, coluna de ~26rem, título com o acento âmbar, alvos de 44 px e foco visível.
- [ ] **Step 4:** `npm test` e `npm run build` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: add the sign-in page with Google, email and verified-only password reset"`

---

### Task 9: Entrada da conta no header, faixa de verificação e convite na Minha lista

**Arquivos:**
- Criar: `src/features/auth/AccountButton.tsx`, `src/features/auth/VerifyEmailBanner.tsx`, `src/features/auth/SignInHint.tsx`
- Modificar: `src/features/shell/Header.tsx`, `src/app/layout.tsx` (faixa abaixo do header, só para logado com e-mail não verificado), `src/features/library/view/LibraryView.tsx` (convite para visitante)
- Testes: componentes e o caso novo em `Header.test.tsx`

**Interfaces:**
- Produz:
  - `AccountButton`: `loading` → espaço reservado do mesmo tamanho (sem pulo); `guest` → link "Entrar" para `/entrar?voltar=<caminho atual>`; `signed-in` → círculo de 36 px com a inicial (âmbar sobre `ink-800`), `aria-label` "Sua conta", que leva a `/conta`; `disabled` → nada. Aparece no header no desktop e no celular, porque a TabBar não muda.
  - `VerifyEmailBanner`: os textos fixados e o botão "Reenviar e-mail", que vira "E-mail enviado." e fica desabilitado por 60 s. Some depois de `refresh()` quando o e-mail estiver verificado.
  - `SignInHint`: a linha fixada, só para `guest` com login habilitado.
- [ ] **Step 1: Testes que falham:** os quatro estados do botão; o `voltar` codificado; a faixa só aparece com e-mail não verificado; o reenvio desabilita por 60 s (timers falsos); o convite não aparece para logado nem com login desligado; nenhum estado muda o layout antes do carregamento.
- [ ] **Step 2:** `npm test -- src/features/auth src/features/shell` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: show the account entry in the header, the email verification banner and a sign-in hint"`

---

### Task 10: Página `/conta`: sair, exportar e excluir (LGPD)

**Arquivos:**
- Criar: `src/app/conta/page.tsx` (estática; a view é cliente), `src/features/auth/AccountView.tsx`, `src/features/auth/DeleteAccount.tsx`, `src/app/api/account/export/route.ts`, `src/app/api/account/route.ts` (DELETE), `src/server/account.ts`
- Testes: `src/server/account.test.ts` (PGlite e admin mockado), as rotas e os componentes

**Interfaces:**
- Consome: Tasks 3, 4 e 7.
- Produz:
  - `AccountView`: nome, e-mail, foto ou inicial e o provedor ("Google" ou "E-mail e senha"); o status de verificação; e os botões "Sair", "Exportar meus dados" (download do JSON) e "Excluir minha conta" (abre `DeleteAccount`). Sem sessão → link para `/entrar?voltar=/conta`. Com login desligado → `notFound()`.
  - `DeleteAccount`:
    - um `<dialog>` modal com o texto e o campo fixados;
    - "Excluir para sempre" só com `EXCLUIR` exato;
    - se o servidor responder 401 com `{ error: 'reauth' }` (login não recente), mostra o texto de segurança, faz um novo login (Google popup/redirect ou senha) e tenta de novo;
    - no sucesso, limpa a biblioteca local e o backup `pre-merge:<uid>`, o cache das queries e os cookies (já apagados pelo servidor); vai para `/` e mostra "Conta excluída.".
  - `deleteAccount(db, adminAuth, userId)`: apaga `users` numa transação (o cascade leva o resto) e **depois** `adminAuth.deleteUser`. Um `user-not-found` do Firebase conta como sucesso. Outro erro do Firebase lança e a rota responde 502. Repetir é seguro (Foco 4).
  - `DELETE /api/account`: `requireUser` com `checkRevoked: true`; `authTime` com mais de 5 minutos → 401 `{ error: 'reauth' }`; Origin conferido. Sucesso: 204 e os cookies apagados.
  - `GET /api/account/export`: sessão obrigatória; o JSON e o `Content-Disposition` fixados; `Cache-Control: no-store`.
- [ ] **Step 1: Testes que falham:**
  - a exportação traz exatamente as linhas do usuário, e não as de outro usuário;
  - a exclusão apaga tudo do usuário e mantém os outros;
  - Firebase falha depois do banco → 502, e repetir conclui;
  - login antigo → 401 `reauth`;
  - Origin errado → 403;
  - o botão de excluir fica desabilitado até `EXCLUIR`;
  - o fluxo de reautenticação tenta de novo;
  - depois da exclusão, a biblioteca local está vazia.
- [ ] **Step 2:** `npm test -- src/server src/app/api/account src/features/auth` → FAIL.
- [ ] **Step 3: Implementar.** Leia o craft floor antes da UI.
- [ ] **Step 4:** `npm test` e `npm run build` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: add the account page with sign-out, data export and account deletion"`

---

### Task 11: E2E com o emulador de Auth e o PGlite, CI

**Arquivos:**
- Modificar:
  - `playwright.config.ts`: `webServer` com o emulador (`npx firebase emulators:start --only auth --project demo-telaviva`, porta 9099). O servidor de app recebe as variáveis de teste: config pública `demo-telaviva`, `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `FIREBASE_AUTH_EMULATOR_HOST`, `DATABASE_DRIVER=pglite`, `PGLITE_DIR=.e2e/pglite` e uma credencial de serviço falsa aceita pelo emulador.
  - `e2e/global-setup.ts`: apaga `.e2e/pglite`, aplica as migrações e limpa o emulador via REST (`DELETE /emulator/v1/projects/demo-telaviva/accounts`).
  - `.github/workflows/ci.yml`: cache do firebase-tools; o emulador sobe pelo próprio Playwright.
- Criar: `e2e/auth.spec.ts` e `e2e/auth-helpers.ts` (cria usuários no emulador via REST e marca e-mail como verificado)

**Fluxos (desktop e mobile, salvo indicação):**
1. **Cadastro com e-mail:** visitante adiciona um filme a Quero ver, cria uma conta em `/entrar`, cai em `/minha-lista` com o toast "Sua lista foi salva na sua conta." e o filme continua lá. A chave local `telaviva:library:v1` não existe mais e o backup `pre-merge:<uid>` existe.
2. **Sincronização entre aparelhos:** um segundo contexto de navegador entra com a mesma conta e vê o filme. Marca um episódio de série. O primeiro contexto, ao voltar o foco ou recarregar, vê o progresso.
3. **Sair e entrar de novo:** depois de sair, a Minha lista fica vazia, porque o visitante limpou a lista na mesclagem. Ao entrar, a lista volta.
4. **Sessão expirada:** apagar o cookie `tv_session` e manter `tv_auth`. Uma ação renova em silêncio, sem toast de erro, e a ação persiste.
5. **Senha errada** → "E-mail ou senha incorretos.". **Recuperação** → a mensagem genérica, para e-mail existente e para inexistente.
6. **Exportar:** o download tem o JSON com a lista. **Excluir:** digitar `EXCLUIR`, confirmar, voltar à home com "Conta excluída."; entrar de novo com a mesma senha falha.
7. axe sem violações em `/entrar`, em `/conta` e no diálogo de exclusão aberto.
- O redirect do Google (Foco 5) não é exercitado no E2E, porque o emulador só simula o popup. Registre isso no arquivo de teste e cubra com os testes de unidade da Task 7.

- [ ] **Step 1: Escrever os testes.** Sem esperas fixas.
- [ ] **Step 2:** `npm run e2e` → verde nos dois projetos (todos os specs, inclusive os antigos).
- [ ] **Step 3: Verificação completa, em sequência:** lint, typecheck, `npm test`, e2e, e `npm run build` por último (com o `.env.local` real; o login fica desligado se as variáveis ainda não existirem).
- [ ] **Step 4: Olhar o resultado.** Com o emulador e o PGlite, use o Playwright MCP em 1440×900 e 390×844 para capturar `/entrar` (as duas abas e o erro), `/conta`, o diálogo de exclusão, o header logado e o visitante, e a faixa de verificação. Corrija o que for real. Encerre tudo por PID.
- [ ] **Step 5: Commit.** `git commit -m "test: cover sign-in, sync, merge and account deletion end to end"`

---

### Task 12: Ligar no preview com as contas reais (depende do autor)

Só começa quando o autor confirmar que seguiu `docs/setup/fase3-contas.md`: projeto Firebase, Neon conectado e variáveis no Preview e no `.env.local`.

- [ ] **Step 1:** `npm run db:migrate` no banco do Neon, usando o `DATABASE_URL` do `.env.local` (branch de desenvolvimento ou o mesmo banco do Preview, conforme o guia). A saída deve listar a migração inicial aplicada.
- [ ] **Step 2: Local com as contas reais:** `npm run build` e `next start -p 3001`. Criar uma conta de teste por e-mail, conferir a linha em `users` no Neon, entrar com Google, exportar e excluir a conta de teste. Encerrar o servidor por PID.
- [ ] **Step 3:** com aprovação do autor, push da `v2`; acompanhar o build da Vercel e conferir no preview: `/entrar`, o login com Google (popup e o redirect no celular), `/api/auth/me`, a sincronização entre dois navegadores e nenhum erro de runtime.
- [ ] **Step 4:** registrar no ledger o que foi verificado e o que depende do autor (por exemplo, a regra de firewall).
