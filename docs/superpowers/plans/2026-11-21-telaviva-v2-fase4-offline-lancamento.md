# TelaViva v2 — Fase 4: offline, auditorias, docs e lançamento — Plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** o TelaViva abre e funciona sem internet, com as ações guardadas numa fila que sincroniza sem desfazer mudanças mais novas de outro aparelho. O site passa por auditorias de desempenho, acessibilidade, segurança e SEO, ganha documentação da v2 e substitui a v1 em `telaviva.vercel.app`.

**Arquitetura:**
- **Service worker (Serwist):**
  - guarda os arquivos do build, as páginas visitadas, os dados públicos de catálogo e as imagens do TMDb, com regras próprias;
  - nunca guarda nada pessoal;
  - sem rede, uma página aberta do zero cai na página "Sem conexão".
- **Biblioteca de quem tem conta:** um repositório "offline" envolve o repositório de servidor da Fase 3:
  - lê a última cópia guardada (IndexedDB, por conta) quando o servidor não responde;
  - aplica as ações na hora sobre essa cópia, com o mesmo redutor da Fase 2;
  - põe na fila o que não chegou ao servidor.
- **Servidor:**
  - o comando aceita `at`, o horário da ação no aparelho;
  - uma tabela de marcas de remoção impede que uma escrita atrasada recrie algo removido depois em outro aparelho;
  - a remoção atrasada não apaga o que mudou depois dela.
- **Identidade offline:** com a dica `tv_auth=1` e a última identidade guardada, quem tem conta continua logado sem rede.

**Stack:** a da Fase 3 mais:
- `@serwist/turbopack@9.5.13`, `serwist@9.5.13` e `esbuild@0.28.2` (dev);
- `idb@8.0.3`;
- `fake-indexeddb@6.2.7` (dev);
- Lighthouse por `npx lighthouse@13.6.0`, sem entrar no `package.json`.

Fixe as versões exatas, todas publicadas há mais de duas semanas.

**Spec:** [docs/superpowers/specs/2026-11-21-telaviva-v2-fase4-design.md](../specs/2026-11-21-telaviva-v2-fase4-design.md). Ele fica acima deste plano e do [design da v2](../specs/2026-11-18-telaviva-v2-design.md). Quem executar deve ler o spec da Fase 4 inteiro, porque as anti-metas da §4 são critério de aceite.

## Restrições globais

1. Valem todas as restrições das Fases 1–3:
   - Node 24, versões fixadas, pt-BR;
   - tokens só no `@theme` de `src/app/globals.css`;
   - `prefers-reduced-motion`;
   - arquivos de até ~200 linhas;
   - ícones só lucide;
   - TMDb só via Bearer;
   - imagens direto do CDN do TMDb;
   - crédito "Powered by TMDB API & JustWatch";
   - login opcional e desligável: sem as variáveis do Firebase ou do banco, o site funciona como visitante.
2. **Commits** em inglês (`feat:`/`fix:`/`chore:`/`test:`/`docs:`), **sem `Co-Authored-By` e sem menção a Claude ou IA**. **Sem push, merge ou mudança na Vercel/Firebase/Neon sem aprovação explícita do autor**: os commits ficam locais até ele aprovar.
3. **Testes:**
   - `npm test` (nunca `npx vitest`), `npm run lint` (0 avisos), `npm run typecheck`, `npm run e2e` e `npm run build` por último, com o `.env.local` real;
   - uma suíte por vez;
   - servidores e emuladores iniciados são encerrados por PID;
   - não mexer no processo do test-server do Playwright da IDE nem nos servidores MCP.
4. Leia `node_modules/next/dist/docs/` antes de mexer em config, rotas ou recursos experimentais: `01-app/02-guides/offline-support.md`, `01-app/02-guides/progressive-web-apps.md`, `01-app/03-api-reference/05-config/01-next-config-js/useOffline.md`.
5. **Segredos:** nunca imprima nem commite valores do `.env.local` nem das variáveis da Vercel. O e-mail do autor é privado.
6. **Nada pessoal no cache do service worker:** `/api/library*`, `/api/account*`, `/api/auth*`, `/__/auth/*` e `/serwist/*` são sempre NetworkOnly. Qualquer requisição que não seja GET passa direto.
7. Não editar o `.gitignore`. O autor tem uma alteração própria nele, sem commit, que nunca entra em commits.
8. **Custo zero:** Firebase Spark, Neon Free e Vercel Hobby.

## Valores fixados (usar exatamente)

- **Serwist:**
  - rota `src/app/serwist/[path]/route.ts`;
  - `swUrl="/serwist/sw.js"`;
  - fonte do worker em `src/sw/sw.ts`, com `src/sw/tsconfig.json` próprio (`lib: ["esnext", "webworker"]`) e excluída do `tsconfig.json` raiz;
  - revisão das entradas extras: `process.env.VERCEL_GIT_COMMIT_SHA ?? <hash sha256 do conteúdo do arquivo da página>`, nunca `git` no build.
- **Página offline:** caminho `/~offline`. Pré-carregadas na instalação: `/~offline`, `/minha-lista`, `/`.
- **Caches do service worker** (nome → estratégia → limites):

  | Nome | O que guarda | Estratégia | Limites |
  |---|---|---|---|
  | `tv-pages` | documentos e RSC do próprio site | NetworkFirst, `networkTimeoutSeconds: 3` | 80 entradas, 14 dias |
  | `tv-static-reserve` | `/_next/static/**` | CacheFirst | 400 entradas, 30 dias |
  | `tv-catalog-api` | GET `/api/tv/*` (menos `/api/tv/progress`), `/api/catalog/*`, `/api/discover`, `/api/search` | NetworkFirst, `networkTimeoutSeconds: 3` | 120 entradas, 1 dia |
  | `tv-images` | `https://image.tmdb.org/**` | CacheFirst | 300 entradas, 30 dias, `purgeOnQuotaError: true` |

- **Botão de emergência:** `NEXT_PUBLIC_SW_DISABLED=1` faz o provider não registrar o worker, desregistrar os existentes e apagar os caches `tv-*` e `serwist-*`.
- **Fila e cópia local:**
  - banco IndexedDB `telaviva-offline`, versão 1;
  - stores:
    - `snapshots`: chave uid, valor `{ state: LibraryState; savedAt: string }`;
    - `queue`: chave `id`, índice `uid`, valor `QueuedCommand`;
    - `meta`: chave string, guardando `identity:<uid>`, `last-identity`, `sign-out-pending` e `progress:<identity>`;
  - idade máxima de uma ação na fila: **30 dias**;
  - espera entre tentativas: 2 s, 4 s, 8 s… até **5 min**;
  - lock de envio: `navigator.locks.request('telaviva-queue', …)`;
  - canal entre abas: `BroadcastChannel('telaviva-library')`.
- **Servidor:**
  - `at` aceito se `now - 30 dias <= at`. Acima de `now` vira `now` (regra do `clamp.ts`). Abaixo do limite → 400 `{ error: 'stale' }`;
  - marcas de remoção apagadas depois de **60 dias**;
  - deduplicação por `commandId` (uuid) guardado junto da marca de aplicação por **30 dias**.
- **Séries salvas para offline:**
  - até **12** séries com status `watching`, por `updatedAt` mais recente;
  - temporada atual e a seguinte;
  - de novo no máximo a cada **6 h** por série;
  - nunca com `navigator.connection?.saveData === true` nem com a página oculta.
- **Indicador de conexão:** o aviso de navegação pendente aparece depois de **1.500 ms**.
- **Textos** (exatos):
  - Página offline:
    - título `{ lead: 'Sem', accent: 'conexão' }`;
    - texto "Você está sem internet e esta página ainda não foi salva neste aparelho.";
    - links "Minha lista" e "Início";
    - botão "Tentar de novo".
  - Indicador:
    - "Sem conexão. Suas ações serão enviadas quando a internet voltar.";
    - com fila: "1 ação aguardando envio" / "{n} ações aguardando envio";
    - ao esvaziar a fila: "Tudo sincronizado.";
    - navegação pendente: "Esta página abre quando a internet voltar.", com o link "Ver minha lista".
  - Sair com fila:
    - "Você tem {n} ações não enviadas. Sair agora descarta essas ações." (no singular: "Você tem 1 ação não enviada. Sair agora descarta essa ação.");
    - botões "Sair mesmo assim" e "Cancelar".
  - Ação recusada pelo servidor ao sincronizar (4xx de validação): "Uma ação feita sem internet não pôde ser salva."
  - Fila velha descartada: "Algumas ações feitas sem internet há mais de 30 dias foram descartadas."
  - Ações que exigem rede (entrar, criar conta, exportar, excluir conta, reenviar e-mail) quando offline: "Você precisa de internet para isso."

## Foco de revisão

1. **Deploy novo com uma aba aberta.** A aba antiga continua funcionando: pedaços de JS antigos vêm do `tv-static-reserve`. A próxima navegação recebe a versão nova. Ninguém fica preso numa versão velha depois de fechar e abrir o app.
   *Teste:* Task 1 (regra do reserve) e Task 12 (verificação manual com dois deploys no preview).
2. **Duas abas offline que voltam à rede ao mesmo tempo.** Cada ação é enviada uma vez só, e as duas abas mostram o mesmo estado no fim.
   *Teste:* Task 5.
3. **Aparelho compartilhado.** A sai offline e B usa o aparelho:
   - B nunca vê a lista nem a fila de A;
   - o cookie de A é apagado no servidor antes de qualquer outra chamada quando a rede volta;
   - a fila de A nunca é enviada para B.

   *Teste:* Task 6 e Task 8.
4. **Escrita atrasada contra remoção mais nova, e o inverso.**
   - A marca offline às 10h, B remove a série às 11h, e a fila de A chega às 12h → a série não volta.
   - A remove offline às 10h, B muda às 11h, e a remoção chega às 12h → o item de B fica.

   O mesmo vale para nota e episódio.
   *Teste:* Task 3.
5. **Abrir o app offline estando logado.** A pessoa continua logada, com a lista guardada, e não cai para visitante. Quando a rede volta e o servidor dá um 401 verdadeiro, segue o fluxo de sessão expirada da Fase 3, e a fila fica guardada.
   *Teste:* Task 6 e Task 8.

---

### Task 1: Service worker com Serwist e página "Sem conexão"

**Arquivos:**
- Criar:
  - `src/app/serwist/[path]/route.ts`;
  - `src/sw/sw.ts`;
  - `src/sw/rules.ts` (regras de cache como dados puros testáveis);
  - `src/sw/tsconfig.json`;
  - `src/app/~offline/page.tsx`;
  - `src/features/offline/ServiceWorker.tsx` (provider e botão de emergência);
  - `e2e/offline.spec.ts`.
- Modificar:
  - `next.config.ts` (`withSerwist`);
  - `src/app/layout.tsx` ou `src/app/providers.tsx`;
  - `tsconfig.json` (excluir `src/sw`);
  - `playwright.config.ts` (`serviceWorkers: 'block'` no `use` padrão);
  - `package.json`.
- Testes: `src/sw/rules.test.ts`, `src/features/offline/ServiceWorker.test.tsx`, `e2e/offline.spec.ts`

**Interfaces:**
- Produz:
  - `CACHE_NAMES` e `runtimeCaching: RuntimeCaching[]` em `src/sw/rules.ts`;
  - `isPrivateRequest(url: URL, method: string): boolean`. Verdadeiro para não-GET e para os prefixos privados da Restrição 6;
  - `<ServiceWorker>{children}</ServiceWorker>`, que registra `/serwist/sw.js` fora do `next dev` ou desregistra tudo com `NEXT_PUBLIC_SW_DISABLED=1`.

- [ ] **Step 1: Testes que falham:**
  - `isPrivateRequest` → true para `POST /api/library/commands`, `GET /api/library`, `GET /api/account/export`, `GET /api/auth/me`, `GET /__/auth/handler`, `GET /serwist/sw.js`;
  - `isPrivateRequest` → false para `GET /api/tv/1399/season/1` e `GET /filmes`;
  - nenhuma regra de `runtimeCaching` casa com uma requisição privada;
  - a regra de `/api/tv/progress` não usa cache (a URL muda com a lista);
  - `ServiceWorker` com `NEXT_PUBLIC_SW_DISABLED=1` chama `unregister()` em cada registro e apaga só os caches `tv-*` e `serwist-*`.
- [ ] **Step 2:** `npm test -- src/sw src/features/offline` → FAIL.
- [ ] **Step 3: Implementar.**
  - `npm i -E @serwist/turbopack@9.5.13 serwist@9.5.13 idb@8.0.3 && npm i -E -D esbuild@0.28.2 fake-indexeddb@6.2.7`.
  - Serwist com `skipWaiting: true`, `clientsClaim: true`, `navigationPreload: true`, as regras de `rules.ts` e o fallback de documento para `/~offline`. **Não** usar o `defaultCache`.
  - A página `/~offline` usa o `PageTitle`/estado vazio já existentes, sem dados do TMDb, e os textos fixados.
- [ ] **Step 4: E2E** (`e2e/offline.spec.ts`, com `test.use({ serviceWorkers: 'allow' })`):
  - visitar `/` e `/filmes`, esperar `navigator.serviceWorker.ready` e recarregar;
  - `context.setOffline(true)`:
    - recarregar `/filmes` mostra a página;
    - `/series` (nunca visitada) mostra "Sem conexão";
    - `/minha-lista` abre;
  - nenhum cache contém URLs de `/api/library`, `/api/auth` ou `/api/account`;
  - axe sem violações na página offline.
- [ ] **Step 5:**
  - `npm test`, `npm run lint`, `npm run typecheck`, `npm run e2e` → PASS;
  - `npm run build` → PASS. No build local, conferir que `/serwist/sw.js` lista os arquivos de `/_next/static/` que as páginas referenciam;
  - registrar no ledger o caminho local (`/_next/static/chunks/…`). A Task 12 confere o da Vercel (`/_next/static/immutable/…`).
- [ ] **Step 6: Commit.** `git commit -m "feat: add a Serwist service worker with private-safe caching rules and an offline page"`

---

### Task 2: Estado de conexão e aviso offline

**Arquivos:**
- Criar:
  - `src/features/offline/ConnectionStatus.tsx`;
  - `src/features/offline/copy.ts`;
  - `src/features/offline/usePendingNavigation.ts`.
- Modificar:
  - `next.config.ts` (`experimental.useOffline: true`);
  - o Toaster (o indicador entra no mesmo espaço fixo, no slot mais baixo, como o banner de verificação da Fase 3);
  - os pontos que exigem rede (`SignInView`/`EmailForm`, exportar, excluir, reenviar e-mail), que passam a mostrar "Você precisa de internet para isso." quando `useOffline()` é verdadeiro.
- Testes: `src/features/offline/ConnectionStatus.test.tsx`, `src/features/offline/usePendingNavigation.test.ts`

**Interfaces:**
- Consome: `useOffline` de `next/offline`; `useQueueStatus()` da Task 5, que entra como prop opcional `queued?: number` até lá, para a Task 2 não depender da 5.
- Produz: `<ConnectionStatus queued={number} />` e `usePendingNavigation(delayMs = 1500): boolean`.

- [ ] **Step 1: Testes que falham:**
  - offline sem fila → o texto principal;
  - offline com 1 e com 3 ações → singular e plural exatos;
  - volta da rede com fila que vira 0 → "Tudo sincronizado." uma vez;
  - online sem fila → nada renderizado;
  - região `role="status"`/`aria-live="polite"`;
  - `usePendingNavigation` só fica verdadeiro depois de 1.500 ms de navegação pendente offline;
  - o botão "Entrar" offline mostra "Você precisa de internet para isso." e não chama o Firebase.
- [ ] **Step 2:** `npm test -- src/features/offline src/features/auth` → FAIL.
- [ ] **Step 3: Implementar.** `partialPrefetching` fica como está. Se precisar mudar, registrar o motivo no ledger.
- [ ] **Step 4:** `npm test` e `npm run e2e` → PASS. Acrescentar ao `e2e/offline.spec.ts`: offline → o indicador aparece; tocar num link para página não salva → depois de 1,5 s aparece "Esta página abre quando a internet voltar."; voltar a rede → a página abre sozinha.
- [ ] **Step 5: Commit.** `git commit -m "feat: show connection state, pending navigations and network-only actions while offline"`

---

### Task 3: Servidor — horário da ação, marcas de remoção e deduplicação

**Arquivos:**
- Criar:
  - `src/server/library/removals.ts` (ler, gravar e limpar marcas; filtrar um diff contra elas);
  - migração gerada por `npm run db:generate` em `drizzle/`.
- Modificar:
  - `src/server/db/schema.ts` (tabelas novas);
  - `src/features/library/command-schema.ts` (`at` e `commandId` opcionais no envelope);
  - `src/server/library/store.ts` (`applyLibraryCommand` com `at`);
  - `src/server/library/write.ts` (remoção guardada por horário);
  - `src/app/api/library/commands/route.ts`;
  - `src/server/account/*` (a exportação ignora marcas; a exclusão já apaga por FK em cascata — conferir).
- Testes: `src/server/library/removals.test.ts`, `src/server/library/store.offline.test.ts` (PGlite), `src/app/api/library/commands/route.test.ts`, `src/features/library/command-schema.test.ts`

**Interfaces:**
- **Tabelas novas** (com FK `users.id` em cascata):
  - `library_removals(user_id, kind text check in ('item','rating','mark'), media_type text not null, tmdb_id int not null, season_number int null, episode_number int null, removed_at timestamptz not null)`. Chave única em `(user_id, kind, media_type, tmdb_id, season_number, episode_number)` com `NULLS NOT DISTINCT` (Postgres 15+, ok no Neon e no PGlite). Para `mark`, `media_type = 'tv'`, `tmdb_id = tvId` e temporada e episódio preenchidos; para `item` e `rating`, temporada e episódio ficam nulos;
  - `applied_commands(user_id, command_id text, applied_at timestamptz)`. PK `(user_id, command_id)`.
- **Corpo de `POST /api/library/commands`:** passa a ser `{ command, at?: string, commandId?: string }`. Sem `at`, o comportamento é idêntico ao de hoje.
- **`applyLibraryCommand(db, userId, command, now, opts?: { at?: string; commandId?: string })`:**
  - o horário efetivo é `clamp(at ?? now)` e é passado ao redutor no lugar de `now`;
  - `at` mais velho que 30 dias → `LibraryStaleError` → 400 `{ error: 'stale' }`;
  - `commandId` já aplicado → devolve o estado atual sem escrever;
  - `previous` com a mesma semântica da Fase 3.
- **Regras de escrita** (todas com o horário efetivo `t`):
  - **Remoção** de item, nota ou marca:
    - só apaga a linha cujo `updated_at` (`watched_at` nas marcas) seja `<= t`;
    - grava ou atualiza a marca de remoção com `removed_at = greatest(removed_at, t)`.
  - **Upsert:**
    - continua guardado por `updated_at <= excluded` como hoje;
    - é **descartado** quando existe marca de remoção para a mesma chave com `removed_at > t`;
    - para marcas de episódio, vale a marca do próprio episódio e a de `item` da série (remover a série apaga as marcas, regra da Fase 2);
    - um upsert aceito apaga a marca de remoção da chave se `t >= removed_at`.
  - **Limpeza oportunista:** cada escrita apaga as marcas do usuário com `removed_at < now - 60 dias` e os `applied_commands` com mais de 30 dias. Isso entra na mesma transação.
  - **Restore** (desfazer) continua com fingerprint, sem `at`. Ele também respeita as marcas: só recria se o fingerprint bater.
- **Limites** (5.000 itens etc.) contam só linhas vivas. A exportação não inclui marcas.

- [ ] **Step 1: Testes que falham** (PGlite, com dois "aparelhos" simulados por `at`; marque cada caso):
  - remoção atrasada não apaga item, nota e marca atualizados depois de `at` (Foco 4b);
  - escrita atrasada não recria item, nota e marca removidos depois de `at` (Foco 4a), inclusive `setEpisodes` depois de `remove` da série;
  - escrita mais nova que a remoção recria a linha e apaga a marca;
  - mesmo `commandId` duas vezes → uma escrita só, e a segunda resposta igual ao estado atual;
  - `at` no futuro → gravado como `now`;
  - `at` de 31 dias atrás → 400 `stale`;
  - sem `at` → resultado idêntico ao atual, rodando os testes existentes de `store.test.ts` sem mudança;
  - limpeza: marca de 61 dias some na próxima escrita;
  - exportação sem marcas;
  - excluir a conta apaga `library_removals` e `applied_commands`.
- [ ] **Step 2:** `npm test -- src/server src/app/api/library src/features/library/command-schema` → FAIL.
- [ ] **Step 3: Implementar e gerar a migração** (`npm run db:generate`). A migração só **adiciona** tabelas: nada muda nas existentes.
- [ ] **Step 4:** `npm test` → PASS. `npm run e2e` → PASS (o E2E migra o PGlite do zero).
- [ ] **Step 5: Commit.** `git commit -m "feat: let queued commands carry their own time, with removal markers so late writes never undo newer changes"`

---

### Task 4: Armazenamento offline no aparelho (IndexedDB)

**Arquivos:**
- Criar:
  - `src/features/offline/store.ts`;
  - `src/features/offline/store-types.ts`.
- Testes: `src/features/offline/store.test.ts` (com `fake-indexeddb/auto`)

**Interfaces:**
- Produz:
  - `type QueuedCommand = { id: string; uid: string; command: LibraryCommand; at: string; attempts: number }`;
  - `openOfflineStore(): Promise<OfflineStore | null>`. `null` quando o IndexedDB não existe ou está bloqueado (Safari privado): aí tudo segue como hoje, sem offline para contas;
  - `OfflineStore` com:
    - `getSnapshot(uid)` / `putSnapshot(uid, state)` / `deleteSnapshot(uid)`;
    - `enqueue(item)` / `listQueue(uid)` / `removeQueued(id)` / `updateQueued(item)` / `countQueue(uid)`;
    - `dropExpired(uid, now): Promise<number>` (devolve quantas saíram, para o aviso de fila velha);
    - `getMeta<T>(key)` / `setMeta(key, value)` / `deleteMeta(key)`;
    - `wipeAccount(uid)`, que apaga snapshot, fila, `identity:<uid>` e `progress:<uid>`.

- [ ] **Step 1: Testes que falham:**
  - cada operação, ida e volta;
  - `listQueue` em ordem de inserção;
  - `dropExpired` remove só o que tem mais de 30 dias e devolve a contagem;
  - `wipeAccount(a)` não toca nos dados de `b`;
  - `openOfflineStore` sem `indexedDB` → `null`, sem lançar erro;
  - um estado inválido gravado por versão antiga é descartado na leitura, validado com o `parseLibraryEntries` existente.
- [ ] **Step 2:** `npm test -- src/features/offline/store` → FAIL.
- [ ] **Step 3: Implementar** com `idb`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: add the on-device offline store for account snapshots, the action queue and identity"`

---

### Task 5: Repositório offline da conta e envio da fila

**Arquivos:**
- Criar:
  - `src/features/library/offline-repository.ts`;
  - `src/features/library/queue-flusher.ts`;
  - `src/features/library/useQueueStatus.ts`.
- Modificar:
  - `src/features/library/server-repository.ts` (`apply` e `applyWithPreImage` aceitam `opts?: { at?: string; commandId?: string }` e mandam o envelope novo);
  - `src/features/library/LibraryProvider.tsx` (`createFor` usa o repositório offline no modo conta quando `openOfflineStore()` não é `null`);
  - o fluxo de desfazer em `src/features/library/actions.ts`/`hooks.ts`;
  - `ConnectionStatus` (recebe `queued` de `useQueueStatus`).
- Testes: `src/features/library/offline-repository.test.ts`, `src/features/library/queue-flusher.test.ts`, `src/features/library/hooks.offline.test.tsx`

**Interfaces:**
- Consome: Task 3 (envelope com `at`/`commandId`) e Task 4 (`OfflineStore`).
- Produz:
  - `createOfflineAccountRepository({ server, store, uid, now? }): LibraryRepository`, com o mesmo contrato de `LibraryRepository`:
    - `load()`:
      - tenta o servidor; com sucesso, grava o snapshot e devolve o estado do servidor com as ações da fila reaplicadas por cima (`applyCommand`, em ordem);
      - com `LibraryRemoteError` de rede, devolve o snapshot com a fila reaplicada;
      - sem snapshot, propaga o erro;
      - `LibrarySessionError` e `LibraryWrongAccountError` passam direto, como hoje.
    - `applyWithPreImage(command)`:
      - online, com a fila vazia, vai direto ao servidor (com `commandId`) e grava o snapshot;
      - com fila não vazia, ou com erro de **rede**, aplica localmente sobre snapshot + fila, enfileira `{ id: crypto.randomUUID(), uid, command, at: now(), attempts: 0 }` e devolve `{ state, previous: null }`. Sem pré-imagem do servidor, o desfazer usa o caminho da Task 5 descrito abaixo.
  - `createQueueFlusher({ store, server, uid, onSettled })`, que dispara nos eventos `online`, `visibilitychange` visível, montagem e depois de cada sucesso:
    - roda dentro de `navigator.locks.request('telaviva-queue', { ifAvailable: true }, …)`. Sem `navigator.locks`, roda direto;
    - envia em ordem com `at` e `commandId`;
    - política de erro:
      - rede/5xx → para e agenda nova tentativa com espera crescente (2 s → 5 min);
      - 401 → o `onUnauthenticated` existente; se renovar, continua; senão, para e mantém a fila;
      - 409 `wrong_account` → para;
      - 400 (`stale` ou validação) → remove aquela ação, mostra o toast "Uma ação feita sem internet não pôde ser salva." e segue;
      - 409 `conflict` só ocorre em restore, que nunca é enfileirado; se ocorrer, descarta e segue;
    - ao terminar, grava o snapshot com a resposta do último envio e avisa as outras abas por `BroadcastChannel('telaviva-library')`. Elas recarregam a query da biblioteca;
    - antes de enviar, `dropExpired`. Se algo saiu, toast "Algumas ações feitas sem internet há mais de 30 dias foram descartadas."
  - `useQueueStatus(): { queued: number }`.
  - **Desfazer de ação ainda na fila:** remove o item da fila (`removeQueued`) e recalcula o estado local. Não envia `restore`. Desfazer de ação já enviada continua como na Fase 3.

- [ ] **Step 1: Testes que falham** (servidor falso com `fetch` simulado e `fake-indexeddb`):
  - offline → a ação aparece no estado na hora e na fila;
  - recarregar offline → snapshot + fila;
  - online de novo → a fila é enviada em ordem com `at` original e `commandId`, depois esvazia;
  - **duas abas** (dois flushers sobre o mesmo store, com `navigator.locks` simulado): cada ação é enviada exatamente uma vez (Foco 2);
  - 401 que renova → continua; 401 que não renova → fila intacta;
  - 400 `stale` → a ação sai e o toast aparece;
  - `wrong_account` → para sem enviar;
  - desfazer de ação na fila → some da fila e do estado, sem chamada ao servidor;
  - com fila pendente, uma nova ação online também vai para a fila, para preservar a ordem;
  - `load()` com o servidor respondendo reaplica a fila por cima, então a ação ainda não enviada continua visível.
- [ ] **Step 2:** `npm test -- src/features/library` → FAIL.
- [ ] **Step 3: Implementar.** Os toasts usam as tags da Fase 2, para não empilhar repetidos.
- [ ] **Step 4:** `npm test` e `npm run e2e` → PASS. Os E2E existentes de conta precisam continuar verdes sem mudança.
- [ ] **Step 5: Commit.** `git commit -m "feat: queue account actions taken offline and send them once, in order, when the connection returns"`

---

### Task 6: Identidade offline, sair offline e fim de sessão

**Arquivos:**
- Modificar:
  - `src/features/auth/session-renewal.ts` (`patientMe`/`renew`);
  - `src/features/auth/auth-flows.ts`;
  - `src/features/auth/auth-state.ts`;
  - `src/features/auth/AccountView.tsx` (ou o botão "Sair");
  - `src/features/auth/merge-on-login.ts`;
  - `src/features/library/LibraryProvider.tsx`.
- Criar: `src/features/auth/offline-identity.ts`, `src/features/auth/SignOutConfirm.tsx`
- Testes: `src/features/auth/offline-identity.test.ts`, `src/features/auth/AuthProvider.offline.test.tsx`, `src/features/auth/SignOutConfirm.test.tsx`

**Interfaces:**
- Consome: Task 4 (`OfflineStore`, chaves `identity:<uid>`, `last-identity` e `sign-out-pending`) e Task 5 (`countQueue`).
- Produz:
  - `rememberIdentity(store, user: SessionUser)`, chamado a cada `signedIn`;
  - `offlineIdentity(store): Promise<SessionUser | null>`.
- **Regras:**
  - **Início sem rede.** Se `hasAuthHint()`, e `/api/auth/me` falha por rede ou 5xx depois das tentativas da Fase 3, e existe `last-identity`, o app fica `signed-in` com essa identidade. A biblioteca usa o repositório offline. Hoje cairia para `guest`. Sem identidade guardada, segue como hoje.
  - **401 verdadeiro**, ao voltar a rede ou em qualquer momento: segue o fluxo de sessão expirada da Fase 3. **A fila daquela conta fica guardada.** O snapshot é apagado (`deleteSnapshot`).
  - **"Sair":**
    - com `countQueue(uid) > 0`, abre `SignOutConfirm` com os textos fixados; "Cancelar" não faz nada;
    - ao sair (online ou offline), `wipeAccount(uid)` e `signOut` do Firebase;
    - se o `DELETE /api/auth/session` falhar por rede, grava `sign-out-pending = { uid }` e segue como visitante;
    - enquanto essa marca existir, o início ignora a dica `tv_auth` e é visitante;
    - quando houver rede (evento `online` ou próxima carga), o `DELETE /api/auth/session` é a **primeira** chamada; só depois a marca sai.
  - **Excluir conta** (já exige rede): no sucesso, `wipeAccount(uid)`.
  - **Fila de outra conta:** o repositório e o flusher só leem `listQueue(uid)` da conta atual. Ao entrar como X, as ações guardadas de X são enviadas, depois de `dropExpired`.
  - **Mesclagem do primeiro login offline:** espera a rede (`online`), e a lista do visitante fica intacta até lá.

- [ ] **Step 1: Testes que falham:**
  - início offline com dica + identidade guardada → `signed-in` com a lista guardada, sem toast de sessão expirada (Foco 5);
  - início offline sem identidade → visitante como hoje;
  - 401 depois disso → toast de sessão expirada, snapshot apagado, fila mantida;
  - "Sair" com 2 ações → confirmação com o texto exato; "Cancelar" mantém tudo; "Sair mesmo assim" apaga snapshot e fila;
  - sair offline → `sign-out-pending`; recarregar → visitante mesmo com o cookie de dica; voltar a rede → `DELETE /api/auth/session` antes de qualquer outra chamada, depois a marca some (Foco 3);
  - entrar como B depois que A saiu offline → B nunca recebe dados nem fila de A (Foco 3);
  - excluir conta → `wipeAccount`;
  - mesclagem offline espera o `online`.
- [ ] **Step 2:** `npm test -- src/features/auth src/features/library` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** `npm test` e `npm run e2e` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: stay signed in offline, sign out safely without a connection and keep queued actions across expired sessions"`

---

### Task 7: Séries assistidas salvas para offline e progresso guardado

**Arquivos:**
- Criar: `src/features/offline/warm-watching.ts`, `src/features/offline/useWarmWatching.ts`
- Modificar:
  - `src/features/library/useTvProgress` (ou onde `/api/tv/progress` é chamado), para guardar e ler a última resposta em `meta` `progress:<identity>`;
  - o lugar que monta providers globais, para ligar `useWarmWatching`.
- Testes: `src/features/offline/warm-watching.test.ts`, teste do progresso guardado

**Interfaces:**
- Consome: a biblioteca (itens `watching`), as funções existentes de próxima temporada/episódio (`progress.ts`) e Task 4.
- Produz: `planWarmUp(items, lastWarm: Record<string, string>, now): { url: string; key: string }[]` (puro), que devolve:
  - as URLs das páginas das séries (`/serie/{id}-{slug}`, usando o helper de slug existente);
  - `/api/tv/{id}/season/{n}` da temporada atual e da seguinte;
  - até 12 séries, respeitando o intervalo de 6 h.
- **Aquecimento:**
  - `useWarmWatching` faz `fetch(url, { priority: 'low' })` das URLs. O service worker guarda as respostas nas regras da Task 1: páginas em `tv-pages`, temporadas em `tv-catalog-api`;
  - só roda com `document.visibilityState === 'visible'`, `navigator.onLine` verdadeiro e sem `saveData`;
  - não roda no `next dev` nem com o botão de emergência ligado;
  - o horário do último aquecimento por série fica em `meta` `warm:<identity>`.
- **Progresso offline:** quando `/api/tv/progress` falha por rede, usa a última resposta guardada para a identidade atual. Assim, "Continue assistindo" e "Próximo: T…E…" continuam aparecendo.

- [ ] **Step 1: Testes que falham:**
  - `planWarmUp` limita a 12, ordena por `updatedAt`, pula séries aquecidas há menos de 6 h e inclui temporada atual e seguinte (sem a seguinte se não existir);
  - `useWarmWatching` não busca com `saveData`, com a página oculta ou offline;
  - o progresso offline vem da cópia guardada, e o de outra identidade nunca é usado.
- [ ] **Step 2:** `npm test -- src/features/offline src/features/library` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: save the series being watched for offline use and keep the last progress on the device"`

---

### Task 8: E2E offline de ponta a ponta

**Arquivos:**
- Modificar: `e2e/offline.spec.ts`
- Criar: `e2e/offline-account.spec.ts`. Usa o Auth Emulator e o PGlite da Fase 3 e os helpers de `e2e/auth-helpers.ts`.

- [ ] **Step 1: Cenários** (todos com `serviceWorkers: 'allow'`):
  - **Visitante, o caso do metrô:**
    - marcar "assistindo" numa série e esperar o aquecimento;
    - offline, recarregar `/minha-lista`;
    - abrir a série nunca visitada nesta aba, mas aquecida;
    - marcar o próximo episódio;
    - recarregar offline → continua marcado.
  - **Conta:**
    - entrar e marcar "assistindo";
    - offline, recarregar → continua logado, a lista aparece, o indicador mostra 0;
    - marcar um episódio → "1 ação aguardando envio";
    - online → "Tudo sincronizado.", e o `GET /api/library` (lido por um segundo contexto da mesma conta) tem a marca.
  - **Conflito com dois aparelhos** (dois contextos da mesma conta):
    - A offline marca um episódio;
    - B (online) remove a série;
    - A volta → a série continua removida nos dois (Foco 4).
  - **Sair offline:**
    - offline, "Sair" com 1 ação → confirmação → "Sair mesmo assim";
    - recarregar offline → visitante;
    - online → o cookie `tv_session` some (conferido por `context.cookies()`) antes de qualquer chamada de biblioteca (Foco 3).
  - **Privacidade:** depois de tudo, nenhum cache do service worker contém `/api/library`, `/api/account` ou `/api/auth`.
- [ ] **Step 2:** `npm run e2e` → PASS nos dois projetos (desktop e mobile). Se um cenário não roda num projeto, `test.skip` com o motivo escrito.
- [ ] **Step 3: Commit.** `git commit -m "test: cover offline use end to end for visitors and accounts"`

---

### Task 9: Auditoria de desempenho e polimento visual

**Arquivos:** conforme os achados. Registrar antes e depois em `docs/audits/2026-11-fase4-desempenho.md`.

- [ ] **Step 1: Medir.**
  - `npm run build`, depois `npx next start -p 3001` com o `.env.local` real;
  - `npx lighthouse@13.6.0 <url> --preset=perf --form-factor=mobile --screenEmulation.mobile --throttling-method=simulate --output=json --output-path=<arquivo>`, em `/`, `/filmes`, um filme, uma série, `/minha-lista` e `/buscar`;
  - três execuções por página, guardando a mediana.
- [ ] **Step 2:** comparar com as metas: LCP < 2,5 s, CLS < 0,1 e TBT como proxy do INP < 200 ms. Para cada página fora da meta, achar a causa (imagem do herói, JS, fontes, cadeia de requisições) e corrigir. Conferir que a primeira visita com o service worker não piora o LCP.
- [ ] **Step 3: Polimento visual** nas telas das Fases 2–3 e da Fase 4, no celular (Pixel 7) e no desktop (1440 px): `/entrar`, `/conta`, Minha lista, indicador offline e página offline. Usar a skill `impeccable:impeccable` (`polish`). Corrigir o que for encontrado sem mudar a identidade visual.
- [ ] **Step 4:** `npm test`, `npm run e2e` e `npm run build` → PASS. Medir de novo e atualizar o documento.
- [ ] **Step 5: Commit(s)** pequenos por correção, por exemplo `perf: …` / `fix: …`, e `docs: record the phase 4 performance audit`.

---

### Task 10: Acessibilidade, segurança, SEO e pendências da Fase 3

**Arquivos:**
- Modificar:
  - `next.config.ts` (`headers()`);
  - `e2e/a11y.spec.ts` (ou equivalente);
  - `src/features/auth/ReauthStep.tsx` (campo de usuário escondido).
- Criar: `src/app/robots.ts`, `src/app/sitemap.ts`, `docs/audits/2026-11-fase4-seguranca-a11y.md`
- Testes: `src/app/robots.test.ts`, `src/app/sitemap.test.ts`, teste de cabeçalhos (rota `/` via `next start` no E2E ou teste de config), `ReauthStep.test.tsx`

- [ ] **Step 1: Testes que falham:**
  - `robots` libera tudo menos `/conta`, `/entrar`, `/api/` e `/serwist/`, e aponta o sitemap em `SITE_URL`;
  - `sitemap` tem `/`, `/filmes`, `/series`, `/descobrir`, `/generos`, as listas de `src/app/filmes/[lista]` e `src/app/series/[lista]` e as páginas de gênero; nada de conta;
  - a resposta de `/` traz:
    - `X-Content-Type-Options: nosniff`;
    - `Referrer-Policy: strict-origin-when-cross-origin`;
    - `Permissions-Policy: camera=(), microphone=(), geolocation=()`;
    - `X-Frame-Options: DENY`;
  - o formulário de reautenticação tem `<input type="email" autocomplete="username" hidden>` com o e-mail da conta e a senha com `autocomplete="current-password"`;
  - axe sem violações em `/entrar`, `/conta` (logado), página offline e indicador offline visível.
- [ ] **Step 2:** `npm test` e `npm run e2e` → FAIL nos casos novos.
- [ ] **Step 3: Implementar.**
  - **CSP:** tentar `Content-Security-Policy-Report-Only` primeiro, cobrindo:
    - o próprio site;
    - `image.tmdb.org`;
    - YouTube (`www.youtube-nocookie.com`, `i.ytimg.com`);
    - Firebase (`*.googleapis.com`, `apis.google.com`, `<projeto>.firebaseapp.com`);
    - `/__/auth`.

    Rodar o E2E e o login real local. Promover para `Content-Security-Policy` só se nada quebrar; senão, deixar só os outros cabeçalhos e registrar o motivo no documento de auditoria.
  - **Teclado:** passada manual em todos os fluxos (abrir, navegar, adicionar, marcar episódio, nota, entrar, excluir conta, indicador offline). Registrar e corrigir.
  - **Contraste:** conferir âmbar e `ivory-muted` sobre `ink-950`/`ink-900`/`ink-800`, mínimo AA. Corrigir nos tokens se faltar.
  - **Dependências:** `npm audit --omit=dev` sem alta ou crítica. Corrigir com atualização fixada ou registrar por que não se aplica.
  - **Revisão de segurança:** rodar a skill `security-review` nas mudanças da Fase 4 (fila, `at`, `commandId`, marcas, cabeçalhos).
- [ ] **Step 4:** `npm test`, `npm run lint`, `npm run typecheck`, `npm run e2e` e `npm run build` → PASS.
- [ ] **Step 5: Commit(s)**, por exemplo `feat: add robots and sitemap`, `fix: add security headers`, `fix: let password managers fill the re-authentication form`, `docs: record the phase 4 security and accessibility audit`.

---

### Task 11: Documentação da v2 e checagem de ambiente

**Arquivos:**
- Reescrever: `README.md`, `docs/contributing/pull-request-workflow.md`, `docs/contributing/issue-triage.md`, `docs/maintenance/branch-protection.md`
- Criar: `docs/setup/configuracao.md` (juntando `docs/setup/fase3-contas.md` e os passos de produção; o arquivo antigo vira um link para o novo) e `scripts/check-env.ts`
- Modificar: `.env.example`, `package.json` (`"env:check": "tsx scripts/check-env.ts"`)
- Testes: `scripts/check-env.test.ts` (ou `src/lib/check-env.test.ts` se a lógica ficar em `src/lib`)

**Interfaces:**
- Produz: `checkEnv(source: Record<string, string | undefined>, target: 'local' | 'preview' | 'production'): { missing: string[]; invalid: string[] }`.
  - Lista só **nomes**, nunca valores.
  - `invalid` inclui uma `FIREBASE_PRIVATE_KEY` que não passa por `normalizePrivateKey` + `describeKeyProblem` (de `src/lib/private-key.ts`), um `NEXT_PUBLIC_SITE_URL` que não é URL e `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` com `localhost` em `preview`/`production`.
  - `npm run env:check` lê o `.env.local`.

- [ ] **Step 1: Testes que falham:**
  - `checkEnv` aponta cada variável ausente por nome;
  - chave privada sem `-----BEGIN` → `invalid: ['FIREBASE_PRIVATE_KEY']`;
  - nenhuma saída contém um valor.
- [ ] **Step 2:** `npm test -- check-env` → FAIL.
- [ ] **Step 3: Implementar e escrever.**
  - **README em pt-BR, para portfólio e para quem vai rodar o projeto:**
    - o que é;
    - capturas de tela (celular e desktop, salvas em `docs/screenshots/`, tiradas do build local);
    - recursos;
    - stack com versões;
    - arquitetura em poucas linhas (domínios, biblioteca local/servidor, offline com fila e marcas de remoção, sessão por cookie);
    - como rodar (variáveis, `npm run env:check`, emulador, PGlite nos testes);
    - testes e CI;
    - créditos TMDb/JustWatch;
    - licença.
  - **`.env.example`:** conferido contra todas as variáveis lidas no código (`grep process.env`), com comentário curto em cada uma e sem valores reais.
  - **Guias de contribuição e manutenção:** atualizados para a v2. Os nomes dos checks do CI estão em `.github/workflows/ci.yml`.
- [ ] **Step 4:** `npm test`, `npm run lint` e `npm run env:check` (com o `.env.local` real → nada faltando para `local`).
- [ ] **Step 5: Commit(s):** `docs: rewrite the README for v2`, `docs: update the contributing and maintenance guides`, `feat: add an env check that names missing or malformed variables without printing values`.

---

### Task 12: Preview, produção e lançamento (depende do autor)

Cada passo que mexe em GitHub, Vercel, Firebase ou Neon **espera a aprovação explícita do autor**. Peça uma vez por grupo, dizendo o que vai acontecer.

- [ ] **Step 1: Preview** (aprovação: push da `v2`):
  - acompanhar o build;
  - no preview (link de compartilhamento), conferir que `/serwist/sw.js` responde e que **as URLs do precache existem no preview**, pedindo cada uma e esperando 200. Esse é o ponto `/_next/static/immutable/…` do spec §5. Se não baterem, corrigir com `modifyURLPrefix`/`manifestTransforms` do Serwist e repetir;
  - conferir offline num navegador desktop;
  - conferir zero erros de runtime.
- [ ] **Step 2: Atualização com aba aberta** (Foco 1):
  - com o preview aberto numa aba, fazer outro deploy (commit pequeno de docs);
  - na aba antiga, navegar: nada quebra;
  - recarregar: versão nova (conferir pelo hash do `_buildManifest` ou pela revisão da página offline).
- [ ] **Step 3: Pedir ao autor** que teste no celular:
  - login com Google e com e-mail no PWA instalado;
  - o caso do metrô em modo avião;
  - sair offline.

  Registrar o resultado no ledger.
- [ ] **Step 4: Produção — configuração** (aprovação: mudanças na Vercel/Firebase/Neon):
  - variáveis do ambiente **Production**: TMDb, Firebase público, credencial de serviço, `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL=https://telaviva.vercel.app`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=telaviva.vercel.app`. Os valores vêm do `.env.local` ou do Preview, pela CLI, sem exibir valores (como foi feito com a chave em 2026-11-21);
  - `npm run env:check` adaptado para listar as variáveis da Vercel por nome (`vercel env ls`);
  - Firebase: `telaviva.vercel.app` em domínios autorizados e nas URIs de retorno do OAuth. Se o console exigir, isso é passo do autor;
  - Neon: `npm run db:migrate -- --confirm` com a migração da Task 3, antes do merge;
  - **Firewall da Vercel:** propor a regra de limite (por IP, por exemplo 120 req/min em `/api/recommendations`, `/api/tv/*` e `/api/auth/*`) e aplicar só com aprovação.
- [ ] **Step 5: Pull request `v2` → `main`** (aprovação: abrir o PR e fazer o merge):
  - descrição para portfólio, sem menção a IA, com resumo das quatro fases e links para os specs;
  - CI verde;
  - **merge normal** (sem squash).
- [ ] **Step 6: Verificação no ar:**
  - `https://telaviva.vercel.app`: página inicial, login com Google e com e-mail, uma ação na lista, offline (desktop e celular), zero erros de runtime;
  - Lighthouse mobile em produção (mesmo comando da Task 9), atualizando o documento de desempenho.
- [ ] **Step 7: Plano de volta, se algo falhar:**
  - rollback instantâneo da Vercel para o deploy anterior de produção (o da v1);
  - se o problema for o service worker, `NEXT_PUBLIC_SW_DISABLED=1` em Production e novo deploy;
  - a tag `v1` fica como referência.
- [ ] **Step 8:** registrar no ledger o que foi verificado, o que ficou com o autor e os lembretes (por exemplo, `!.env.example` no `.gitignore`).
