# TelaViva v2 — Fase 1: Fundação e Catálogo — Plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** substituir o app CRA por um app Next.js com a identidade "Sala Escura", que permite navegar por filmes e séries (home, hubs, listas, detalhes, pessoas, busca, descobrir e gêneros) com dados do TMDb buscados no servidor.

**Arquitetura:** Next.js 16 (App Router), com `cacheComponents` e `'use cache'` para cachear chamadas ao TMDb no servidor. Uma camada `features/tmdb` (`server-only`) busca e valida os dados com Zod e os converte para tipos de domínio. As páginas são Server Components, e só o que é interativo vira Client Component (carrosséis, grade infinita, busca, filtros). Rotas de API leves alimentam a paginação e a busca no cliente via TanStack Query.

**Stack:**
- Next.js 16.4, React 19.3, TypeScript 6.0 (estrito) e Tailwind CSS 4.3.
- Zod 4, TanStack Query 5, lucide-react e motion.
- Testes: Vitest 5, Testing Library, MSW 3 e Playwright 1.65 com @axe-core/playwright.

**Spec:** [docs/superpowers/specs/2026-11-18-telaviva-v2-design.md](../specs/2026-11-18-telaviva-v2-design.md). Quem executar deve ler o spec e este plano.

**Fases seguintes (planos separados, escritos depois desta):**
- Fase 2: biblioteca do visitante (listas, episódios, nota pessoal, recomendações).
- Fase 3: contas e sincronização (Firebase Auth, Neon, mesclagem, conta e LGPD).
- Fase 4: polimento e lançamento (modo offline do PWA, auditorias, docs, troca de produção).

Esta fase deixa **slots** (`actions?: ReactNode`) nos componentes de detalhe para a fase 2 encaixar as ações de lista.

## Restrições globais

- Node ≥ 20.9 (máquina local: 24.10). O CI usa Node 24.
- Versões fixadas: `next@16.4.6`, `react@19.3.1`, `typescript@~6.0.3` (não usar 7.x; o `typescript-eslint` exige `<6.1`), `tailwindcss@4.3.5`, `zod@4`, `@tanstack/react-query@5`, `msw@3`, `vitest@5`, `@playwright/test@1.65`.
- Idioma pt-BR e região BR em todas as chamadas ao TMDb (`language=pt-BR`; `region=BR` / `watch_region=BR` onde se aplica). Datas exibidas no fuso `America/Sao_Paulo`. Decimais com vírgula ("8,0").
- `include_adult=false` em toda chamada que aceite o parâmetro.
- Autenticação no TMDb **somente** via header `Authorization: Bearer ${TMDB_READ_TOKEN}`. Nunca usar `api_key` na URL. Nenhum segredo com prefixo `NEXT_PUBLIC_`.
- Imagens direto do CDN do TMDb (`https://image.tmdb.org/t/p/{size}{path}`), sem usar o otimizador de imagens da Vercel (`images.unoptimized: true`).
- Tokens de design apenas nas variáveis do `@theme` em `src/app/globals.css`. Nenhuma cor hexadecimal solta em componentes.
- Rodapé com a atribuição exata: *"Este produto usa a API do TMDB, mas não é endossado ou certificado pelo TMDB."* e o logo oficial do TMDb. Onde houver provedores de streaming: *"Dados de streaming fornecidos por JustWatch."*
- Toda animação respeita `prefers-reduced-motion: reduce`.
- Rotas pt-BR (`/filme/[id]-[slug]`, `/serie/...`, `/pessoa/...`, `/filmes`, `/series`, `/buscar`, `/descobrir`, `/generos`, `/genero/[tipo]/[id]-[slug]`). As URLs da v1 **não** são mantidas.
- Arquivos curtos e com uma responsabilidade cada. Se um componente passar de ~200 linhas, quebrar.
- Commits pequenos, em inglês, no padrão `feat:`/`fix:`/`chore:`/`test:`, com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` no final.

## Foco de revisão

1. **Título sem pôster, backdrop ou sinopse em pt-BR.** Deve aparecer com um placeholder na identidade visual (nunca imagem quebrada). Detalhes com sinopse pt-BR vazia caem para a sinopse em en-US. *Teste:* Task 5 (`withOverviewFallback`) e Task 7 (`PosterCard` sem pôster).
2. **ID inexistente ou slug errado na URL** (`/filme/999999999-x`, `/filme/abc`). ID inexistente cai na 404 da identidade visual. Slug errado com ID válido redireciona (308) para a URL canônica. *Teste:* Task 10 (E2E).
3. **TMDb fora do ar ou devolvendo erro 5xx.** A página mostra o erro da identidade visual com "Tentar novamente". Trilhos que falham somem sem derrubar a home. *Teste:* Task 9 (unit de `buildHomeRails` com uma fonte rejeitada).
4. **Busca com acentos, espaços e caracteres especiais** ("coração", "  ", "a&b"). Espaços sozinhos não disparam requisição, e a query é codificada corretamente. *Teste:* Task 13.
5. **Série sem temporadas ou com só a temporada 0, e episódios futuros sem data.** A página da série não quebra, mostra o estado vazio e coloca "Data a definir" no lugar da data ausente. *Teste:* Task 11.

---

## Mapa de arquivos

```
.github/workflows/ci.yml            CI: lint, typecheck, unit, e2e, build
vercel.json                          {"framework":"nextjs"}; força o preset na branch
next.config.ts                       cacheComponents, reactCompiler, cacheLife, images
src/app/
  layout.tsx  globals.css  providers.tsx  not-found.tsx  error.tsx  manifest.ts
  page.tsx                                   home
  filmes/page.tsx  filmes/[lista]/page.tsx
  series/page.tsx  series/[lista]/page.tsx
  filme/[slug]/page.tsx  filme/[slug]/opengraph-image.tsx
  serie/[slug]/page.tsx  serie/[slug]/opengraph-image.tsx
  pessoa/[slug]/page.tsx  pessoa/[slug]/opengraph-image.tsx
  buscar/page.tsx  descobrir/page.tsx
  generos/page.tsx  genero/[tipo]/[slug]/page.tsx
  api/catalog/route.ts  api/search/route.ts  api/discover/route.ts
  icons/[variant]/route.tsx                  ícones PWA gerados
src/lib/        env.ts  slug.ts  format.ts  cn.ts
src/ui/         Button.tsx  RatingRing.tsx  MediaBadge.tsx  Skeleton.tsx  Grain.tsx
                Letterbox.tsx  AccentTitle.tsx  EmptyState.tsx  ErrorState.tsx
src/features/tmdb/      client.ts  schemas.ts  mappers.ts  images.ts  types.ts
                        movies.ts  tv.ts  people.ts  search.ts  discover.ts  genres.ts
src/features/catalog/   curation.ts  hero.ts  rails.ts  lists.ts
                        PosterCard.tsx  Rail.tsx  MediaGrid.tsx  Hero.tsx
src/features/detail/    DetailHero.tsx  Trailer.tsx  CastRail.tsx  WatchProviders.tsx
                        SeasonPicker.tsx  EpisodeList.tsx  FactsList.tsx
src/features/search/    useSearch.ts  SearchPalette.tsx  SearchResults.tsx
src/features/discover/  filters.ts  FiltersPanel.tsx  DiscoverResults.tsx
src/features/shell/     Header.tsx  TabBar.tsx  Footer.tsx  Wordmark.tsx  nav.ts
src/test/               setup.ts  server.ts  fixtures/*.json
e2e/                    mock-tmdb.ts  fixtures.ts  *.spec.ts
scripts/capture-fixtures.ts                  grava fixtures reais do TMDb
public/brand/tmdb.svg                        logo oficial do TMDb (branding guidelines)
src/assets/fonts/                            TTFs (OFL) usados no next/og
```

---

### Task 1: Branch v2, scaffold Next.js e ferramentas de qualidade

**Arquivos:**
- Remover (só na branch): `src/`, `public/`, `package.json`, `package-lock.json`, `tailwind.config.js`, `postcss.config.js`, `.vscode/`, `docs/qa/`
- Criar: scaffold do Next.js na raiz, mais `vitest.config.ts`, `playwright.config.ts`, `.prettierrc.json`, `vercel.json`, `src/lib/env.ts`, `src/lib/env.test.ts`, `src/test/setup.ts`
- Modificar: `.gitignore`, `.github/workflows/ci.yml`, `.env.example`

**Interfaces:**
- Produz: `env` em `src/lib/env.ts`, com o objeto `{ TMDB_READ_TOKEN: string; TMDB_API_BASE_URL: string; SITE_URL: string }` validado por Zod. `TMDB_API_BASE_URL` tem padrão `https://api.themoviedb.org/3`; `SITE_URL` vem de `NEXT_PUBLIC_SITE_URL` e tem padrão `https://telaviva.vercel.app`.
- Produz scripts npm: `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:watch`, `e2e` (`playwright test`), `format`, `check` (`lint && typecheck && test && build`).

- [ ] **Step 1: Marcar a v1 e criar a branch**

```bash
git tag v1 main
git switch -c v2
```
Esperado: `git branch --show-current` imprime `v2`.

- [ ] **Step 2: Remover os arquivos da v1 na branch**

```bash
git rm -r -q src public package.json package-lock.json tailwind.config.js postcss.config.js .vscode docs/qa
rm -rf node_modules build
```

- [ ] **Step 3: Gerar o scaffold num diretório temporário e copiar para a raiz**

```bash
npx create-next-app@16.4.6 "$TMPDIR/tv-scaffold" --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --react-compiler --yes
```
Copie para a raiz tudo do scaffold, exceto `.git`, `node_modules` e `README.md`. Mantenha `LICENSE`, `docs/` e `.github/` do repositório. Depois, `npm install`.
Esperado: `npm run dev` sobe e `http://localhost:3000` responde 200.

- [ ] **Step 4: Fixar versões e instalar dependências**

```bash
npm i -E next@16.4.6 react@19.3.1 react-dom@19.3.1
npm i zod@4 @tanstack/react-query@5 lucide-react motion server-only clsx tailwind-merge
npm i -D -E typescript@6.0.3
npm i -D vitest@5 @vitejs/plugin-react vite-tsconfig-paths jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom msw@3 @playwright/test@1.65 @axe-core/playwright prettier prettier-plugin-tailwindcss tsx
npx playwright install chromium
```

- [ ] **Step 5: Configurar `next.config.ts`**

Defina `cacheComponents: true`, `reactCompiler: true`, `images: { unoptimized: true }` e os perfis `cacheLife`:
- `tmdbHot`: `{ stale: 300, revalidate: 3600, expire: 86400 }`, para tendências, em cartaz e no ar.
- `tmdbDetail`: `{ stale: 3600, revalidate: 86400, expire: 604800 }`.
- `tmdbStatic`: `{ stale: 86400, revalidate: 604800, expire: 2592000 }`, para gêneros e listas de provedores.

- [ ] **Step 6: Escrever o teste do `env` que falha**

```ts
// src/lib/env.test.ts
import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  it('aplica padrões quando só o token existe', () => {
    expect(parseEnv({ TMDB_READ_TOKEN: 'tok' })).toEqual({
      TMDB_READ_TOKEN: 'tok',
      TMDB_API_BASE_URL: 'https://api.themoviedb.org/3',
      SITE_URL: 'https://telaviva.vercel.app',
    });
  });
  it('falha com mensagem clara sem token', () => {
    expect(() => parseEnv({})).toThrow(/TMDB_READ_TOKEN/);
  });
});
```

- [ ] **Step 7: Configurar o Vitest e rodar o teste para ver a falha**

Configure `vitest.config.ts` com os plugins `react()` e `tsconfigPaths()`, `environment: 'jsdom'`, `setupFiles: ['src/test/setup.ts']` (importa `@testing-library/jest-dom/vitest`) e `include: ['src/**/*.test.{ts,tsx}']`.
Rode: `npx vitest run src/lib/env.test.ts`. Esperado: FAIL (`parseEnv` não existe).

- [ ] **Step 8: Implementar `parseEnv(source: Record<string, string | undefined>)` e `export const env = parseEnv(process.env)` em `src/lib/env.ts`**

O arquivo importa `server-only` só no export `env`. Para isso, separe `parseEnv` em `src/lib/env-schema.ts`, sem `server-only`, e importe-o no teste.
Rode: `npx vitest run`. Esperado: PASS.

- [ ] **Step 9: Configurar Prettier, Playwright, `vercel.json`, `.env.example` e `.gitignore`**

- `.prettierrc.json`: `{ "singleQuote": true, "semi": true, "printWidth": 100, "plugins": ["prettier-plugin-tailwindcss"] }`.
- `vercel.json`: `{ "framework": "nextjs" }`.
- `.env.example`: `TMDB_READ_TOKEN=`, `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
- `.gitignore` acrescenta `.playwright-mcp/`, `.superpowers/`, `playwright-report/` e `test-results/`.
- `playwright.config.ts`: projetos `desktop` (1440×900) e `mobile` (devices['Pixel 7']). `webServer` com dois comandos:
  1. `npx tsx e2e/mock-tmdb.ts`, na porta 4010 (criado na Task 16; até lá, `testDir` sem specs).
  2. `npm run build && npm run start -- -p 3100`, com `env: { TMDB_API_BASE_URL: 'http://127.0.0.1:4010/3', TMDB_READ_TOKEN: 'e2e', NEXT_PUBLIC_SITE_URL: 'http://localhost:3100' }`.
  `baseURL` aponta para `http://localhost:3100`.

- [ ] **Step 10: Reescrever o CI**

`.github/workflows/ci.yml` roda em `push` e `pull_request`, com Node 24 e cache npm. Os passos são `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`. O build usa `TMDB_READ_TOKEN: dummy`. Os passos de E2E (`npx playwright install --with-deps chromium` e `npm run e2e`) entram na Task 16.

- [ ] **Step 11: Verificar tudo**

Rode: `npm run lint && npm run typecheck && npm test && npm run build` (com `TMDB_READ_TOKEN=dummy` no ambiente).
Esperado: tudo verde.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: replace CRA with Next.js 16 scaffold and quality tooling"
```

---

### Task 2: Utilitários de slug e formatação

**Arquivos:**
- Criar: `src/lib/slug.ts`, `src/lib/slug.test.ts`, `src/lib/format.ts`, `src/lib/format.test.ts`, `src/lib/cn.ts`

**Interfaces:**
- Produz:
  - `toSlug(text: string): string`
  - `parseIdFromSlug(slug: string): number | null`
  - `mediaHref(m: { mediaType: 'movie' | 'tv'; id: number; title: string }): string`
  - `personHref(p: { id: number; name: string }): string`
  - `genreHref(g: { mediaType: 'movie' | 'tv'; id: number; name: string }): string`
- Produz:
  - `formatRating(v: number): string`
  - `formatRuntime(min: number | null): string | null`
  - `formatDate(iso: string | null): string | null`
  - `formatYear(iso: string | null): string | null`
  - `splitAccent(title: string): { lead: string; accent: string | null }`
- Produz `cn(...classes: ClassValue[]): string` (clsx + tailwind-merge).

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/lib/slug.test.ts
expect(toSlug('Clube da Luta')).toBe('clube-da-luta');
expect(toSlug('Homem-Aranha: Um Novo Dia')).toBe('homem-aranha-um-novo-dia');
expect(toSlug('Coração Selvagem')).toBe('coracao-selvagem');
expect(toSlug('  12 12 12 ')).toBe('12-12-12');
expect(toSlug('!!!')).toBe('titulo');
expect(parseIdFromSlug('550-clube-da-luta')).toBe(550);
expect(parseIdFromSlug('550')).toBe(550);
expect(parseIdFromSlug('abc')).toBeNull();
expect(parseIdFromSlug('0-x')).toBeNull();
expect(mediaHref({ mediaType: 'movie', id: 550, title: 'Clube da Luta' })).toBe('/filme/550-clube-da-luta');
expect(mediaHref({ mediaType: 'tv', id: 1399, title: 'Game of Thrones' })).toBe('/serie/1399-game-of-thrones');
expect(personHref({ id: 287, name: 'Brad Pitt' })).toBe('/pessoa/287-brad-pitt');
expect(genreHref({ mediaType: 'movie', id: 28, name: 'Ação' })).toBe('/genero/filme/28-acao');
```

```ts
// src/lib/format.test.ts
expect(formatRating(8)).toBe('8,0');
expect(formatRating(7.25)).toBe('7,3');
expect(formatRuntime(139)).toBe('2h 19min');
expect(formatRuntime(45)).toBe('45min');
expect(formatRuntime(120)).toBe('2h');
expect(formatRuntime(0)).toBeNull();
expect(formatDate('2026-07-17')).toBe('17 de jul. de 2026');
expect(formatDate(null)).toBeNull();
expect(formatYear('1999-10-15')).toBe('1999');
expect(splitAccent('A Odisseia')).toEqual({ lead: 'A', accent: 'Odisseia' });
expect(splitAccent('Homem-Aranha: Um Novo Dia')).toEqual({ lead: 'Homem-Aranha:', accent: 'Um Novo Dia' });
expect(splitAccent('Duna')).toEqual({ lead: 'Duna', accent: null });
expect(splitAccent('O Senhor dos Anéis: Os Anéis de Poder')).toEqual({ lead: 'O Senhor dos Anéis:', accent: 'Os Anéis de Poder' });
```

- [ ] **Step 2: Rodar os testes para ver a falha**

Rode: `npx vitest run src/lib`. Esperado: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar**

- `toSlug`: normalização NFD, remove diacríticos, minúsculas, troca não alfanuméricos por `-`, apara os hífens das pontas. Se o resultado ficar vazio, devolve `'titulo'`.
- `formatDate`: `Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' })` aplicado a `${iso}T12:00:00-03:00`.
- `splitAccent`: se houver `:`, o `lead` vai até o `:` (inclusive) e o resto é o `accent`. Senão, com 2 ou mais palavras, o `accent` é a última palavra. Com uma palavra só, `accent` é `null`.

- [ ] **Step 4: Rodar os testes para ver passar**

Rode: `npx vitest run src/lib`. Esperado: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: add slug and pt-BR formatting utilities"`

---

### Task 3: Tokens de design "Sala Escura", fontes e layout raiz

**Arquivos:**
- Modificar: `src/app/globals.css`, `src/app/layout.tsx`
- Criar: `src/app/providers.tsx`, `src/ui/Grain.tsx`

**Interfaces:**
- Produz classes Tailwind a partir de `@theme`:
  - Cores: `bg-ink-950`, `bg-ink-900`, `bg-ink-800`, `bg-ink-700`, `border-ink-600`, `text-ivory`, `text-ivory-muted`, `text-amber`, `bg-amber`, `bg-amber-strong`, `text-wine`.
  - Fontes: `font-display`, `font-sans`.
  - Sombras: `shadow-poster`, `shadow-glow`.
  - Animação: `animate-fade-up`.
- Produz `<Providers>`, um Client Component com `QueryClientProvider` (`staleTime` 5 min, `refetchOnWindowFocus: false`).

- [ ] **Step 1: Definir os tokens em `globals.css`**

```css
@import 'tailwindcss';
@theme {
  --color-ink-950: #0c0a08;  --color-ink-900: #15110c;  --color-ink-800: #1e1914;
  --color-ink-700: #2a231c;  --color-ink-600: #3a3128;
  --color-ivory: #f3ede4;    --color-ivory-muted: #b3a998;
  --color-amber: #e8b25a;    --color-amber-strong: #f2c77e;  --color-wine: #6e1f1f;
  --font-display: var(--font-instrument-serif), Georgia, serif;
  --font-sans: var(--font-inter-tight), system-ui, sans-serif;
  --shadow-poster: 0 18px 40px -12px rgb(0 0 0 / 0.7);
  --shadow-glow: 0 14px 34px -10px rgb(232 178 90 / 0.28);
}
```
Inclua também:
- base com `body { @apply bg-ink-950 text-ivory font-sans antialiased; }` e `::selection` em âmbar;
- `:focus-visible` com contorno âmbar de 2px e `outline-offset` de 3px;
- keyframe `fade-up` (opacidade 0→1 e `translateY` 8px→0, 400 ms);
- bloco `@media (prefers-reduced-motion: reduce)` que zera animações e transições.

**Contraste exigido:** `ivory-muted` sobre `ink-950` ≥ 4.5:1 (#b3a998 dá ~8.9:1) e `amber` sobre `ink-950` ≥ 4.5:1 (~9.8:1). Confira com uma calculadora de contraste antes de alterar qualquer token.

- [ ] **Step 2: Configurar fontes e layout raiz em `layout.tsx`**

- `next/font/google`: `Instrument_Serif` (`weight: '400'`, `style: ['normal', 'italic']`, `variable: '--font-instrument-serif'`) e `Inter_Tight` (`weight: ['300', '400', '500', '600', '700']`, `variable: '--font-inter-tight'`), com `display: 'swap'`.
- `<html lang="pt-BR">`. `metadata` com `metadataBase: new URL(env.SITE_URL)`, título com template `'%s · TelaViva'` e padrão `'TelaViva — filmes e séries'`. `viewport.themeColor` é `#0c0a08`.
- `<body>` envolve tudo em `<Providers>`, renderiza `<Grain />` e um `<main id="conteudo">`. Header, TabBar e Footer entram na Task 8.

- [ ] **Step 3: Implementar `Grain`**

É uma `div` `fixed inset-0 pointer-events-none z-[60]` com `opacity` 0.07, `mix-blend-mode: overlay` e `background-image` de ruído SVG em data URI (`feTurbulence baseFrequency=.9 numOctaves=3`). Usa `aria-hidden`.

- [ ] **Step 4: Verificar no navegador**

Rode: `npm run dev` e abra `/`. Esperado: fundo `#0c0a08`, texto marfim com Inter Tight e granulado visível, mas sutil.

- [ ] **Step 5: Commit**

`git commit -m "feat: add Sala Escura design tokens, fonts and root layout"`

---

### Task 4: Componentes de UI base

**Arquivos:**
- Criar: `src/ui/Button.tsx`, `src/ui/RatingRing.tsx`, `src/ui/RatingRing.test.tsx`, `src/ui/MediaBadge.tsx`, `src/ui/Skeleton.tsx`, `src/ui/Letterbox.tsx`, `src/ui/AccentTitle.tsx`, `src/ui/AccentTitle.test.tsx`, `src/ui/EmptyState.tsx`, `src/ui/ErrorState.tsx`

**Interfaces:**
- Produz:
  - `Button({ variant: 'primary' | 'ghost' | 'quiet'; size?: 'sm' | 'md' | 'lg'; asChild?: boolean; ...ButtonHTMLAttributes })`. Pílula; `primary` é âmbar com texto `ink-950`; `ghost` tem borda `ivory/35`.
  - `RatingRing({ value: number | null; size?: 'sm' | 'md' | 'lg'; tone?: 'tmdb' | 'personal'; className?: string })`. Tamanhos: sm 30px, md 44px, lg 56px. `tmdb` usa âmbar e `personal` usa marfim, para a fase 2.
  - `MediaBadge({ mediaType: 'movie' | 'tv' })`. Renderiza "Série" para `tv` e nada para `movie`.
  - `Skeleton({ className })`.
  - `Letterbox()`: faixas pretas de 2.5% da altura, em cima e embaixo, `absolute`.
  - `AccentTitle({ as?: 'h1' | 'h2' | 'h3'; text?: string; lead?: string; accent?: string; className? })`. Usa `splitAccent` quando recebe `text`.
  - `EmptyState({ title, description, action? })`.
  - `ErrorState({ title?, description?, onRetry? })`.

- [ ] **Step 1: Escrever os testes que falham**

```tsx
// src/ui/RatingRing.test.tsx
render(<RatingRing value={8} />);
expect(screen.getByRole('img', { name: 'Nota 8,0 de 10' })).toBeInTheDocument();
expect(screen.getByText('8,0')).toBeInTheDocument();
expect(screen.getByRole('img').style.getPropertyValue('--pct')).toBe('80%');

render(<RatingRing value={0} />);   // e também value={null}
expect(screen.getByRole('img', { name: 'Sem nota' })).toBeInTheDocument();
expect(screen.getByText('–')).toBeInTheDocument();

render(<RatingRing value={7.66} tone="personal" />);
expect(screen.getByRole('img', { name: 'Sua nota 7,7 de 10' })).toBeInTheDocument();
```

```tsx
// src/ui/AccentTitle.test.tsx
render(<AccentTitle as="h1" text="A Odisseia" />);
const h1 = screen.getByRole('heading', { level: 1, name: 'A Odisseia' });
expect(within(h1).getByText('Odisseia').tagName).toBe('EM');
```

- [ ] **Step 2: Rodar os testes para ver a falha**

Rode: `npx vitest run src/ui`. Esperado: FAIL.

- [ ] **Step 3: Implementar os componentes**

- `RatingRing`: `conic-gradient(var(--ring) var(--pct), rgb(243 237 228 / .14) 0)` com um círculo interno `bg-ink-900`, onde `--ring` vem do tom. `role="img"` e `aria-label` montado com `formatRating`. Os componentes de UI são Server Components puros, sem `'use client'`, exceto onde houver estado.
- `AccentTitle`: aplica `font-display` e renderiza o `accent` dentro de `<em className="text-amber italic">`.

- [ ] **Step 4: Rodar os testes para ver passar**

Rode: `npx vitest run src/ui`. Esperado: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: add base UI components with rating ring"`

---

### Task 5: Cliente TMDb, schemas e fixtures

**Arquivos:**
- Criar: `src/features/tmdb/types.ts`, `client.ts`, `client.test.ts`, `schemas.ts`, `mappers.ts`, `mappers.test.ts`, `images.ts`, `images.test.ts`, `src/test/server.ts`, `scripts/capture-fixtures.ts`, `src/test/fixtures/*.json`
- Modificar: `src/test/setup.ts`, para iniciar e parar o servidor MSW

**Interfaces:**
- Produz tipos (`types.ts`):

```ts
export type MediaType = 'movie' | 'tv';
export interface MediaSummary {
  id: number; mediaType: MediaType; title: string; originalTitle: string; overview: string;
  posterPath: string | null; backdropPath: string | null;
  voteAverage: number; voteCount: number; popularity: number;
  releaseDate: string | null;           // filme: release_date; série: first_air_date
  genreIds: number[]; originalLanguage: string;
}
export interface PersonSummary { id: number; name: string; profilePath: string | null; knownForDepartment: string | null }
export interface Paginated<T> { page: number; totalPages: number; totalResults: number; results: T[] }
export interface Genre { id: number; name: string }
export interface Video { key: string; site: string; type: string; official: boolean; language: string; name: string }
export interface CastMember { id: number; name: string; character: string; profilePath: string | null; order: number }
export interface Provider { id: number; name: string; logoPath: string | null }
export interface WatchProviders { link: string | null; flatrate: Provider[]; free: Provider[]; ads: Provider[]; rent: Provider[]; buy: Provider[] }
```
- Produz:
  - `tmdbFetch<S extends z.ZodType>(path: string, params: TmdbParams, schema: S): Promise<z.infer<S>>`, com `type TmdbParams = Record<string, string | number | boolean | undefined | null>`.
  - `class TmdbError extends Error { status: number; path: string }`.
  - `isTmdbNotFound(e: unknown): boolean`.
- Produz:
  - `toMediaSummary(raw: RawMovie | RawTv, mediaType: MediaType): MediaSummary`
  - `toPaginated<R, T>(raw: RawPage<R>, map: (r: R) => T): Paginated<T>`
  - `withOverviewFallback<T extends { overview: string }>(primary: T, fallback: () => Promise<{ overview: string }>): Promise<T>`
- Produz:
  - `tmdbImage(path: string | null, size: ImageSize): string | null`, com `type ImageSize = 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'w1280' | 'h632' | 'original'`.
  - `posterSrcSet(path: string | null): string | undefined`, com larguras 185, 342, 500 e 780.
  - `backdropSrcSet(path): string | undefined`, com larguras 780, 1280 e original como 1920w.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// client.test.ts (usa MSW: http.get(`${BASE}/movie/550`, ...))
it('envia Bearer e language=pt-BR, sem api_key', async () => {
  // o handler captura a request
  await tmdbFetch('movie/550', {}, z.object({ id: z.number() }));
  expect(captured.headers.get('authorization')).toBe('Bearer test-token');
  expect(new URL(captured.url).searchParams.get('language')).toBe('pt-BR');
  expect(new URL(captured.url).searchParams.has('api_key')).toBe(false);
});
it('omite params undefined/null/vazios', ...);     // ?page=2 presente; year ausente
it('404 vira TmdbError e isTmdbNotFound=true', ...);
it('500 vira TmdbError status 500', ...);
it('resposta fora do schema lança erro com o path', ...);
```

```ts
// mappers.test.ts
expect(toMediaSummary(rawTvFixture, 'tv')).toMatchObject({ mediaType: 'tv', title: rawTvFixture.name, releaseDate: rawTvFixture.first_air_date });
expect(toMediaSummary({ ...rawMovie, poster_path: null, overview: '' }, 'movie')).toMatchObject({ posterPath: null, overview: '' });
it('withOverviewFallback usa en-US só quando pt-BR vem vazio', async () => {
  const fb = vi.fn().mockResolvedValue({ overview: 'English' });
  expect((await withOverviewFallback({ overview: '' }, fb)).overview).toBe('English');
  expect((await withOverviewFallback({ overview: 'PT' }, fb)).overview).toBe('PT');
  expect(fb).toHaveBeenCalledTimes(1);
});
```

```ts
// images.test.ts
expect(tmdbImage('/a.jpg', 'w500')).toBe('https://image.tmdb.org/t/p/w500/a.jpg');
expect(tmdbImage(null, 'w500')).toBeNull();
expect(posterSrcSet('/a.jpg')).toContain('/w342/a.jpg 342w');
```

- [ ] **Step 2: Rodar os testes para ver a falha**

Rode: `npx vitest run src/features/tmdb`. Esperado: FAIL.

- [ ] **Step 3: Implementar `client.ts`, `schemas.ts`, `mappers.ts` e `images.ts`**

- `client.ts` importa `server-only`, usa `env` e sempre define `language=pt-BR`, exceto quando o chamador passa outro `language`.
- `schemas.ts` cobre só os campos usados, com `.passthrough()` desligado e `nullable` ou `default` onde o TMDb omite valores.
- Nos testes, `server-only` é resolvido para um módulo vazio via `alias` no `vitest.config.ts`.

- [ ] **Step 4: Criar `scripts/capture-fixtures.ts` e gravar as fixtures**

O script lê `TMDB_READ_TOKEN` do `.env.local` e grava em `src/test/fixtures/` as respostas reais de:
- `trending/all/day`, `trending/movie/week`, `trending/tv/week`
- `movie/now_playing?region=BR`, `movie/upcoming?region=BR`, `discover/movie` (popular)
- `movie/550?append_to_response=videos,credits,release_dates,watch/providers,recommendations,external_ids`
- `tv/1399?append_to_response=videos,aggregate_credits,content_ratings,watch/providers,recommendations` e `tv/1399/season/1`
- `person/287?append_to_response=combined_credits,images`
- `search/multi?query=matrix`, `genre/movie/list`, `genre/tv/list`, `watch/providers/movie?watch_region=BR`

Rode: `npx tsx scripts/capture-fixtures.ts`. **Requer** o token v4 do autor no `.env.local`. Esperado: os arquivos JSON criados.

- [ ] **Step 5: Rodar os testes para ver passar**

Rode: `npx vitest run src/features/tmdb`. Esperado: PASS.

- [ ] **Step 6: Commit**

`git commit -m "feat: add typed TMDb client with Bearer auth, schemas and fixtures"`

---

### Task 6: Domínio TMDb (filmes, séries, pessoas, busca, descobrir, gêneros) e curadoria

**Arquivos:**
- Criar: `src/features/tmdb/movies.ts`, `tv.ts`, `people.ts`, `search.ts`, `discover.ts`, `genres.ts`, `src/features/catalog/curation.ts`, `src/features/catalog/curation.test.ts`, `src/features/tmdb/details.test.ts`

**Interfaces:**
- Consome: `tmdbFetch`, os mapeadores e os tipos da Task 5.
- Produz (todas as funções são `async` e marcadas com `'use cache'` + `cacheLife(...)` + `cacheTag(...)`):
  - `getTrending(media: MediaType | 'all', window: 'day' | 'week', page = 1): Promise<Paginated<MediaSummary>>`
  - `getMovieList(list: MovieListKey, page = 1)`, com `MovieListKey = 'now_playing' | 'upcoming' | 'popular' | 'top_rated' | 'hidden_gems' | 'short' | 'blockbusters' | 'streaming_br'`. As regras de cada lista são as da v1: `now_playing` com janela de -120 a +14 dias e `vote_count ≥ 40`; `upcoming` de +1 a +450 dias com `with_release_type=2|3`; `top_rated` com `vote_count ≥ 1200`, `vote_average ≥ 7.2` e nota ponderada; `hidden_gems` com nota ≥ 7.2 e votos entre 120 e 1200; `short` com `with_runtime.lte=100`, votos ≥ 100 e nota ≥ 6; `blockbusters` com `sort_by=revenue.desc` e votos ≥ 1000; `streaming_br` com `watch_region=BR` e `with_watch_monetization_types=flatrate`.
  - `getTvList(list: TvListKey, page = 1)`, com `TvListKey = 'airing_today' | 'on_the_air' | 'popular' | 'top_rated'`. `top_rated` usa nota ponderada com `vote_count ≥ 500`.
  - `getMovieDetails(id: number): Promise<MovieDetails>` e `getTvDetails(id: number): Promise<TvDetails>`, mais `getSeason(tvId: number, season: number): Promise<SeasonDetails>`. Os tipos são definidos em `types.ts`.
    - `MovieDetails extends MediaSummary`: `runtime`, `tagline`, `genres: Genre[]`, `certification: string | null` (BR), `trailer: Video | null`, `cast: CastMember[]` (até 20), `providers: WatchProviders`, `recommendations: MediaSummary[]`, `imdbId`.
    - `TvDetails extends MediaSummary`: `tagline`, `genres`, `certification`, `trailer`, `cast`, `providers`, `recommendations`, `status: string`, `inProduction: boolean`, `numberOfSeasons`, `numberOfEpisodes`, `seasons: SeasonSummary[]`, `nextEpisodeToAir: EpisodeSummary | null`, `lastEpisodeToAir: EpisodeSummary | null`, `episodeRunTime: number | null`.
    - `SeasonSummary { seasonNumber: number; name: string; episodeCount: number; airDate: string | null; posterPath: string | null }`
    - `EpisodeSummary { seasonNumber: number; episodeNumber: number; name: string; overview: string; airDate: string | null; stillPath: string | null; runtime: number | null; voteAverage: number }`
    - `SeasonDetails { seasonNumber: number; name: string; overview: string; episodes: EpisodeSummary[] }`
  - `getPerson(id: number): Promise<PersonDetails>`, com `PersonDetails { id, name, biography, birthday, deathday, placeOfBirth, profilePath, knownForDepartment, alsoKnownAs: string[], credits: PersonCredit[], images: string[] }` e `PersonCredit = MediaSummary & { role: string; department: string }`.
  - `searchMulti(query: string, page = 1): Promise<Paginated<SearchItem>>`
  - `discover(media: MediaType, params: TmdbParams, page = 1): Promise<Paginated<MediaSummary>>`. Recebe params já no formato do TMDb, sempre com `include_adult=false`. A tradução dos filtros da URL para esses params é feita pela Task 14 (`toTmdbParams`), e as páginas de gênero chamam `discover(media, { with_genres: id, sort_by: 'popularity.desc' })`.
  - `SearchItem = MediaSummary | (PersonSummary & { mediaType: 'person' })`, definido em `types.ts` e reutilizado pela Task 13.
  - `getGenres(media: MediaType): Promise<Genre[]>` e `getWatchProviderCatalog(media: MediaType): Promise<Provider[]>`.
- Produz em `curation.ts`, como funções puras:
  - `weightedRating(vote: number, count: number, m = 1500, c = 6.8): number`
  - `sortByWeightedRating(items: MediaSummary[], m?: number): MediaSummary[]`
  - `refine(items: MediaSummary[], rules: RefineRules): MediaSummary[]`, com `RefineRules { minVoteAverage?; minVoteCount?; requireImage?; minOverviewLength?; minDate?: Date; maxDate?: Date; minResultsBeforeFallback?: number }`. Devolve os itens originais se o resultado tiver menos que `minResultsBeforeFallback` (padrão 8).
  - `pickTrailer(videos: Video[]): Video | null`. Pontuação: YouTube +50, Trailer +30, oficial +15, pt +10. Só YouTube é aceito.
  - `brCertification(releaseDates: RawReleaseDates): string | null`, para filmes. `brTvRating(contentRatings): string | null`, para séries.

- [ ] **Step 1: Escrever os testes de curadoria que falham**

```ts
expect(weightedRating(9, 0)).toBeCloseTo(6.8);
expect(weightedRating(9, 100000)).toBeGreaterThan(8.9);
expect(sortByWeightedRating([a(9.5, 20), b(8.4, 30000)])[0].id).toBe(b.id); // nota alta com poucos votos não vence
expect(pickTrailer([{ site: 'Vimeo', type: 'Trailer', official: true, language: 'pt' }, yt('Teaser', false, 'en'), yt('Trailer', true, 'en')])?.key).toBe('trailer-oficial');
expect(pickTrailer([])).toBeNull();
expect(refine(items10, { minVoteCount: 1e9, minResultsBeforeFallback: 8 })).toHaveLength(10); // fallback
expect(brCertification(fixtureMovie550.release_dates)).toBe('18');
```

- [ ] **Step 2: Escrever os testes de detalhes que falham (com MSW e fixtures)**

```ts
const m = await getMovieDetails(550);
expect(m).toMatchObject({ id: 550, mediaType: 'movie', runtime: 139 });
expect(m.trailer?.site).toBe('YouTube');
expect(m.cast.length).toBeLessThanOrEqual(20);
const t = await getTvDetails(1399);
expect(t.seasons.find((s) => s.seasonNumber === 0)).toBeDefined(); // especiais vêm, a UI decide
const s = await getSeason(1399, 1);
expect(s.episodes[0]).toMatchObject({ seasonNumber: 1, episodeNumber: 1 });
```

Nos testes, `'use cache'` não tem efeito. Faça um mock de `next/cache` (`cacheLife`/`cacheTag` como no-op) em `src/test/setup.ts`.

- [ ] **Step 3: Rodar os testes para ver a falha**

Rode: `npx vitest run src/features`. Esperado: FAIL.

- [ ] **Step 4: Implementar os módulos de domínio**

Cada função monta os params, chama `tmdbFetch`, aplica `refine` ou ordenação e mapeia para os tipos de domínio. Detalhes usam um único request com `append_to_response` e `withOverviewFallback` (en-US).

- [ ] **Step 5: Rodar os testes para ver passar**

Rode: `npx vitest run`. Esperado: PASS.

- [ ] **Step 6: Commit**

`git commit -m "feat: add TMDb domain functions and curation rules ported from v1"`

---

### Task 7: PosterCard, Rail e MediaGrid infinita

**Arquivos:**
- Criar: `src/features/catalog/PosterCard.tsx`, `PosterCard.test.tsx`, `Rail.tsx`, `Rail.test.tsx`, `MediaGrid.tsx`, `lists.ts`, `lists.test.ts`, `src/app/api/catalog/route.ts`

**Interfaces:**
- Consome: `MediaSummary`, `mediaHref`, `tmdbImage`/`posterSrcSet`, `RatingRing`, `MediaBadge`, `getMovieList`, `getTvList` e `getTrending`.
- Produz:
  - `PosterCard({ item: MediaSummary; priority?: boolean; sizes?: string; subtitle?: string; actions?: ReactNode })`
  - `Rail({ title: { lead: string; accent?: string }; href?: string; items: MediaSummary[]; id: string })`, um Client Component
  - `MediaGrid({ endpoint: string; initialPage: Paginated<MediaSummary> })`, um Client Component com `useInfiniteQuery` em `${endpoint}${endpoint.includes('?') ? '&' : '?'}page=${n}`. As listas usam `endpoint={`/api/catalog?list=${id}`}`. Descobrir e gêneros usam `/api/discover?...`.
- Produz em `lists.ts`:
  - `CATALOG_LISTS: Record<CatalogListId, { title: { lead: string; accent?: string }; description: string; media: MediaType; fetch: (page: number) => Promise<Paginated<MediaSummary>> }>`
  - `CatalogListId` com os valores:
    - `'filmes/em-alta'`, `'filmes/em-cartaz'`, `'filmes/populares'`, `'filmes/mais-bem-avaliados'`, `'filmes/em-breve'`, `'filmes/joias-escondidas'`, `'filmes/curtos'`, `'filmes/blockbusters'`, `'filmes/no-streaming'`
    - `'series/em-alta'`, `'series/no-ar-hoje'`, `'series/em-exibicao'`, `'series/populares'`, `'series/mais-bem-avaliadas'`
  - `isCatalogListId(v: string): v is CatalogListId`

- [ ] **Step 1: Escrever os testes que falham**

```tsx
// PosterCard.test.tsx
render(<PosterCard item={movie({ title: 'Clube da Luta', id: 550, voteAverage: 8.4 })} />);
expect(screen.getByRole('link', { name: /Clube da Luta/ })).toHaveAttribute('href', '/filme/550-clube-da-luta');
expect(screen.getByRole('img', { name: 'Nota 8,4 de 10' })).toBeInTheDocument();
render(<PosterCard item={tv({ posterPath: null, title: 'X' })} />);
expect(screen.getByText('Série')).toBeInTheDocument();
expect(screen.getByTestId('poster-placeholder')).toHaveTextContent('X'); // sem <img> quebrada
```

```tsx
// Rail.test.tsx
render(<Rail id="r" title={{ lead: 'Séries', accent: 'em alta' }} href="/series/em-alta" items={five} />);
expect(screen.getByRole('region', { name: 'Séries em alta' })).toBeInTheDocument();
expect(screen.getByRole('link', { name: 'Ver tudo: Séries em alta' })).toHaveAttribute('href', '/series/em-alta');
expect(screen.getAllByRole('listitem')).toHaveLength(5);
```

```ts
// lists.test.ts
expect(isCatalogListId('filmes/populares')).toBe(true);
expect(isCatalogListId('filmes/nao-existe')).toBe(false);
```

- [ ] **Step 2: Rodar os testes para ver a falha**

Rode: `npx vitest run src/features/catalog`. Esperado: FAIL.

- [ ] **Step 3: Implementar**

- **`PosterCard`**: `<img>` com `srcSet`/`sizes`, `loading` lazy, exceto quando `priority`, e `decoding="async"`, numa proporção de 2/3.
  - Sem pôster, mostra o placeholder `bg-ink-800` com o título em `font-display`.
  - `RatingRing` sm no canto inferior esquerdo e `MediaBadge` no canto superior direito.
  - Título e ano abaixo do pôster.
  - No hover e no foco: contorno âmbar, `-translate-y-1` e `shadow-glow`.
- **`Rail`**: `<section aria-label>` com um `<ul>` horizontal (`overflow-x-auto`, `snap-x snap-mandatory`, `scrollbar` oculta).
  - Botões de seta só no desktop, quando houver overflow, rolando 85% da largura.
  - Arrastar com o mouse (clique não navega se houve arrasto acima de 4px).
  - Teclado: setas esquerda e direita movem o foco entre os cards.
  - Padding horizontal **único**, vindo do container da página. Na v1 o padding era duplicado.
- **`MediaGrid`**: grade responsiva de 3 colunas (≤640px), 4 (sm), 5 (md), 6 (lg), 7 (xl) e 8 (2xl). Usa um sentinela com `IntersectionObserver` (`rootMargin` 600px) e um botão "Carregar mais" como alternativa acessível. Mostra esqueletos no formato do card durante o carregamento e o fim de lista com a mensagem "Você chegou ao fim".
- **`route.ts`**: `GET` valida `list` com `isCatalogListId` (400 se inválido) e `page` como inteiro entre 1 e 500. Responde com `CATALOG_LISTS[list].fetch(page)`.

- [ ] **Step 4: Rodar os testes para ver passar**

Rode: `npx vitest run src/features/catalog`. Esperado: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: add poster card, rail carousel and infinite media grid"`

---

### Task 8: Shell (Header, TabBar mobile, Footer), 404 e erro

**Arquivos:**
- Criar: `src/features/shell/nav.ts`, `Header.tsx`, `Header.test.tsx`, `TabBar.tsx`, `TabBar.test.tsx`, `Footer.tsx`, `Wordmark.tsx`, `public/brand/tmdb.svg`
- Modificar: `src/app/layout.tsx`
- Criar: `src/app/not-found.tsx`, `src/app/error.tsx`

**Interfaces:**
- Produz `NAV_ITEMS`:
  - `[{ href: '/', label: 'Início' }, { href: '/filmes', label: 'Filmes' }, { href: '/series', label: 'Séries' }, { href: '/descobrir', label: 'Descobrir' }, { href: '/minha-lista', label: 'Minha lista' }]`.
  - `/minha-lista` mostra o EmptyState "Em breve" até a fase 2. Crie `src/app/minha-lista/page.tsx` com ele.
- Produz `TAB_ITEMS`: Início, Filmes, Séries, Buscar (`/buscar`) e Minha lista, com ícones lucide `House`, `Clapperboard`, `Tv`, `Search` e `Bookmark`.
- Produz `isActive(pathname: string, href: string): boolean`. `/` só é ativo em `/`. Os outros são ativos pelo prefixo, e `/filme/` conta como `/filmes`, assim como `/serie/` conta como `/series`.
- Produz `Wordmark({ className })`: "Tela" + `<em className="text-amber">viva</em>` em `font-display`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
expect(isActive('/', '/')).toBe(true);
expect(isActive('/filmes/populares', '/')).toBe(false);
expect(isActive('/filme/550-x', '/filmes')).toBe(true);
expect(isActive('/serie/1-x', '/series')).toBe(true);
```

```tsx
// Header.test.tsx (usePathname mockado como '/series')
expect(screen.getByRole('link', { name: 'Séries' })).toHaveAttribute('aria-current', 'page');
expect(screen.getByRole('button', { name: /Buscar/ })).toBeInTheDocument(); // abre a paleta (Task 13)
// TabBar.test.tsx
expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
expect(screen.getAllByRole('link')).toHaveLength(5);
```

- [ ] **Step 2: Rodar os testes para ver a falha**

Rode: `npx vitest run src/features/shell`. Esperado: FAIL.

- [ ] **Step 3: Implementar**

- **Header** (desktop ≥ md): fixo, transparente no topo e `bg-ink-950/85 backdrop-blur` depois de 24px de rolagem. Tem o Wordmark, os links com indicador âmbar no ativo e o botão de busca com o atalho `Ctrl K`.
  - No mobile, o Header mostra só o Wordmark. A navegação fica na TabBar.
- **TabBar** (< md): fixa embaixo, com `pb-[env(safe-area-inset-bottom)]`. O item ativo fica âmbar. O `<main>` ganha `pb-20 md:pb-0`.
- **Footer**:
  - Wordmark, links principais e créditos do autor (GitHub `https://github.com/higorxyz` e LinkedIn `https://www.linkedin.com/in/higorbatista`).
  - **Atribuição TMDb**: logo de `public/brand/tmdb.svg`, baixado dos logos oficiais em `https://www.themoviedb.org/about/logos-attribution`, com o texto exato das Restrições globais.
- **`not-found.tsx`**: AccentTitle "Cena *perdida*", texto curto, botão para `/` e link para `/buscar`.
- **`error.tsx`**: `ErrorState` com `onRetry={reset}`.

- [ ] **Step 4: Rodar os testes para ver passar**

Rode: `npx vitest run src/features/shell`. Esperado: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: add header, mobile tab bar, footer with TMDb attribution, 404 and error pages"`

---

### Task 9: Home (destaque e trilhos sem repetição)

**Arquivos:**
- Criar: `src/features/catalog/hero.ts`, `hero.test.ts`, `rails.ts`, `rails.test.ts`, `Hero.tsx`
- Modificar: `src/app/page.tsx`

**Interfaces:**
- Consome: `getTrending`, `getMovieList`, `getTvList`, `Rail`, `PosterCard`, `AccentTitle`, `RatingRing`, `Letterbox` e `Button`.
- Produz:
  - `scoreHeroCandidate(c: { item: MediaSummary; sourceBoost: number; rank: number; sourceCount: number }): number`. Port da v1: qualidade `max(nota-6,0)*9`, confiança `log10(votos+1)*8`, popularidade `min(pop,180)/10`, bônus de recência (≤1,5 ano: 8; ≤5: 5; ≤12: 2; ≥30: -4), sinopse (≥140: 6; ≥90: 3; ≥50: 0; menor: -8) e `(sourceCount-1)*5`.
  - `pickHero(sources: Array<{ items: MediaSummary[]; sourceBoost: number }>): MediaSummary | null`. Exige backdrop e usa os 18 primeiros de cada fonte.
  - `dedupeRails(rails: RailInput[], opts: { perRail: number; exclude?: number[] }): RailOutput[]`, com `RailInput { id: string; title: { lead: string; accent?: string }; href?: string; items: MediaSummary[] }`. Usa a chave `${mediaType}:${id}`, segue a ordem de prioridade dos trilhos, remove trilhos com menos de 6 itens e corta em `perRail`.
  - `buildHomeRails(): Promise<RailOutput[]>`. Usa `Promise.allSettled`, então trilho com fonte rejeitada é descartado, e loga com `console.error`.
- `Hero({ item: MediaSummary & { runtime?: number | null; genres?: Genre[] } })`. É Server Component. O parallax fica num wrapper client opcional com `motion`, desligado com reduced motion.

**Ordem dos trilhos da home (prioridade da deduplicação):**

| # | Trilho | Fonte | "Ver tudo" |
|---|---|---|---|
| 1 | Bombando *hoje* | trending all/day | `/filmes/em-alta` |
| 2 | Nos *cinemas* | now_playing | `/filmes/em-cartaz` |
| 3 | Séries *em alta* | trending tv/week | `/series/em-alta` |
| 4 | No streaming *no Brasil* | streaming_br | `/filmes/no-streaming` |
| 5 | Séries *no ar esta semana* | on_the_air | `/series/em-exibicao` |
| 6 | Joias *escondidas* | hidden_gems | `/filmes/joias-escondidas` |
| 7 | Clássicos *validados* | movie top_rated | `/filmes/mais-bem-avaliados` |
| 8 | Séries *aclamadas* | tv top_rated | `/series/mais-bem-avaliadas` |
| 9 | Curtos *para hoje* | short | `/filmes/curtos` |
| 10 | Grandes *bilheterias* | blockbusters | `/filmes/blockbusters` |
| 11 | Em *breve* | upcoming | `/filmes/em-breve` |

`perRail = 14`. O título do destaque entra no `exclude`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// rails.test.ts
const out = dedupeRails([rail('a', [m1, m2, ...eight]), rail('b', [m1, m3, ...eight2])], { perRail: 14 });
expect(out[1].items.find((i) => i.id === m1.id)).toBeUndefined();         // m1 só no primeiro
expect(dedupeRails([rail('a', [m1, m2])], { perRail: 14 })).toHaveLength(0); // < 6 some
expect(dedupeRails([rail('a', ten)], { perRail: 14, exclude: [ten[0].id] })[0].items).toHaveLength(9);
// filme 10 e série 10 não colidem: a chave inclui o mediaType
// buildHomeRails com uma fonte rejeitada (MSW 500 em movie/now_playing) devolve os demais trilhos
```

```ts
// hero.test.ts
expect(pickHero([{ items: [noBackdrop, good], sourceBoost: 22 }])?.id).toBe(good.id);
expect(pickHero([{ items: [], sourceBoost: 1 }])).toBeNull();
// um item presente em 2 fontes vence um item parecido presente em 1
```

- [ ] **Step 2: Rodar os testes para ver a falha**

Rode: `npx vitest run src/features/catalog`. Esperado: FAIL.

- [ ] **Step 3: Implementar `hero.ts`, `rails.ts`, `Hero.tsx` e a home**

- **`Hero`**: altura `min(88svh, 900px)` no desktop e `72svh` no mobile.
  - Backdrop com `backdropSrcSet` e `fetchPriority="high"` (JSX em camelCase, que o React 19 aceita).
  - Degradês da direção A, `Letterbox`, kicker "Em destaque", `AccentTitle h1` e linha de meta com `RatingRing` md, ano, gêneros e duração.
  - Botões "▶ Assistir trailer", que abre o `Trailer` da Task 10 num `dialog`, e "Ver detalhes".
  - No mobile, o texto fica sobre o degradê inferior e os botões ficam em largura total.
- **Página**: `<Hero>` dentro de `Suspense` com esqueleto, mais os trilhos, cada um dentro do seu `Suspense`. Entre os trilhos 6 e 7 entra um bloco editorial com atalhos para `/descobrir`, reaproveitando os 4 "atalhos rápidos" da v1 com links para os filtros novos da Task 14.
- **`metadata`** da home: título `'TelaViva — filmes e séries'` e a descrição do spec.

- [ ] **Step 4: Rodar os testes para ver passar**

Rode: `npx vitest run`. Esperado: PASS.

- [ ] **Step 5: Verificar no navegador**

Rode `npm run dev` com o token real. Confira `/` em 1440px e em 390px. Esperado: o destaque com faixas widescreen, os trilhos sem títulos repetidos e a TabBar no mobile.

- [ ] **Step 6: Commit**

`git commit -m "feat: build editorial home with scored hero and deduplicated rails"`

---

### Task 10: Hubs, listas e detalhe de filme

**Arquivos:**
- Criar: `src/app/filmes/page.tsx`, `src/app/filmes/[lista]/page.tsx`, `src/app/series/page.tsx`, `src/app/series/[lista]/page.tsx`, `src/app/filme/[slug]/page.tsx`, `src/features/detail/DetailHero.tsx`, `Trailer.tsx`, `Trailer.test.tsx`, `CastRail.tsx`, `WatchProviders.tsx`, `WatchProviders.test.tsx`, `FactsList.tsx`, `src/features/detail/canonical.ts`, `canonical.test.ts`

**Interfaces:**
- Consome: `CATALOG_LISTS`, `MediaGrid`, `Rail`, `getMovieDetails`, `mediaHref` e `parseIdFromSlug`.
- Produz:
  - `resolveCanonical(params: { slug: string }, kind: 'filme' | 'serie' | 'pessoa'): { id: number } | 'not-found'`
  - `assertCanonical(currentSlug: string, canonicalHref: string): void`. Chama `permanentRedirect(canonicalHref)` quando o slug difere.
  - `DetailHero({ item, meta: ReactNode, actions?: ReactNode })`
  - `Trailer({ video: Video; title: string })`. Fachada leve: miniatura `https://i.ytimg.com/vi/${key}/hqdefault.jpg`. O `iframe` de `youtube-nocookie.com/embed/${key}?autoplay=1` só carrega depois do clique.
  - `CastRail({ cast: CastMember[] })` e `WatchProviders({ providers: WatchProviders })`. Mostra as seções "Streaming", "Grátis", "Com anúncios", "Aluguel" e "Compra", com link "Ver opções no TMDb" (`providers.link`) e o crédito do JustWatch.
  - `FactsList({ facts: Array<{ label: string; value: ReactNode }> })`

- [ ] **Step 1: Escrever os testes que falham**

```ts
expect(resolveCanonical({ slug: '550-clube-da-luta' }, 'filme')).toEqual({ id: 550 });
expect(resolveCanonical({ slug: 'abc' }, 'filme')).toBe('not-found');
```

```tsx
render(<Trailer video={v} title="Clube da Luta" />);
expect(document.querySelector('iframe')).toBeNull();
await user.click(screen.getByRole('button', { name: 'Assistir trailer de Clube da Luta' }));
expect(document.querySelector('iframe')?.src).toContain('youtube-nocookie.com/embed/');

render(<WatchProviders providers={{ ...empty, flatrate: [netflix] }} />);
expect(screen.getByText('Streaming')).toBeInTheDocument();
expect(screen.queryByText('Aluguel')).toBeNull();
expect(screen.getByText('Dados de streaming fornecidos por JustWatch.')).toBeInTheDocument();
// sem nenhum provedor: "Ainda não disponível em streaming no Brasil."
```

- [ ] **Step 2: Rodar os testes para ver a falha**

Rode: `npx vitest run src/features/detail`. Esperado: FAIL.

- [ ] **Step 3: Implementar componentes e páginas**

- **`/filmes` e `/series`**: cabeçalho com AccentTitle ("Filmes *em cartaz e além*" e "Séries *para maratonar*") e os trilhos das listas daquele tipo, usando a ordem de `CATALOG_LISTS` e `dedupeRails`.
- **`/filmes/[lista]`**: `notFound()` se `!isCatalogListId('filmes/' + lista)`. Cabeçalho mais `MediaGrid` com a primeira página buscada no servidor. `generateStaticParams` cobre todas as listas.
- **`/filme/[slug]`**:
  - `resolveCanonical`, depois `getMovieDetails`. Um `TmdbError` 404 leva a `notFound()`, e o slug é conferido com `assertCanonical`.
  - O `DetailHero` mostra o backdrop com Letterbox, um pôster grande à esquerda no desktop e, no mobile, o pôster sobre o degradê.
  - Linha de meta com `RatingRing` lg, ano, duração, a classificação BR num selo com borda e os gêneros como links para `genreHref`.
  - Tagline em itálico.
  - Seções na ordem: Sinopse, Trailer, Onde assistir, Elenco, Ficha técnica (título original, lançamento, idioma, orçamento se houver) e "Você também pode gostar" (`Rail` das recomendações).
  - `generateMetadata` com título, descrição (sinopse cortada em 155 caracteres) e `alternates.canonical`.

- [ ] **Step 4: Rodar os testes para ver passar**

Rode: `npx vitest run`. Esperado: PASS.

- [ ] **Step 5: Verificar no navegador**

Abra `/filme/550` → 308 para `/filme/550-clube-da-luta`. Abra `/filme/999999999-x` → 404. Abra `/filmes/populares` → grade infinita.

- [ ] **Step 6: Commit**

`git commit -m "feat: add movie and series hubs, list pages and movie detail page"`

---

### Task 11: Detalhe de série (temporadas e episódios)

**Arquivos:**
- Criar: `src/app/serie/[slug]/page.tsx`, `src/features/detail/SeasonPicker.tsx`, `SeasonPicker.test.tsx`, `EpisodeList.tsx`, `EpisodeList.test.tsx`, `src/features/detail/seasons.ts`, `seasons.test.ts`

**Interfaces:**
- Consome: `getTvDetails`, `getSeason`, `DetailHero`, `Trailer`, `CastRail`, `WatchProviders`, `FactsList`, `resolveCanonical` e `assertCanonical`.
- Produz:
  - `orderSeasons(seasons: SeasonSummary[]): SeasonSummary[]`. Regulares em ordem crescente, depois a temporada 0 com o rótulo "Especiais". Remove temporadas com `episodeCount === 0` e sem `airDate`.
  - `defaultSeason(tv: TvDetails): number | null`. É a temporada do `lastEpisodeToAir`, senão a primeira regular, senão `null`.
  - `SeasonPicker({ seasons: SeasonSummary[]; current: number; baseHref: string })`. Usa links `?temporada=N` com `scroll={false}`: abas roláveis no desktop e um `<select>` estilizado no mobile.
  - `EpisodeList({ season: SeasonDetails; renderAction?: (ep: EpisodeSummary) => ReactNode })`. O slot da fase 2.

- [ ] **Step 1: Escrever os testes que falham**

```ts
expect(orderSeasons([s(0), s(2), s(1)]).map((x) => x.seasonNumber)).toEqual([1, 2, 0]);
expect(orderSeasons([s(0)]).map((x) => x.seasonNumber)).toEqual([0]);
expect(orderSeasons([])).toEqual([]);
expect(defaultSeason(tv({ seasons: [], lastEpisodeToAir: null }))).toBeNull();
```

```tsx
render(<EpisodeList season={season([ep(1, '2026-01-01'), ep(2, null)])} />);
expect(screen.getByText('Data a definir')).toBeInTheDocument();
expect(screen.getAllByRole('listitem')).toHaveLength(2);
// episódio futuro mostra o selo "Estreia 17 de jul. de 2027" (relógio fixo com vi.setSystemTime)
```

- [ ] **Step 2: Rodar os testes para ver a falha**

Rode: `npx vitest run src/features/detail`. Esperado: FAIL.

- [ ] **Step 3: Implementar a página da série**

Igual à de filme, com estas diferenças:
- **Meta**: status traduzido ("Em exibição", "Finalizada", "Cancelada", "Em produção"), número de temporadas e episódios, e duração média dos episódios.
- **Bloco "Próximo episódio"**: aparece quando há `nextEpisodeToAir`, com T/E, nome e data.
- **Temporadas**: a temporada vem de `searchParams.temporada` validado (número presente em `orderSeasons`), ou de `defaultSeason`. O `getSeason` roda dentro de `Suspense`.
- **Sem temporadas**: `EmptyState` com "Ainda não há episódios cadastrados."
- **Cada episódio**: still `w300` ou placeholder, "E{n} · nome", data, duração, sinopse com até 3 linhas e expandir.

- [ ] **Step 4: Rodar os testes para ver passar**

Rode: `npx vitest run`. Esperado: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: add series detail page with seasons and episodes"`

---

### Task 12: Perfil de pessoa

**Arquivos:**
- Criar: `src/app/pessoa/[slug]/page.tsx`, `src/features/detail/person.ts`, `person.test.ts`

**Interfaces:**
- Consome: `getPerson`, `Rail`, `PosterCard`, `resolveCanonical` e `assertCanonical`.
- Produz:
  - `knownFor(credits: PersonCredit[], limit = 12): PersonCredit[]`. Deduplica por `mediaType:id`, ordena por `voteCount*0.6 + popularity*0.4` e exige pôster.
  - `filmography(credits): Array<{ year: string; items: PersonCredit[] }>`. Anos em ordem decrescente, sem data no fim como "Sem data".
  - `age(birthday: string, deathday: string | null, today?: Date): number`
  - `departmentLabel(d: string): string`. Mapa: Acting → Atuação, Directing → Direção, Writing → Roteiro, Production → Produção, Sound → Som, Camera → Fotografia, Editing → Edição, Art → Direção de arte, Costume & Make-Up → Figurino e maquiagem, Visual Effects → Efeitos visuais, Crew → Equipe. Outros valores passam como vieram.

- [ ] **Step 1: Escrever os testes que falham**

```ts
expect(age('1963-12-18', null, new Date('2026-11-18'))).toBe(62);
expect(age('1950-01-01', '2000-06-01')).toBe(50);
expect(knownFor([dup, dup, noPoster, good])).toEqual([dup, good].sort(byScore));
expect(filmography([y2020, y1999, noDate]).map((g) => g.year)).toEqual(['2020', '1999', 'Sem data']);
expect(departmentLabel('Directing')).toBe('Direção');
```

- [ ] **Step 2: Rodar os testes para ver a falha**

Rode: `npx vitest run src/features/detail/person.test.ts`. Esperado: FAIL.

- [ ] **Step 3: Implementar a página**

- Foto grande com contorno âmbar, nome em `AccentTitle` e fatos (nascimento, idade ou falecimento, local, área).
- Biografia com "Ler mais" depois de cerca de 520 caracteres. Sem biografia em pt-BR, usa o fallback en-US.
- Rail "Conhecido *por*" e filmografia agrupada por ano, com filtro Todos, Atuação ou Equipe.

- [ ] **Step 4: Rodar os testes para ver passar**

Rode: `npx vitest run`. Esperado: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: add person profile page"`

---

### Task 13: Busca (página, paleta Ctrl+K e API)

**Arquivos:**
- Criar: `src/app/api/search/route.ts`, `src/app/buscar/page.tsx`, `src/features/search/useSearch.ts`, `useSearch.test.tsx`, `SearchPalette.tsx`, `SearchPalette.test.tsx`, `SearchResults.tsx`, `src/features/search/query.ts`, `query.test.ts`
- Modificar: `src/features/shell/Header.tsx`, para abrir a paleta

**Interfaces:**
- Consome: `searchMulti`, `PosterCard`, `mediaHref` e `personHref`.
- Produz:
  - `normalizeQuery(q: string | null | undefined): string | null`. `trim`, colapsa espaços e devolve `null` com menos de 2 caracteres ou mais de 100.
  - `useSearch(query: string, opts?: { debounceMs?: number }): { results: SearchItem[]; status: 'idle' | 'loading' | 'success' | 'error'; isFetching: boolean }`. Debounce de 250 ms, `AbortController` via `signal` do TanStack Query e `enabled` só com query normalizada.
  - `SearchPalette()`: um `<dialog>` aberto por `Ctrl/Cmd+K`, `/` ou pelo botão do Header. Tem o combobox ARIA (input `role="combobox"`, lista `role="listbox"`), navegação com ↑/↓ e Enter, até 8 resultados agrupados (Filmes, Séries, Pessoas) e "Ver todos os resultados" (Enter sem seleção vai para `/buscar?q=`).
  - `GET /api/search?q=&page=` → `Paginated<SearchItem>`. Com query inválida, responde 200 `{ page: 1, totalPages: 0, totalResults: 0, results: [] }`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
expect(normalizeQuery('   ')).toBeNull();
expect(normalizeQuery('a')).toBeNull();
expect(normalizeQuery('  coração   selvagem ')).toBe('coração selvagem');
```

```tsx
// useSearch.test.tsx (MSW em /api/search, timers falsos)
// digitar "ma", "mat", "matr" e "matrix" em menos de 250 ms gera 1 request, com q=matrix
// "a&b" gera a request com q=a%26b
// "  " não gera request

// SearchPalette.test.tsx
await user.keyboard('{Control>}k{/Control}');
expect(screen.getByRole('combobox', { name: 'Buscar filmes, séries e pessoas' })).toHaveFocus();
await user.type(screen.getByRole('combobox'), 'matrix');
await user.keyboard('{ArrowDown}{Enter}');
expect(push).toHaveBeenCalledWith('/filme/603-matrix');
```

- [ ] **Step 2: Rodar os testes para ver a falha**

Rode: `npx vitest run src/features/search`. Esperado: FAIL.

- [ ] **Step 3: Implementar**

- **`/buscar`**: input grande com `autoFocus` no mobile, sincronizado com `?q=` via `router.replace`.
  - Abas Todos, Filmes, Séries e Pessoas, com filtro no cliente sobre `searchMulti`.
  - Paginação infinita.
  - Estado inicial: "Comece a digitar" mais as buscas recentes, que ficam no `localStorage` (até 8 itens, com botão de limpar e `try/catch`).
  - Estado vazio: "Nada encontrado para "{q}"".

- [ ] **Step 4: Rodar os testes para ver passar**

Rode: `npx vitest run`. Esperado: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: add unified search page, Ctrl+K palette and search API"`

---

### Task 14: Descobrir (filtros na URL)

**Arquivos:**
- Criar: `src/features/discover/filters.ts`, `filters.test.ts`, `FiltersPanel.tsx`, `DiscoverResults.tsx`, `src/app/descobrir/page.tsx`, `src/app/api/discover/route.ts`

**Interfaces:**
- Produz:

```ts
export interface DiscoverFilters {
  media: MediaType;                // ?tipo=filme|serie   (padrão filme)
  genres: number[];                // ?generos=28,12
  yearFrom?: number; yearTo?: number;   // ?de=1990&ate=1999
  minRating?: number;              // ?nota=7.5 (0–10, passo 0.5)
  minVotes?: number;               // ?votos=500
  maxRuntime?: number;             // ?duracao=100 (40–400, passo 5; só filme)
  language?: string;               // ?idioma=ko (ISO 639-1)
  providers: number[];             // ?provedores=8,119 (watch_region=BR)
  sort: DiscoverSort;              // ?ordem=popularidade|nota|lancamento|bilheteria|titulo (padrão popularidade)
}
export function parseFilters(sp: URLSearchParams): DiscoverFilters;
export function filtersToSearchParams(f: DiscoverFilters): URLSearchParams; // omite padrões
export function toTmdbParams(f: DiscoverFilters): TmdbParams;
```
- `toTmdbParams` mapeia assim:
  - Filme: `primary_release_date.gte/.lte` (`${yearFrom}-01-01` e `${yearTo}-12-31`), `with_runtime.lte`, e `sort` → `popularity.desc` | `vote_average.desc` (com `vote_count.gte` mínimo de 200 se não informado) | `primary_release_date.desc` | `revenue.desc` | `title.asc`.
  - Série: `first_air_date.gte/.lte`, sem filtro de duração, `bilheteria` cai para `popularity.desc` e `titulo` vira `name.asc`.
  - Os dois: `with_genres` (genres juntados com `,`), `with_watch_providers` (providers juntados com `|`) com `watch_region=BR`, `vote_average.gte`, `vote_count.gte`, `with_original_language` e `include_adult=false`.
- Produz `GET /api/discover?<mesmos params>&page=N` → `Paginated<MediaSummary>`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
const f = parseFilters(new URLSearchParams('tipo=serie&generos=18,abc&nota=11&de=2030&ate=2020&duracao=90'));
expect(f).toMatchObject({ media: 'tv', genres: [18], minRating: 10 }); // nota limitada a 10, gênero inválido ignorado
expect(f.yearFrom).toBe(2020); expect(f.yearTo).toBe(2030);              // anos invertidos são trocados
expect(toTmdbParams(f)).not.toHaveProperty('with_runtime.lte');          // série ignora duração
expect(filtersToSearchParams(parseFilters(new URLSearchParams(''))).toString()).toBe('');
expect(toTmdbParams(parseFilters(new URLSearchParams('ordem=nota'))))
  .toMatchObject({ sort_by: 'vote_average.desc', 'vote_count.gte': 200 });
// round-trip: parse(filtersToSearchParams(x)) deep-equals x
```

- [ ] **Step 2: Rodar os testes para ver a falha**

Rode: `npx vitest run src/features/discover`. Esperado: FAIL.

- [ ] **Step 3: Implementar a página**

- **Desktop**: barra lateral de filtros fixa e recolhível (estado em `localStorage` com `try/catch`). **Mobile**: botão "Filtros (n)" que abre uma *bottom sheet* em `<dialog>`, com foco preso e fechamento por Esc ou arraste.
- **Controles**:
  - Tipo como segmentado Filme/Série.
  - Gêneros como chips multi-seleção, vindos de `getGenres(media)`.
  - Ano de/até, nota mínima (slider), votos mínimos (select 0/100/500/1000/5000) e duração máxima (slider, só para filmes).
  - Idioma original: Todos, Português, Inglês, Espanhol, Francês, Japonês, Coreano, Italiano, Alemão.
  - Provedores BR: os 12 de maior prioridade de `getWatchProviderCatalog`, com logos.
  - Ordenação.
- **Comportamento**: aplicar atualiza a URL (`router.replace`, sem empilhar histórico), e os resultados aparecem em `<MediaGrid endpoint={`/api/discover?${filtersToSearchParams(f)}`} key={...} />`. A `key` muda com os filtros, para reiniciar a paginação. Há um chip removível por filtro ativo e um "Limpar tudo".

- [ ] **Step 4: Rodar os testes para ver passar**

Rode: `npx vitest run`. Esperado: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: add discover page with URL-synced filters for movies and series"`

---

### Task 15: Gêneros, metadados, imagens de compartilhamento e manifesto PWA

**Arquivos:**
- Criar:
  - `src/app/generos/page.tsx`, `src/app/genero/[tipo]/[slug]/page.tsx`
  - `src/app/filme/[slug]/opengraph-image.tsx`, `src/app/serie/[slug]/opengraph-image.tsx`, `src/app/pessoa/[slug]/opengraph-image.tsx`, `src/features/share/og.tsx`
  - `src/app/manifest.ts`, `src/app/manifest.test.ts`, `src/app/icons/[variant]/route.tsx`, `src/app/icon.svg`, `src/app/apple-icon.tsx`
  - `src/assets/fonts/InstrumentSerif-Regular.ttf`, `InstrumentSerif-Italic.ttf`, `InterTight-Medium.ttf`

**Interfaces:**
- Consome: `getGenres`, `discover`, os detalhes, `splitAccent`, `formatRating` e `tmdbImage`.
- Produz:
  - `ogCard({ title: string; subtitle: string; rating: number | null; backdrop: string | null; poster: string | null }): ImageResponse`. Tamanho 1200×630, fundo `ink-950`, backdrop à direita com degradê, pôster, título em Instrument Serif com o accent em itálico âmbar, anel de nota desenhado com SVG e o Wordmark no canto.
  - `manifest()`: `name: 'TelaViva'`, `short_name: 'TelaViva'`, `lang: 'pt-BR'`, `start_url: '/'`, `display: 'standalone'`, `background_color` e `theme_color` `#0c0a08`, ícones `/icons/192`, `/icons/512` e `/icons/maskable` (PNG via `ImageResponse`: "T" em Instrument Serif âmbar sobre `ink-950`, com o maskable usando 20% de margem segura).

- [ ] **Step 1: Escrever o teste do manifesto que falha**

```ts
const m = manifest();
expect(m).toMatchObject({ lang: 'pt-BR', display: 'standalone', theme_color: '#0c0a08' });
expect(m.icons?.map((i) => i.sizes)).toEqual(['192x192', '512x512', '512x512']);
expect(m.icons?.[2].purpose).toBe('maskable');
```

- [ ] **Step 2: Rodar o teste para ver a falha**

Rode: `npx vitest run src/app/manifest.test.ts`. Esperado: FAIL.

- [ ] **Step 3: Implementar**

- **`/generos`**: abas Filmes e Séries com uma grade de cards por gênero. O backdrop de cada card é o título mais popular do gênero (`discover`), com o nome em `font-display`.
- **`/genero/[tipo]/[slug]`**: `tipo` precisa ser `filme` ou `serie`, senão `notFound()`, e o slug canônico usa o nome do gênero. Mostra o `MediaGrid` do `/api/discover` com `generos=<id>`.
- **Imagens OG**: seguem o padrão do App Router com `export const size`, `contentType` e `alt` (por exemplo, `Clube da Luta no TelaViva`).
- **Metadados**: confira se toda página tem `generateMetadata` com `title`, `description`, `alternates.canonical` e `openGraph`, com `type` `video.movie`, `video.tv_show` ou `profile`.

- [ ] **Step 4: Verificar**

Rode: `npx vitest run`. Depois, `npm run build && npm start` e abra `/filme/550-clube-da-luta/opengraph-image`. Esperado: o teste passa e a imagem 1200×630 aparece na identidade visual.

- [ ] **Step 5: Commit**

`git commit -m "feat: add genres pages, per-title share images and PWA manifest"`

---

### Task 16: E2E, acessibilidade e preview na Vercel

**Arquivos:**
- Criar: `e2e/mock-tmdb.ts`, `e2e/fixtures.ts`, `e2e/navigation.spec.ts`, `e2e/detail.spec.ts`, `e2e/search.spec.ts`, `e2e/discover.spec.ts`, `e2e/a11y.spec.ts`, `e2e/assets/poster.jpg`
- Modificar: `.github/workflows/ci.yml` (acrescentar `npx playwright install --with-deps chromium` e `npm run e2e` antes do build)

**Interfaces:**
- Consome: as fixtures de `src/test/fixtures/` e as rotas das Tasks 8 a 15.
- Produz:
  - `e2e/mock-tmdb.ts`: servidor `node:http` na porta 4010 que mapeia `GET /3/<path>` para as fixtures. Variações de id e página caem na fixture mais próxima, e path desconhecido responde 404 `{ status_message: 'not found' }`. `/3/movie/999999999` devolve 404.
  - Fixture Playwright `test` em `e2e/fixtures.ts`, que intercepta `https://image.tmdb.org/**` e `https://i.ytimg.com/**` servindo `e2e/assets/poster.jpg`.

- [ ] **Step 1: Escrever os specs**

- `navigation.spec.ts`:
  - **desktop:** home com `h1` do destaque e pelo menos 6 regiões de trilho; nenhum título repetido entre trilhos (coletar os `href`s de `section[aria-label] a[href^="/filme/"], …`); clicar em Séries no header vai para `/series`.
  - **mobile:** a TabBar está visível e o header não mostra os links.
  - **404:** uma rota v1 como `/popular-movies` mostra "Cena perdida".
- `detail.spec.ts`:
  - `/filme/550` redireciona para `/filme/550-clube-da-luta`, com o `h1` contendo "Clube da Luta", a seção "Onde assistir" e o crédito do JustWatch.
  - `/filme/999999999-x` → 404.
  - `/serie/1399-...?temporada=1` lista episódios.
  - Trocar de temporada atualiza a URL sem rolar para o topo.
- `search.spec.ts`:
  - **desktop:** `Control+K`, digitar "matrix", ↓ e Enter abre o detalhe.
  - **mobile:** a aba Buscar leva ao input focado. Digitar "  " não mostra o carregamento.
- `discover.spec.ts`: escolher Série e um gênero e aplicar atualiza a URL com `tipo=serie&generos=`. Recarregar mantém os chips.
- `a11y.spec.ts`: `AxeBuilder` com `withTags(['wcag2a', 'wcag2aa'])` em `/`, `/filme/550-clube-da-luta`, `/serie/1399-…`, `/buscar` e `/descobrir`, esperando `violations` igual a `[]`.

- [ ] **Step 2: Rodar o E2E**

Rode: `npm run e2e`. Esperado: todos passam nos projetos desktop e mobile.
Se o axe acusar contraste, ajuste os **tokens** (nunca o componente) e rode de novo.

- [ ] **Step 3: Verificação completa**

Rode: `npm run check && npm run e2e`. Esperado: tudo verde.

- [ ] **Step 4: Commit**

`git commit -m "test: add e2e and accessibility suites with mocked TMDb"`

- [ ] **Step 5: Publicar o preview (requer aprovação do autor antes de cada passo externo)**

1. Peça ao autor para cadastrar `TMDB_READ_TOKEN` nas variáveis de ambiente do projeto Vercel, **somente no ambiente Preview**, e `NEXT_PUBLIC_SITE_URL` com o alias da branch.
2. Com aprovação, rode `git push -u origin v2` e `git push origin v1` (a tag).
3. Acompanhe o deploy de preview, confira o link no celular e no desktop e envie o link ao autor.

Esperado: o preview funcionando e a produção (`main`) intacta.

---

## Autorrevisão (feita)

- **Cobertura do spec para esta fase:**
  - Identidade → T3, T4 e T9.
  - TMDb no servidor com Bearer e cache → T5 e T6.
  - Rotas pt-BR e 404 sem URLs da v1 → T8, T10 e T16.
  - Filmes e séries → T6, T10 e T11.
  - Pessoa → T12. Busca → T13. Descobrir → T14.
  - Gêneros, prévias de link e PWA (manifesto) → T15.
  - Atribuição TMDb e JustWatch → T8 e T10.
  - Acessibilidade → T16. CI → T1 e T16.
  - Ficam para outras fases: listas, episódios marcáveis, nota pessoal, recomendações, "Continue assistindo" (fase 2); login, banco e conta/LGPD (fase 3); modo offline do PWA, README e guias, troca de produção (fase 4).
- **Consistência de tipos:** `MediaSummary`, `Paginated`, `SearchItem` e `TmdbParams` (T5), `TvDetails`/`SeasonDetails`/`EpisodeSummary` (T6), `CatalogListId` e `MediaGrid({ endpoint })` (T7) e `DiscoverFilters` (T14) são definidos uma vez e reutilizados com os mesmos nomes. `discover()` recebe `TmdbParams`, sem depender da T14.
