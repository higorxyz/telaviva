# TelaViva v2 — Fase 2: Biblioteca do visitante — Plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** dar ao visitante (sem login) uma biblioteca completa guardada no navegador: listas Quero ver, Assistindo e Assistidos; acompanhamento de séries episódio por episódio; nota pessoal de 1 a 10; recomendações; "Continue assistindo" na home; e a página Minha lista com estatísticas.

**Arquitetura:**
- Um domínio novo, `src/features/library`, com regras puras. Um redutor `applyCommand(state, command, now)` aplica cada ação (status, nota, episódios) e é a única fonte das regras do spec.
- A persistência fica atrás da interface `LibraryRepository` (`load`, `apply`, `subscribe`). Esta fase entrega a implementação local (`localStorage`, chave versionada). A Fase 3 troca por uma implementação de servidor com a mesma interface e o mesmo redutor.
- No cliente, o TanStack Query guarda o estado da biblioteca na chave `['library']`. As ações são mutações otimistas, que desfazem e avisam com um toast se falharem.
- Os dados do TMDb que as regras precisam chegam por props (páginas de detalhe, renderizadas no servidor) ou por rotas de API leves (progresso de séries em lote, temporada, recomendações).

**Stack:** a mesma da Fase 1: Next.js 16.4.6, React 19.3, TypeScript 6.0, Tailwind 4.3, Zod 4, TanStack Query 5, lucide-react, motion, Vitest 5 com Testing Library, MSW 3 e Playwright 1.65 com axe. **Nenhuma dependência nova.**

**Spec:** [docs/superpowers/specs/2026-11-18-telaviva-v2-design.md](../specs/2026-11-18-telaviva-v2-design.md). Valem as seções 6 (Modelo de dados, Regras de acompanhamento, Regras da nota pessoal, Detalhes decididos, Visitante e logado) e 7. Quem executar deve ler o spec e este plano.

**Fases seguintes:** a Fase 3 traz contas, sincronização, mesclagem visitante→conta e LGPD. A Fase 4 traz modo offline, auditorias, docs e a troca de produção.

## Restrições globais

- Versões e regras da Fase 1 continuam: Node 24 (`engines`), `next@16.4.6`, `react@19.3.1`, `typescript@~6.0.3`, pt-BR e região BR, `include_adult=false`, TMDb só com `Authorization: Bearer`, imagens direto do CDN do TMDb, tokens só no `@theme` de `src/app/globals.css` (nenhuma cor solta), `prefers-reduced-motion` respeitado, arquivos curtos (quebrar acima de ~200 linhas).
- Rodapé: crédito no formato "Powered by TMDB API & JustWatch" (decisão do autor, aceita pelo TMDb). Onde houver provedores: "Dados de streaming fornecidos por JustWatch.".
- **Commits:** pequenos, em inglês, `feat:`/`fix:`/`chore:`/`test:`. **Sem linha `Co-Authored-By` e sem nenhuma menção a Claude ou IA** (regra do autor). **Sem push**: os commits ficam só locais até o autor aprovar.
- Testes: rode sempre `npm test` (wrapper do Vitest; nunca `npx vitest` direto, por causa de um bug de letra de unidade no Windows), `npm run lint` (0 avisos), `npm run typecheck`, `npm run build` e `npm run e2e`. Uma suíte por vez. Servidores iniciados para verificação são encerrados por PID ao final.
- Antes de qualquer edição de UI, leia `C:/Users/higorxyz/.claude/plugins/cache/impeccable/impeccable/4.9.2/skills/impeccable/reference/craft-floor.md`. Os banimentos valem: sem eyebrow/kicker, sem glifo Unicode no lugar de ícone (use lucide-react).
- Next 16 mantém a rota anterior montada num `<Activity>` oculto. Efeitos de componentes de biblioteca devem tolerar ficar ocultos e voltar.
- Rotas `[id]-[slug]`: não leia `searchParams` no nível da página (quebra os 308/404 reais). Componentes de biblioteca são Client Components que leem do cliente.
- Hidratação: o servidor não conhece a biblioteca. Toda UI que depende dela renderiza um estado neutro no servidor e no primeiro render do cliente, e só mostra o estado real depois do carregamento. Nunca deve haver erro de hidratação.
- Datas: "hoje" é `saoPauloIsoDate()` (`src/features/tmdb/dates.ts`). Datas exibidas com `formatDate`. Notas com vírgula (`formatRating`).
- Status por tipo: filmes usam só `want` e `watched`; `watching` é exclusivo de séries. Especiais (temporada 0) aparecem e podem ser marcados, mas não contam para progresso, "em dia" nem estatísticas.

## Valores fixados (usar exatamente)

- Chave de armazenamento: `telaviva:library:v1`. Backup de dado corrompido: `telaviva:library:v1:corrupt:<epoch ms>`. Marca da importação da v1: `telaviva:library:v1-import-done`. Chaves antigas da v1 (somente leitura, nunca apagar): `watchedMovies` e `toWatchMovies`.
- Chave do TanStack Query: `['library']`.
- Rótulos: "Quero ver", "Assistindo", "Assistido". Abas: "Assistindo", "Quero ver", "Assistidos". Botões: "Quero ver" e "Já assisti" (ambos com `aria-pressed`), "Dar nota", "Sua nota", "Remover nota", "Marcar como visto"/"Visto" (`aria-pressed`), "Até aqui" (`aria-label="Marcar até T{s}E{e}"`), "Marcar temporada"/"Desmarcar temporada".
- Progresso: "Próximo: T{s}E{e}" (mais " · {nome}" quando conhecido), "Em dia", "Próximo episódio em {data}", "Série concluída", "Novos episódios".
- Toasts: "Salvo em Quero ver", "Removido da sua lista", ação "Desfazer". Erro ao salvar: "Não foi possível salvar no navegador. Tente de novo.". Armazenamento bloqueado: "Seu navegador está bloqueando o armazenamento. A lista vale só até fechar a aba.".
- URL da Minha lista: `aba=assistindo|quero-ver|assistidos`, `tipo=filme|serie`, `ordem=recentes|titulo|nota|ano`. Padrões: aba `assistindo` se houver série em andamento, senão `quero-ver`; tipo vazio (ambos); ordem `recentes`. Valores inválidos caem no padrão.
- Trilhos da home: id `continue-assistindo`, título `{ lead: 'Continue', accent: 'assistindo' }`; id `recomendados`, título `{ lead: 'Recomendados', accent: 'para você' }`.
- Limites das rotas: `/api/tv/progress` aceita no máximo 40 ids; `/api/recommendations` aceita no máximo 12 sementes e 500 chaves de exclusão. Acima disso, 400.
- Pesos das recomendações: nota 8–10 → 2; nota 5–7 → 1; nota 1–4 → −1,5; sem nota e status `watched` ou `watching` → 1; sem nota e `want` → 0,5. Sementes: até 8 positivas (maior peso, depois `updatedAt` mais recente) e até 4 negativas.

## Foco de revisão

1. **`localStorage` bloqueado, cheio ou corrompido.** O site continua funcionando. Bloqueado → memória, com o aviso uma vez. Cheio → a ação desfaz e mostra o toast de erro. Corrompido → o texto bruto vai para a chave de backup antes de recomeçar vazio. Nada é apagado sem cópia. *Teste:* Task 3.
2. **Duas abas abertas.** Uma ação numa aba aparece na outra, e uma aba nunca sobrescreve o que a outra salvou. Cada `apply` relê o armazenamento antes de gravar, e o evento `storage` invalida o cache. *Teste:* Task 3 (releitura) e Task 4 (invalidação).
3. **A série muda depois que o usuário a marcou.** Exemplo: uma temporada nova sai depois de "Série concluída", ou uma série "em dia" ganha episódios. O progresso é derivado na leitura e mostra "Novos episódios" / "Próximo: T9E1", sem depender de nova ação. *Teste:* Task 2 (`seriesProgress`) e Task 11 (subtítulo na Minha lista).
4. **TMDb fora do ar ou título sem pôster/ano.** A Minha lista e os trilhos renderizam a partir dos retratos salvos. O subtítulo de progresso some, o trilho de recomendações some, e nada quebra. *Teste:* Task 11 e Task 13.
5. **Toques rápidos repetidos** (alternar duas vezes seguidas, ou marcar e desmarcar). O estado final é consistente, sem "voltar" para um valor antigo quando uma mutação termina depois de outra. *Teste:* Task 4.

---

### Task 1: Domínio da biblioteca: tipos, esquema e regras de status e nota

**Arquivos:**
- Criar: `src/features/library/types.ts`, `src/features/library/schema.ts`, `src/features/library/snapshot.ts`, `src/features/library/commands.ts`
- Testes: `src/features/library/schema.test.ts`, `src/features/library/commands.test.ts`, `src/features/library/snapshot.test.ts`

**Interfaces:**
- Produz:
  - `type LibraryStatus = 'want' | 'watching' | 'watched'`
  - `interface TitleSnapshot { title: string; posterPath: string | null; releaseDate: string | null; genreIds: number[] }`
  - `interface LibraryItem { mediaType: MediaType; tmdbId: number; status: LibraryStatus; addedAt: string; updatedAt: string; watchedAt: string | null; snapshot: TitleSnapshot }`
  - `interface EpisodeMark { tvId: number; seasonNumber: number; episodeNumber: number; watchedAt: string }`
  - `interface Rating { mediaType: MediaType; tmdbId: number; score: number; ratedAt: string; updatedAt: string }`
  - `interface LibraryState { version: 1; items: LibraryItem[]; episodes: EpisodeMark[]; ratings: Rating[] }` e `EMPTY_LIBRARY: LibraryState`
  - `parseLibraryState(raw: unknown): LibraryState | null` (Zod; null quando inválido; `score` inteiro 1–10; datas ISO)
  - `toSnapshot(m: Pick<MediaSummary, 'title' | 'posterPath' | 'releaseDate' | 'genreIds'>): TitleSnapshot`
  - `type TitleRef = { mediaType: MediaType; tmdbId: number }`
  - `type LibraryCommand` (união discriminada por `type`): `{ type: 'setStatus'; ref: TitleRef; status: LibraryStatus; snapshot: TitleSnapshot; progress?: TvProgressInfo }`, `{ type: 'remove'; ref: TitleRef }`, `{ type: 'rate'; ref: TitleRef; score: number; snapshot: TitleSnapshot }`, `{ type: 'unrate'; ref: TitleRef }`, `{ type: 'setEpisodes'; tvId: number; marks: { seasonNumber: number; episodeNumber: number }[]; watched: boolean; snapshot: TitleSnapshot; progress: TvProgressInfo }`. (`TvProgressInfo` vem da Task 2. Declare o tipo nesta task em `progress.ts` só com a forma, e a Task 2 implementa as funções.)
  - `applyCommand(state: LibraryState, command: LibraryCommand, now: string): LibraryState` (puro; nunca muta a entrada)
  - `findItem(state, ref)`, `findRating(state, ref)` e `itemKey(ref): string` (`'movie:550'`)

- [ ] **Step 1: Escrever os testes que falham.** Em `commands.test.ts`, com `now = '2026-11-19T12:00:00.000Z'` e um retrato fixo:
  - `setStatus` de filme para `want` cria o item com `addedAt = updatedAt = now`, `watchedAt: null`.
  - `setStatus` de filme para `watched` define `watchedAt = now`. Repetir o mesmo status só atualiza `updatedAt` (sem duplicar; "rever não é registrado").
  - `setStatus` de filme para `watching` lança `Error('watching is only for series')`.
  - `remove` apaga o item e, se for série, as marcas de episódio dela. A nota é mantida.
  - `rate` de filme sem item cria o item como `watched`. `rate` de filme em `want` move para `watched`. `rate` de série não cria item nem muda status.
  - `rate` com `score` fora de 1–10 ou não inteiro lança erro. `rate` repetido atualiza `score` e `updatedAt` e mantém `ratedAt`.
  - `unrate` remove só a nota.
  - A entrada nunca é mutada (`Object.freeze` profundo no estado de entrada).
  Em `schema.test.ts`: aceita um estado válido; rejeita `version: 2`, `score: 11`, `status: 'watching'` em filme e item sem `snapshot.title`; retorna null para texto que não seja objeto. Em `snapshot.test.ts`: copia só os quatro campos.
- [ ] **Step 2: Rodar e ver falhar.** `npm test -- src/features/library` → FAIL (módulos não existem).
- [ ] **Step 3: Implementar** `types.ts`, `schema.ts`, `snapshot.ts` e `commands.ts` (os casos `setEpisodes` e o `setStatus` com `progress` de série ficam para a Task 2. Por enquanto lance `Error('not implemented')` em `setEpisodes`).
- [ ] **Step 4: Rodar e ver passar.** `npm test -- src/features/library` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: add the library domain model, schema and status and rating rules"`

---

### Task 2: Progresso de séries e marcação de episódios

**Arquivos:**
- Criar: `src/features/library/progress.ts`
- Modificar: `src/features/library/commands.ts` (casos `setEpisodes` e `setStatus` de série)
- Testes: `src/features/library/progress.test.ts`, `src/features/library/commands.episodes.test.ts`

**Interfaces:**
- Consome: Task 1; `TvDetails` e `isAired` de `src/features/detail/seasons.ts`.
- Produz:
  - `interface TvProgressInfo { tvId: number; ended: boolean; seasons: { seasonNumber: number; episodeCount: number }[]; lastAired: { seasonNumber: number; episodeNumber: number } | null; nextToAir: { seasonNumber: number; episodeNumber: number; airDate: string | null } | null }`. Só temporadas regulares (> 0) com `episodeCount > 0`, em ordem.
  - `toProgressInfo(tv: TvDetails): TvProgressInfo`. `ended` = status `Ended` ou `Canceled`.
  - `airedEpisodes(info: TvProgressInfo): { seasonNumber: number; episodeNumber: number }[]`. Regra do limite: todos os episódios até `lastAired`, se ele for de temporada regular. Senão, até o episódio anterior a `nextToAir`, se ele for regular. Senão, todos, se `ended`. Senão, nenhum.
  - `type SeriesProgress = { kind: 'not-started' } | { kind: 'in-progress'; next: EpisodeRef; watched: number; total: number } | { kind: 'caught-up'; nextAirDate: string | null; watched: number; total: number } | { kind: 'finished'; watched: number; total: number }` (`EpisodeRef = { seasonNumber; episodeNumber }`)
  - `seriesProgress(info: TvProgressInfo, marks: EpisodeMark[]): SeriesProgress`. `next` = primeiro episódio exibido e não marcado. Marcas de temporada 0 não contam. `total` = exibidos.
  - `episodeCode(ref: EpisodeRef): string` → `'T1E6'`
  - `marksUpTo(info: TvProgressInfo, target: EpisodeRef): EpisodeRef[]`: exibidos regulares até o alvo, inclusive.

- [ ] **Step 1: Escrever os testes que falham.** Use um `info` montado à mão (temporadas 1:10, 2:10, 3:8; `lastAired` = T3E4; `ended: false`):
  - `airedEpisodes` tem 24 itens e termina em T3E4. Com `lastAired` em temporada 0 e `nextToAir` = T3E5, termina em T3E4. Sem os dois e `ended: true`, conta todos (28). Sem os dois e `ended: false`, nenhum.
  - `seriesProgress`: sem marcas → `not-started`. Marcas T1E1–E2 → `in-progress`, `next` T1E3, `watched` 2, `total` 24. Todas as 24 → `caught-up` com `nextAirDate` de `nextToAir`. Com `ended: true` e todas as 28 → `finished`. Uma marca T0E1 sozinha → `not-started`.
  - Foco 3: um `info` com mais episódios exibidos do que as marcas de uma série antes concluída → `in-progress` com o novo `next`.
  - `marksUpTo(info, T2E3)` tem 13 itens. `episodeCode({seasonNumber:1, episodeNumber:6})` é `'T1E6'`.
  - `toProgressInfo` de `src/test/fixtures/tv-1399.json` (passe pelo mapper existente de detalhes, ou monte um `TvDetails` mínimo): `ended: true`, 8 temporadas regulares, `lastAired` T8E6.
  Em `commands.episodes.test.ts`:
  - `setEpisodes` com `watched: true` numa série fora da biblioteca cria o item como `watching` com as marcas.
  - Uma série em `want` vai para `watching` ao marcar.
  - Marcar todos os exibidos de série `ended` → `watched` (`watchedAt = now`). Desmarcar um depois → volta para `watching`.
  - Marcar todos de série não terminada → continua `watching`.
  - Marcar de novo um episódio já marcado só atualiza `watchedAt` (sem duplicar). `watched: false` remove só as marcas listadas. Desmarcar tudo mantém a série em `watching`.
  - `setStatus` de série para `watched` com `progress` marca todos os exibidos regulares. Para `want`, mantém as marcas.
- [ ] **Step 2: Rodar e ver falhar.** `npm test -- src/features/library` → FAIL.
- [ ] **Step 3: Implementar** `progress.ts` e os casos de série em `commands.ts`. A reconciliação de status roda depois de toda mudança de episódio: (a) há marca e o item não existe ou está em `want` → `watching`; (b) `seriesProgress(...).kind === 'finished'` → `watched`; (c) item `watched` e `kind` diferente de `finished` → `watching`.
- [ ] **Step 4: Rodar e ver passar.** `npm test -- src/features/library` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: derive series progress and apply episode marking rules"`

---

### Task 3: Repositório local (`localStorage`)

**Arquivos:**
- Criar: `src/features/library/repository.ts` (interface), `src/features/library/local-repository.ts`, `src/features/library/v1-import.ts`
- Testes: `src/features/library/local-repository.test.ts`, `src/features/library/v1-import.test.ts`

**Interfaces:**
- Consome: Tasks 1 e 2.
- Produz:
  - `interface LibraryRepository { load(): Promise<LibraryState>; apply(command: LibraryCommand): Promise<LibraryState>; subscribe(onChange: () => void): () => void; readonly persistent: boolean }`
  - `createLocalRepository(opts?: { storage?: Storage | null; now?: () => string }): LibraryRepository`. Com `storage` nulo, ou que lança ao acessar, usa memória e `persistent = false`. O padrão é `window.localStorage` protegido por try/catch.
  - `importV1(storage: Storage, now: string): LibraryItem[]`: lê `watchedMovies` e `toWatchMovies` (arrays de objetos do TMDb com `id`, `title`, `poster_path`, `release_date` e `genre_ids`, todos opcionais exceto `id`) e gera itens `watched`/`want`. Se um filme estiver nas duas listas, `watched` vence. Ignora entradas sem `id` numérico.

- [ ] **Step 1: Escrever os testes que falham.** Use um `Storage` falso em memória e um que lança:
  - Sem dados → `load()` devolve `EMPTY_LIBRARY`. `apply` grava em `telaviva:library:v1` e devolve o novo estado.
  - Foco 2: `apply` relê o armazenamento antes de aplicar. Dois repositórios sobre o mesmo `Storage`, cada um com um `setStatus` diferente → os dois itens ficam salvos.
  - Foco 1 (corrompido): `'{oops'` na chave → `load()` copia o texto bruto para `telaviva:library:v1:corrupt:<ms>`, devolve vazio e não apaga a cópia.
  - Foco 1 (cheio): `setItem` lança `QuotaExceededError` → `apply` rejeita com `LibraryStorageError` e o estado salvo não muda.
  - Foco 1 (bloqueado): acessar `localStorage` lança → `persistent === false`, e `apply`/`load` funcionam em memória.
  - `subscribe` chama o callback no evento `storage` da chave `telaviva:library:v1` (dispare um `StorageEvent` no `window`) e ignora outras chaves. O retorno cancela a inscrição.
  - Importação da v1: no primeiro `load()` sem a chave v2, mas com `watchedMovies`, os itens entram, a marca `telaviva:library:v1-import-done` é gravada e as chaves antigas continuam intactas. No segundo `load()`, nada é importado de novo.
  Em `v1-import.test.ts`: o mapeamento dos campos, a precedência de `watched` e o descarte de entradas inválidas ou JSON quebrado (devolve `[]`).
- [ ] **Step 2: Rodar e ver falhar.** `npm test -- src/features/library` → FAIL.
- [ ] **Step 3: Implementar.** `export class LibraryStorageError extends Error {}`. Grave sempre o estado inteiro como JSON. Valide na leitura com `parseLibraryState`.
- [ ] **Step 4: Rodar e ver passar.** `npm test -- src/features/library` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: persist the guest library in localStorage with backup and v1 import"`

---

### Task 4: Toasts, provider da biblioteca e hooks otimistas

**Arquivos:**
- Criar: `src/ui/toast/ToastProvider.tsx`, `src/ui/toast/Toaster.tsx`, `src/ui/toast/useToast.ts`, `src/features/library/LibraryProvider.tsx`, `src/features/library/hooks.ts`
- Modificar: `src/app/providers.tsx` (envolver com `ToastProvider` e `LibraryProvider`, dentro do `QueryClientProvider`)
- Testes: `src/ui/toast/Toaster.test.tsx`, `src/features/library/hooks.test.tsx`

**Interfaces:**
- Consome: Task 3.
- Produz:
  - `useToast(): { show(t: { message: string; action?: { label: string; onClick: () => void }; tone?: 'neutral' | 'error' }): void }`. O Toaster tem uma região `role="status"` `aria-live="polite"`, fica acima da TabBar no celular (`bottom-[calc(4rem+env(safe-area-inset-bottom))]`) e no canto inferior no desktop. Cada toast fecha sozinho em 5 s (pausa com hover e foco) ou pelo botão fechar (`aria-label="Fechar aviso"`). No máximo 3 visíveis.
  - `LibraryProvider({ children, repository? })`: cria o repositório local por padrão, conecta `subscribe` → `queryClient.invalidateQueries({ queryKey: ['library'] })` e mostra o toast de armazenamento bloqueado uma vez quando `persistent` é falso.
  - `useLibrary(): { state: LibraryState | undefined; ready: boolean }` (`useQuery` com `['library']`, `staleTime: Infinity`).
  - `useLibraryEntry(ref: TitleRef): { ready: boolean; item: LibraryItem | null; rating: Rating | null; marks: EpisodeMark[] }`
  - `useLibraryActions(): { run(command: LibraryCommand, opts?: { undoable?: { message: string } }): void }`. Fluxo: `onMutate` cancela queries, guarda o anterior e aplica `applyCommand` ao cache (otimista). `mutationFn` chama `repository.apply`. `onError` restaura o anterior e mostra o toast de erro. `onSuccess` grava o estado devolvido só se nenhuma outra mutação da biblioteca estiver pendente (`queryClient.isMutating({ mutationKey: ['library'] }) === 1`). `onSettled` invalida `['library']`. Com `undoable`, mostra o toast com "Desfazer", que aplica o estado anterior como um comando inverso (veja abaixo).
  - Desfazer: gere o inverso a partir do estado anterior: o item anterior volta (ou some, se não existia), e o mesmo vale para a nota e as marcas. Implemente com um comando interno `{ type: 'restore'; ref: TitleRef; item: LibraryItem | null; rating: Rating | null; marks: EpisodeMark[] }`, adicionado a `LibraryCommand` e a `applyCommand` (com teste em `commands.test.ts`).

- [ ] **Step 1: Escrever os testes que falham.** Use `renderHook` com `QueryClientProvider` e um repositório falso:
  - `useLibraryEntry` começa com `ready: false` e depois reflete o estado.
  - `run(setStatus)` atualiza o cache antes de `apply` resolver (otimista).
  - `apply` rejeita → o cache volta ao anterior e o toast de erro aparece.
  - Foco 5: dois `run` seguidos (marcar e desmarcar) com `apply` resolvendo fora de ordem → o estado final é o do segundo comando.
  - `undoable` → o toast tem "Desfazer". Clicar restaura o item anterior.
  - Foco 2: o `subscribe` do repositório disparado → a query é invalidada e recarregada.
  - Toaster: some sozinho em 5 s (timers falsos), pausa com hover, mostra no máximo 3 e é anunciado (`role="status"`).
- [ ] **Step 2: Rodar e ver falhar.** `npm test -- src/features/library src/ui/toast` → FAIL.
- [ ] **Step 3: Implementar.** Mantenha o QueryClient dentro de Suspense, como já está no layout. Use `mutationKey: ['library']`.
- [ ] **Step 4: Rodar e ver passar.** Depois rode a suíte inteira: `npm test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: add toasts and optimistic library hooks behind a swappable repository"`

---

### Task 5: Dados do TMDb para a biblioteca (rotas e fetchers)

**Arquivos:**
- Modificar: `src/features/tmdb/movies.ts` ou um novo `src/features/tmdb/recommendations.ts`, `e2e/mock-tmdb.ts`
- Criar: `src/app/api/tv/progress/route.ts`, `src/app/api/tv/[id]/season/[season]/route.ts`
- Testes: `src/features/tmdb/recommendations.test.ts`, `src/app/api/tv/progress/route.test.ts`, `src/app/api/tv/[id]/season/[season]/route.test.ts`

**Interfaces:**
- Consome: `getTvDetails` e `getSeason` (cacheados); `toProgressInfo` (Task 2).
- Produz:
  - `getRecommendationsFor(media: MediaType, id: number): Promise<MediaSummary[]>`: `'use cache'`, `cacheLife('tmdbDetail')`, `cacheTag('tmdb', '${media}:${id}')`, endpoint `${media}/${id}/recommendations` com `language=pt-BR` e página 1. Usa o mapper de resumo existente, com o `mediaType` forçado. Um 404 vira `[]`, seguindo o padrão null-dentro-do-cache da Fase 1.
  - `GET /api/tv/progress?ids=1399,66732` → `200 { [id: string]: TvProgressInfo }`. Ids ausentes no TMDb ficam de fora. Mais de 40 ids, ou id não numérico → `400 { error }`. Falha geral → `502`.
  - `GET /api/tv/:id/season/:season` → `200 SeasonDetails`. 404 do TMDb → `404`. Parâmetros inválidos → `400`.
  - Mock: `^(movie|tv)/\d+/recommendations$` responde `discover-movie-page-2` para filme e `discover-tv-page-2` para série.

- [ ] **Step 1: Escrever os testes que falham** com MSW: o mapeamento com `mediaType` correto; 404 → `[]`; a rota de progresso com 2 ids (um 404 é omitido), com 41 ids → 400 e com `ids=abc` → 400; a rota de temporada com 404 → 404.
- [ ] **Step 2: Rodar e ver falhar.** `npm test -- src/app/api/tv src/features/tmdb` → FAIL.
- [ ] **Step 3: Implementar** os fetchers, as rotas e o mock.
- [ ] **Step 4: Rodar e ver passar.** `npm test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: add series progress, season and recommendation data endpoints"`

---

### Task 6: Seletor de nota e popover reutilizável

**Arquivos:**
- Criar: `src/ui/PopoverSheet.tsx` (extraído de `src/features/discover/FilterMenu.tsx`), `src/features/library/RatingControl.tsx`
- Modificar: `src/features/discover/FilterMenu.tsx` (passa a usar `PopoverSheet`, sem mudar o comportamento), `src/features/catalog/PosterCard.tsx` (props `ringValue?: number | null` e `ringTone?: 'tmdb' | 'personal'`; o padrão continua sendo `voteAverage` e `tmdb`)
- Testes: `src/ui/PopoverSheet.test.tsx`, `src/features/library/RatingControl.test.tsx`. Os testes atuais de discover devem continuar passando sem alteração.

**Interfaces:**
- Produz:
  - `PopoverSheet({ trigger, open, onOpenChange, title, children })`. É o comportamento do FilterMenu: `<dialog>` não modal ancorado no gatilho a partir de 48rem; folha inferior modal no celular; foco entra no painel e volta ao gatilho; Esc, clique fora e botão fechar.
  - `RatingControl({ titleRef: TitleRef; snapshot: TitleSnapshot; title: string })`, um Client Component. Sem nota: botão "Dar nota" (ícone `Star`). Com nota: `RatingRing tone="personal" size="md"` mais o texto "Sua nota" (o conjunto é o botão). O painel tem um `role="radiogroup"` com `aria-label="Sua nota para {title}"`, 10 botões `role="radio"` (1 a 10, 44 px) com setas, Home e End, e "Remover nota" quando há nota. Escolher uma nota aplica `rate` e fecha. Antes do carregamento (`ready: false`), mostra o botão desabilitado com a mesma largura, sem pular layout.

- [ ] **Step 1: Escrever os testes que falham:** o radiogroup e o teclado (setas mudam a seleção, Enter confirma); escolher 9 chama `run({ type: 'rate', score: 9, ... })`; "Remover nota" chama `unrate`; o anel mostra "Sua nota 9 de 10" (rótulo do `RatingRing`); `ready: false` → desabilitado. Para o PopoverSheet, migre os testes de foco e fechamento que existem em discover para o primitivo.
- [ ] **Step 2: Rodar e ver falhar.** `npm test -- src/ui src/features/library src/features/discover` → FAIL.
- [ ] **Step 3: Implementar.** Extraia sem duplicar: FilterMenu vira gatilho mais `PopoverSheet`.
- [ ] **Step 4: Rodar e ver passar.** `npm test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: add the personal rating control on a shared popover sheet"`

---

### Task 7: Ações no detalhe do filme

**Arquivos:**
- Criar: `src/features/library/MovieActions.tsx`
- Modificar: `src/app/filme/[slug]/page.tsx` (passa `actions={<MovieActions ... />}` ao `DetailHero`)
- Testes: `src/features/library/MovieActions.test.tsx`

**Interfaces:**
- Consome: `useLibraryEntry`, `useLibraryActions`, `RatingControl`, `toSnapshot`.
- Produz: `MovieActions({ movie: Pick<MediaSummary, 'id' | 'title' | 'posterPath' | 'releaseDate' | 'genreIds'> })`. Três controles em pílula, todos com 44 px de altura:
  - "Quero ver": `Bookmark`, `aria-pressed` quando `want`. Alterna entre `want` e remover, com toast "Salvo em Quero ver" ou "Removido da sua lista" com "Desfazer".
  - "Já assisti": `Check`, `aria-pressed` quando `watched`. Alterna entre `watched` e remover. Se havia nota, remover mantém a nota.
  - `RatingControl`.
  - No celular, os botões ocupam a largura toda (`w-full sm:w-auto`), seguindo o spec ("botões de ação largos").

- [ ] **Step 1: Escrever os testes que falham:** os estados pressionados a partir do estado; alternar chama os comandos certos; o toast aparece com "Desfazer"; antes de `ready`, os botões ficam desabilitados e sem `aria-pressed="true"`.
- [ ] **Step 2: Rodar e ver falhar.** `npm test -- src/features/library` → FAIL.
- [ ] **Step 3: Implementar e ligar na página.** A página continua só com `params` aguardado.
- [ ] **Step 4: Rodar e ver passar.** `npm test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: add list and rating actions to the movie page"`

---

### Task 8: Detalhe da série: status, nota e cartão de progresso

**Arquivos:**
- Criar: `src/features/library/SeriesActions.tsx`, `src/features/library/SeriesProgressCard.tsx`, `src/features/library/useSeason.ts`
- Modificar: `src/app/serie/[slug]/page.tsx` (`actions` no hero; `afterOverview` passa a ter `SeriesProgressCard` acima do `NextEpisode` existente; `info = toProgressInfo(tv)` calculado no servidor e passado por prop)
- Testes: `src/features/library/SeriesActions.test.tsx`, `src/features/library/SeriesProgressCard.test.tsx`

**Interfaces:**
- Consome: Tasks 2, 4, 5 e 6.
- Produz:
  - `SeriesActions({ tv: Pick<TvDetails, 'id' | 'title' | 'posterPath' | 'releaseDate' | 'genreIds'>; info: TvProgressInfo })`. Um seletor de status em pílula ("Quero ver" / "Assistindo" / "Assistido", mais "Remover da lista" quando há item), feito como um grupo de botões `aria-pressed` num `PopoverSheet`, com o gatilho mostrando o status atual ou "Adicionar à lista". Também tem o `RatingControl`. "Assistido" envia `setStatus` com `progress: info` (marca todos os exibidos).
  - `useSeason(tvId: number, season: number | null)`: `useQuery(['season', tvId, season])` em `/api/tv/:id/season/:season`, com `staleTime` de 1 h, desligado quando `season` é null.
  - `SeriesProgressCard({ tvId, title, info, snapshot })`. Não renderiza nada antes de `ready` nem com `not-started`. Nos outros casos:
    - `in-progress`: "Próximo: T1E6 · {nome do episódio via useSeason}", barra de progresso (`role="progressbar"`, `aria-valuenow` = vistos, `aria-valuemax` = total, texto "6 de 24 episódios") e o botão "Marcar como visto", que envia `setEpisodes` com o `next`.
    - `caught-up`: "Em dia", mais "Próximo episódio em {data}" quando houver data.
    - `finished`: "Série concluída".

- [ ] **Step 1: Escrever os testes que falham:** os três estados do cartão a partir de marcas; "Marcar como visto" envia o comando com `next` e `progress`; o nome do episódio aparece quando `useSeason` resolve (MSW na rota da Task 5) e o cartão funciona sem ele; o seletor de status envia `setStatus` com `progress` para "Assistido"; nada é renderizado antes de `ready`.
- [ ] **Step 2: Rodar e ver falhar.** `npm test -- src/features/library` → FAIL.
- [ ] **Step 3: Implementar e ligar na página.**
- [ ] **Step 4: Rodar e ver passar.** `npm test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: add series status, rating and the personal progress card"`

---

### Task 9: Marcação de episódios na lista de temporadas

**Arquivos:**
- Criar: `src/features/library/EpisodeToggle.tsx`, `src/features/library/SeasonActions.tsx`
- Modificar: `src/features/detail/SeasonsSection.tsx` e `src/features/detail/EpisodeList.tsx` (novo slot `renderSeasonActions?: (season: SeasonDetails, airedEpisodeNumbers: number[]) => ReactNode`, renderizado acima da lista; `airedEpisodeNumbers` vem de `isAired` com `saoPauloIsoDate()` no servidor), `src/app/serie/[slug]/page.tsx` (passa `renderAction` e `renderSeasonActions`)
- Testes: `src/features/library/EpisodeToggle.test.tsx`, `src/features/library/SeasonActions.test.tsx` e um caso novo em `src/features/detail/EpisodeList.test.tsx`

**Interfaces:**
- Consome: Tasks 2 e 4.
- Produz:
  - `EpisodeToggle({ tvId, episode: EpisodeRef; aired: boolean; info: TvProgressInfo; snapshot: TitleSnapshot })`:
    - Botão "Marcar como visto"/"Visto" (`aria-pressed`, ícone `Check`).
    - Ao lado, "Até aqui", que envia `setEpisodes` com `marksUpTo(info, episode)`. Fica oculto para a temporada 0 e para episódios não exibidos.
    - Episódio não exibido: o botão fica desabilitado com `aria-disabled` e o texto "Ainda não exibido".
  - `SeasonActions({ tvId, seasonNumber, airedEpisodeNumbers, info, snapshot })`: "Marcar temporada" quando falta algum exibido desta temporada; "Desmarcar temporada" quando todos estão marcados. Não renderiza nada sem episódios exibidos.

- [ ] **Step 1: Escrever os testes que falham:** alternar um episódio envia `watched: true/false` com o episódio; "Até aqui" envia os episódios de `marksUpTo`; episódio futuro → desabilitado e sem "Até aqui"; temporada 0 → sem "Até aqui"; SeasonActions alterna conforme as marcas; EpisodeList renderiza `renderSeasonActions` acima da lista com os números exibidos corretos (datas fixas e `saoPauloIsoDate` simulado).
- [ ] **Step 2: Rodar e ver falhar.** `npm test -- src/features/library src/features/detail` → FAIL.
- [ ] **Step 3: Implementar e ligar.** O `SeasonsSection` continua lendo `searchParams` só dentro do Suspense.
- [ ] **Step 4: Rodar e ver passar.** `npm test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: mark episodes, whole seasons and up-to-here from the season list"`

---

### Task 10: Ação rápida nos pôsteres

**Arquivos:**
- Criar: `src/features/library/CardLibraryAction.tsx`
- Modificar: `src/features/catalog/PosterCard.tsx` (renderiza `CardLibraryAction` no slot do canto superior esquerdo quando nenhum `actions` é passado; prop `libraryAction?: boolean`, padrão `true`)
- Testes: `src/features/library/CardLibraryAction.test.tsx` e um caso novo em `src/features/catalog/PosterCard.test.tsx`

**Decisão (padrão de ações por card, adiado na Fase 1):**
- **Só ícone, sem texto no pôster** (pedido do autor, para não poluir os cards). O texto "Quero ver" fica só nos botões da página de detalhe (Task 7).
- **Fora da biblioteca:** um botão redondo discreto com o ícone `Plus`, fundo `bg-ink-950/60` com blur. A área de toque tem 44 px, com o visual de 32 px. Ele fica sempre visível, inclusive no toque, porque o uso é principalmente no celular. Adiciona a "Quero ver" e mostra o toast curto "Salvo em Quero ver" com "Desfazer".
- **Em `want`:** o mesmo botão em âmbar com o ícone `BookmarkCheck` (`aria-pressed="true"`). Tocar remove, com o toast "Removido da sua lista" e "Desfazer".
- **Em `watching` ou `watched`:** um marcador não interativo (`Play` ou `Check` em marfim) com `<span className="sr-only">Na sua lista: assistindo|assistido</span>`. Mudanças maiores ficam na página de detalhe.
- O botão fica fora do `<Link>` (HTML válido), como o slot atual. Antes de `ready`, o slot fica vazio.

**Interfaces:**
- Produz: `CardLibraryAction({ item: MediaSummary })`. O `aria-label` do botão é "Adicionar {título} a Quero ver" ou "Remover {título} de Quero ver".

- [ ] **Step 1: Escrever os testes que falham:** os três estados; o clique envia `setStatus want` ou `remove` com o retrato do item; o toast "Desfazer" restaura; o slot fica vazio antes de `ready`; o PosterCard renderiza o botão fora do link (`link.contains(button) === false`).
- [ ] **Step 2: Rodar e ver falhar.** `npm test -- src/features/library src/features/catalog` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.** `npm test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: add a quick Quero ver action to every poster"`

---

### Task 11: Página Minha lista

**Arquivos:**
- Criar: `src/features/library/view/LibraryView.tsx`, `src/features/library/view/LibraryStats.tsx`, `src/features/library/view/library-query.ts` (parse/serialização da URL, filtros e ordenação puros), `src/features/library/view/useTvProgress.ts`
- Modificar: `src/app/minha-lista/page.tsx` (metadados "Sua lista de filmes e séries: quero ver, assistindo e assistidos.", `PageHeader` e `<LibraryView />` dentro de Suspense com esqueleto)
- Testes: `src/features/library/view/library-query.test.ts`, `src/features/library/view/LibraryView.test.tsx`, `src/features/library/view/LibraryStats.test.tsx`

**Interfaces:**
- Consome: Tasks 2, 4 e 5; `PosterCard` com `ringValue`/`ringTone`; o padrão de URL de `src/features/discover/useDiscoverFilters.ts` (`history.replaceState` e o evento `popstate`).
- Produz:
  - `parseLibraryQuery(params: URLSearchParams, hasWatching: boolean): { aba: 'assistindo' | 'quero-ver' | 'assistidos'; tipo: MediaType | null; ordem: 'recentes' | 'titulo' | 'nota' | 'ano' }` e `toLibrarySearch(q): string` (omite os padrões).
  - `selectItems(state: LibraryState, q): LibraryItem[]`, com estas regras:
    - Aba `assistindo` = séries em `watching`.
    - `quero-ver` = `want`.
    - `assistidos` = `watched`.
    - `tipo` filtra (é ignorado em `assistindo`).
    - Ordem `recentes` por `updatedAt` decrescente; `titulo` por `localeCompare('pt-BR')`; `nota` decrescente, sem nota por último; `ano` decrescente, sem ano por último.
  - `libraryStats(state: LibraryState): { moviesWatched: number; seriesWatched: number; seriesWatching: number; episodesWatched: number; wantCount: number; averageScore: number | null }`. `episodesWatched` ignora a temporada 0. A média usa todas as notas.
  - `useTvProgress(tvIds: number[])`: `useQuery(['tv-progress', ...ids ordenados])` em `/api/tv/progress`, em lotes de 40.
  - `LibraryView()`:
    - Abas: `role="tablist"` com as três abas e contagens ("Quero ver · 3").
    - Filtro Todos/Filmes/Séries (segmentado `aria-pressed`, oculto em Assistindo) e ordenação (`<select>` com rótulo).
    - Grade com o `MediaGrid` visual de pôsteres (mesmas colunas e `sizes` do `GRID_SIZES`). Os itens vêm dos retratos: `MediaSummary` mínimo com `voteAverage: 0`, `ringValue` = sua nota e `ringTone` = `personal`.
    - Subtítulo: em Assistindo, "Próximo: T2E5" ou "Em dia". Em Assistidos, série com novos episódios exibidos mostra "Novos episódios" (Foco 3). Nos outros casos, o ano. Sem dado de progresso (Foco 4), o subtítulo cai para o ano.
    - Estado vazio por aba, com botão para "Descobrir" (`/descobrir`).
  - `LibraryStats`: painel acima das abas com os números (rótulos "Filmes assistidos", "Séries assistidas", "Assistindo agora", "Episódios vistos", "Quero ver" e "Média das suas notas", esta com uma casa e vírgula, ou "–"). Fica numa linha rolável no celular e numa grade no desktop. Não usa o template de métrica gigante: números em Instrument Serif tamanho `text-3xl`, rótulo pequeno abaixo.

- [ ] **Step 1: Escrever os testes que falham:** o parse e a serialização (inválidos caem nos padrões, padrões omitidos); cada ordenação, incluindo sem nota e sem ano por último; `libraryStats` com temporada 0 ignorada e média 7,5; a LibraryView em cada aba com um estado de exemplo; a troca de aba atualiza a URL (`replaceState`); Foco 3: série em `watched` com mais exibidos do que marcas → "Novos episódios"; Foco 4: a rota de progresso falha → a grade renderiza com anos e sem erro; os estados vazios com o link para Descobrir.
- [ ] **Step 2: Rodar e ver falhar.** `npm test -- src/features/library/view` → FAIL.
- [ ] **Step 3: Implementar.** A página continua estática. Tudo que depende da biblioteca é cliente.
- [ ] **Step 4: Rodar e ver passar.** `npm test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: build Minha lista with tabs, filters, sorting and library stats"`

---

### Task 12: Recomendações

**Arquivos:**
- Criar: `src/features/library/recommend.ts` (puro: sementes e pontuação), `src/app/api/recommendations/route.ts`, `src/features/library/useRecommendations.ts`
- Testes: `src/features/library/recommend.test.ts`, `src/app/api/recommendations/route.test.ts`

**Interfaces:**
- Consome: Task 1; `getRecommendationsFor` (Task 5); `getTrending` (`src/features/tmdb/movies.ts`) para completar.
- Produz:
  - `type Seed = { mediaType: MediaType; tmdbId: number; weight: number; genreIds: number[] }`
  - `pickSeeds(state: LibraryState): Seed[]`, com os pesos e limites de "Valores fixados".
  - `scoreRecommendations(seeds: Seed[], bySeed: Map<string, MediaSummary[]>, exclude: Set<string>): MediaSummary[]`. É a fórmula da v1 com peso:
    - frequência = Σ (peso da semente × 5) nas listas em que o candidato aparece; a parte positiva tem teto 40;
    - gênero = Σ (afinidade × 3) com teto 30, onde afinidade = quantas sementes positivas têm o gênero;
    - voto = `voteAverage / 10 × 20`;
    - popularidade = `min(popularity / 100 × 10, 10)`.
    - Descarta candidatos com frequência ≤ 0, os excluídos e as próprias sementes. Ordena de forma decrescente e devolve até 20.
  - `POST /api/recommendations` com corpo `{ seeds: Seed[]; exclude: string[] }` (Zod; limites → 400). Busca `getRecommendationsFor` de cada semente com `Promise.allSettled`, pontua e, se vierem menos de 10, completa com `getTrending('all', 'week')` sem excluídos. Resposta: `200 { results: MediaSummary[] }`. Falha total → `502`.
  - `useRecommendations(): { items: MediaSummary[]; ready: boolean }`: `useQuery(['recommendations', hash das sementes])` com `staleTime` de 30 min, desligado sem sementes positivas. `exclude` = todas as chaves da biblioteca e das notas.

- [ ] **Step 1: Escrever os testes que falham:**
  - um candidato vindo de uma semente com nota 9 supera outro vindo de uma semente sem nota;
  - um candidato recomendado só por uma semente com nota 2 é descartado;
  - quem aparece em duas listas sobe;
  - chaves excluídas e as sementes nunca voltam;
  - `pickSeeds` respeita pesos, limites (8 positivas e 4 negativas) e o desempate por `updatedAt`;
  - a rota completa com tendências quando há menos de 10, devolve 400 acima dos limites e 502 quando tudo falha (MSW).
- [ ] **Step 2: Rodar e ver falhar.** `npm test -- src/features/library src/app/api/recommendations` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.** `npm test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: recommend titles from the library, weighted by personal ratings"`

---

### Task 13: Trilhos pessoais na home

**Arquivos:**
- Criar: `src/features/home/LibraryRails.tsx`
- Modificar: `src/app/page.tsx` (renderiza `<LibraryRails />` no topo do contêiner de trilhos, fora do Suspense dos trilhos do servidor), `src/features/catalog/Rail.tsx` (prop `subtitleOf?: (item: MediaSummary) => string | undefined` repassada ao `PosterCard`)
- Testes: `src/features/home/LibraryRails.test.tsx` e um caso novo em `src/features/catalog/Rail.test.tsx`

**Interfaces:**
- Consome: Tasks 2, 4, 5, 11 (`useTvProgress`) e 12.
- Produz: `LibraryRails()`. Não renderiza nada antes de `ready` nem com a biblioteca vazia, para que o visitante novo não veja esqueleto piscando.
  - **"Continue assistindo"**: séries em `watching` com `in-progress`, ordenadas por atividade mais recente (a maior data entre o `updatedAt` do item e o `watchedAt` das marcas). Subtítulo "Próximo: T2E5". O trilho só aparece com pelo menos 1 série.
  - **"Recomendados para você"**: `useRecommendations`. Só aparece com pelo menos 6 itens. Some em erro (Foco 4).

- [ ] **Step 1: Escrever os testes que falham:** biblioteca vazia → nada; uma série em andamento → o trilho com o subtítulo; uma série `caught-up` não entra; o progresso falha → "Continue assistindo" some sem erro; recomendações com 6 ou mais → o trilho aparece; erro → some. Para o Rail: `subtitleOf` chega ao card.
- [ ] **Step 2: Rodar e ver falhar.** `npm test -- src/features/home src/features/catalog` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.** `npm test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: show Continue assistindo and Recomendados para você on the home page"`

---

### Task 14: E2E da biblioteca, acessibilidade e verificação final

**Arquivos:**
- Criar: `e2e/library.spec.ts`
- Modificar: `e2e/a11y.spec.ts` (Minha lista com itens e o painel de nota aberto)

**Fluxos (projetos desktop e mobile):**
1. Filme `/filme/550-clube-da-luta`: "Quero ver" → toast; recarregar → `aria-pressed="true"`; `/minha-lista?aba=quero-ver` mostra o card.
2. Dar nota 9 no filme → "Sua nota" com o anel; `/minha-lista?aba=assistidos` mostra o card e a média "9,0".
3. Série `/serie/1399-game-of-thrones`: marcar T1E1 e T1E2 → o cartão mostra "Próximo: T1E3"; "Até aqui" em T1E5 → "Próximo: T1E6"; recarregar mantém; a aba Assistindo mostra "Próximo: T1E6"; a home mostra "Continue assistindo" com o card.
4. Em `/filmes`: o botão rápido de um pôster adiciona; "Desfazer" no toast remove.
5. Com a biblioteca preenchida, a home mostra "Recomendados para você" (mock da Task 5).
6. Armazenamento bloqueado (`page.addInitScript` que faz `localStorage.getItem` lançar) → o aviso aparece uma vez e marcar continua funcionando na sessão.
7. axe sem violações em `/minha-lista` com itens e com o painel de nota aberto.

- [ ] **Step 1: Escrever os testes.** Limpe o armazenamento por teste (contexto novo). Não use esperas fixas: use `expect.poll` ou locators.
- [ ] **Step 2: Rodar.** `npm run e2e` → todos verdes nos dois projetos.
- [ ] **Step 3: Verificação completa, em sequência:** `npm run lint` (0 avisos), `npm run typecheck`, `npm test`, `npm run build` (com o `.env.local` real) e `npm run e2e`.
- [ ] **Step 4: Olhar o resultado.** Com o build real em `next start -p 3300`, use o Playwright MCP para capturar em 1440×900 e 390×844: o detalhe do filme com as ações; a série com o cartão de progresso e episódios marcados; a Minha lista em cada aba; a home com os trilhos pessoais; o painel de nota aberto; e o toast. Confira contraste, alvos de 44 px, nenhum aviso no console e nenhum erro de hidratação. Corrija e olhe de novo. Encerre o servidor por PID.
- [ ] **Step 5: Detector do Impeccable** nos arquivos alterados: `"C:/Users/higorxyz/.claude/plugins/cache/impeccable/impeccable/4.9.2/skills/impeccable/scripts/impeccable" detect --json --changed`. Corrija os achados reais.
- [ ] **Step 6: Commit.** `git commit -m "test: cover the guest library end to end"`

---

### Task 15: Feed disponível no Brasil (executar antes da Task 14)

Pedido do autor (2026-11-19): o "feed" (trilhos, listas, gêneros e recomendações) deve priorizar o que dá para assistir no Brasil sem VPN. Títulos indisponíveis continuam existindo no site, mas só aparecem quando procurados: na busca por nome, na página da pessoa, por link direto, ou em Descobrir com o filtro desligado.

**Definição:** "disponível no Brasil" = tem pelo menos um provedor em `watch_region=BR` com monetização `flatrate`, `free`, `ads`, `rent` ou `buy`. Use a constante `BR_AVAILABLE_MONETIZATION = 'flatrate|free|ads|rent|buy'` num único lugar (`src/features/tmdb/availability.ts`). Se o autor quiser só assinatura e grátis depois, é só mudar essa linha.

**Arquivos:**
- Criar: `src/features/tmdb/availability.ts`
- Modificar: `src/features/tmdb/movies.ts`, `src/features/tmdb/tv.ts` (listas), `src/features/catalog/rails.ts`, `src/features/catalog/lists.ts`, `src/features/genres/load-cards.ts`, `src/app/genero/[tipo]/[slug]/page.tsx` e a rota `/api/discover` (o endpoint de gênero precisa do mesmo filtro na paginação), `src/features/discover/filters.ts` e a toolbar de Descobrir (novo filtro), `src/features/tmdb/recommendations.ts` (Task 5), o mapeamento das recomendações do detalhe (`src/features/tmdb/detail-mappers.ts` ou equivalente), `e2e/mock-tmdb.ts`
- Testes: `src/features/tmdb/availability.test.ts` e os testes existentes afetados (atualizar as expectativas de parâmetros)

**Interfaces:**
- Produz:
  - `BR_AVAILABLE_MONETIZATION` e `brAvailabilityParams(): TmdbParams` → `{ watch_region: 'BR', with_watch_monetization_types: BR_AVAILABLE_MONETIZATION }`
  - `isAvailableInBr(media: MediaType, id: number): Promise<boolean>`: `'use cache'`, `cacheLife('tmdbDetail')`, `cacheTag('tmdb', '${media}:${id}')`, endpoint `${media}/${id}/watch/providers`. True se `results.BR` tiver alguma das listas `flatrate`/`free`/`ads`/`rent`/`buy` não vazia. Erro ou 404 → false.
  - `filterAvailableInBr(items: MediaSummary[], opts?: { limit?: number }): Promise<MediaSummary[]>`: `Promise.all` de `isAvailableInBr`, mantém a ordem e respeita `limit`.

**Regras por superfície:**
1. **Listas baseadas em discover** (`top_rated`, `hidden_gems`, `short`, `blockbusters`, `top_rated` de TV, cards e páginas de gênero, e a paginação de `/api/discover` usada pelos gêneros): somam `brAvailabilityParams()` aos parâmetros. `streaming_br` continua só `flatrate`.
2. **Isentas:** `now_playing` ("Nos cinemas") e `upcoming` ("Em breve").
3. **Listas sem discover** (`getTrending`, `popular`, `on_the_air`, `airing_today`): pós-filtro com `filterAvailableInBr`. Para que o trilho continue com pelo menos 6 títulos depois da deduplicação, as fontes da home e dos hubs buscam as páginas 1 e 2 quando a página 1 filtrada tiver menos de 12 títulos. A paginação dessas listas em `/api/catalog` também filtra cada página. Página vazia é aceitável no fim, mas nunca no começo: busque a próxima página até 3 vezes.
4. **Recomendações:** as da página de detalhe (seção "Recomendados") e as de `getRecommendationsFor` (Task 5/12) passam por `filterAvailableInBr`. O enchimento por tendências da Task 12 também é filtrado.
5. **Descobrir:** novo parâmetro de URL `disponivel` (padrão ligado; `disponivel=0` desliga). Controle "Disponível no Brasil" (toggle `aria-pressed`) na toolbar. Ligado → soma `brAvailabilityParams()`, a menos que o usuário já tenha escolhido provedores em "Onde assistir" (aí o filtro de provedor já basta). Chips e "Limpar tudo" seguem o padrão atual. "Limpar tudo" volta ao padrão, que é ligado.
6. **Sem filtro:** busca (`/buscar`, paleta Ctrl+K, `/api/search`), página da pessoa (filmografia) e acesso direto a qualquer `/filme/...` ou `/serie/...`.
7. **Destaque da home** (hero): escolhe só entre os títulos disponíveis (pós-filtro na fonte do destaque).

- [ ] **Step 1: Escrever os testes que falham.**
  - `availability.test.ts` (MSW): BR com `rent` → true; BR só com lista vazia → false; sem BR → false; 404 → false; `filterAvailableInBr` mantém a ordem e respeita `limit`.
  - Parâmetros: `listParams('top_rated')` inclui `watch_region=BR` e a monetização; `now_playing` e `upcoming` não incluem.
  - Rails: fonte de tendências com títulos indisponíveis → o trilho só tem os disponíveis e busca a página 2 quando faltar.
  - Descobrir: padrão ligado soma os parâmetros; `disponivel=0` não soma; com provedores escolhidos não soma; o chip aparece só quando desligado (o estado não padrão).
  - Recomendações do detalhe filtradas.
  - Mock: `^(movie|tv)/\d+/watch/providers$` responde BR com `flatrate` para ids pares e sem BR para ids ímpares, para os testes E2E verem os dois casos.
- [ ] **Step 2: Rodar e ver falhar.** `npm test` → FAIL nos novos.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.** `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`. Rode `npm run e2e` e ajuste as expectativas E2E que dependiam de títulos agora filtrados.
- [ ] **Step 5: Commit.** `git commit -m "feat: keep the feed to titles available to watch in Brazil"`
