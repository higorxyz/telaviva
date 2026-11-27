# Auditoria de segurança, acessibilidade e SEO — Fase 4 (novembro de 2026)

Registro da Task 10 do plano da Fase 4 (spec §6.6 e §8): cabeçalhos de segurança e CSP, dependências, revisão de
segurança das rotas novas, teclado, contraste, axe, `robots.txt`, `sitemap.xml` e o formulário de reautenticação.

## Cabeçalhos de segurança

Em `next.config.ts` (`headers()`, valores em `src/lib/security-headers.ts`), com o `withSerwist` e o proxy `/__/auth`
como estavam:

| Cabeçalho                 | Valor                                         | Onde                        |
| ------------------------- | --------------------------------------------- | --------------------------- |
| `X-Content-Type-Options`  | `nosniff`                                     | tudo                        |
| `Referrer-Policy`         | `strict-origin-when-cross-origin`             | tudo                        |
| `Permissions-Policy`      | `camera=(), microphone=(), geolocation=()`    | tudo                        |
| `X-Frame-Options`         | `DENY`                                        | tudo, menos `/__/auth/*`    |
| `Content-Security-Policy` | lista abaixo (com `frame-ancestors 'none'`)   | tudo, menos `/__/auth/*`    |

- **`/__/auth/*` fica de fora do bloqueio de moldura e da CSP.** Em produção o `authDomain` é o próprio site (o proxy), e o
  SDK do Firebase carrega `/__/auth/iframe` num iframe escondido desta mesma origem: `DENY` quebraria o login. Essas
  páginas são do Firebase, com scripts próprios que a CSP do site não descreve. Conferido: `/__/auth/iframe` responde 200
  sem `X-Frame-Options` nem CSP, com `nosniff`.
- **Service worker:** `/serwist/sw.js` continua com `Service-Worker-Allowed: /` (posto pela rota do Serwist; nenhum
  cabeçalho do config o sobrescreve). Coberto em `e2e/security-seo.spec.ts`.
- **YouTube:** o site emoldura o player (`frame-src`); `DENY` só impede que outros sites emoldurem o TelaViva.

### CSP: aplicada (não só relatada)

```
default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://image.tmdb.org https://i.ytimg.com https://*.googleusercontent.com; font-src 'self';
connect-src 'self' https://*.googleapis.com https://apis.google.com https://image.tmdb.org https://i.ytimg.com;
frame-src 'self' https://www.youtube-nocookie.com https://<projeto>.firebaseapp.com; worker-src 'self';
manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

- **Sem nonce nem hash.** Nonce obriga toda página a renderizar por requisição (perde o prerender e o Cache Components);
  os scripts inline que o Next escreve nas páginas estáticas mudam a cada build, então hash também não serve. Por isso
  `script-src` mantém `'unsafe-inline'`: a CSP não barra um XSS inline, mas barra carregar, conectar, emoldurar ou enviar
  formulário para qualquer host fora da lista, e proíbe `eval`, plugins e `<base>` estrangeiro.
- `https://<projeto>.firebaseapp.com` entra porque, em `localhost`, o `authDomain` vira o host do Firebase
  (`src/lib/auth-config.ts`). No build do E2E, o host do emulador (`http://127.0.0.1:9099`) entra em `connect-src` e
  `frame-src`, só quando `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST` existe. Em desenvolvimento entra `'unsafe-eval'`
  (React precisa dele no `next dev`).
- **Como foi verificada (Report-Only primeiro).** A política foi enviada como `Content-Security-Policy-Report-Only` com
  um `report-uri` temporário para um coletor local, removido antes do commit:
  1. **Suíte E2E inteira** (122 testes, desktop e celular, com o service worker nos testes offline): 403 relatórios, de
     três causas:
     - `eval` em `_next/static/chunks/…js`: o Zod 4 testa `Function('')` para compilar validadores mais rápidos (e, se
       consegue, compila). Com a CSP aplicada o teste falharia em silêncio e o Zod usaria o caminho interpretado, mas
       cada página deixaria um erro de CSP no console. Correção: `src/lib/zod-jitless.ts` liga `jitless` no navegador
       (importado primeiro por `src/app/providers.tsx`); o servidor, sem CSP, segue com o caminho rápido.
     - `frame-src http://127.0.0.1:9099`: o iframe do emulador (só E2E). Entrou no `frame-src` do build do E2E.
     - `connect-src https://apis.google.com/js/gen_204`: telemetria do `gapi`. `apis.google.com` entrou em `connect-src`.
  2. **Build real** (`npm run build` + `npx next start -p 3001`, `.env.local` real, service worker ligado), percorrido
     no Playwright: início, SW instalado e página recarregada, filme com o trailer aberto (iframe do YouTube tocando),
     série, Descobrir, Gêneros, Filmes, Minha lista, Buscar com digitação, `/entrar` com clique em "Continuar com Google"
     até o popup abrir em `https://<projeto>.firebaseapp.com/__/auth/handler`, `/conta` como visitante, a página
     offline e uma navegação sem rede que cai em "Sem conexão". **Zero relatórios e zero mensagens de CSP no console.**
  3. Com a política final aplicada, a suíte E2E inteira passa de novo (ver "Testes").
- **Não verificado:** o login Google completo (precisa da conta do autor). O popup e o iframe do handler são páginas do
  Firebase (fora da CSP do site em produção, outra origem em `localhost`); o que volta para a página é `postMessage` e
  chamadas a `*.googleapis.com`, já liberadas. **Ao lançar, conferir o login Google em produção com o console aberto.**
  Também ficam de fora os previews da Vercel com a barra de comentários (`vercel.live`): a CSP a bloqueia; só preview.

## Dependências (`npm audit --omit=dev`)

Antes: 17 vulnerabilidades (7 altas, 10 moderadas). Depois: **0 altas, 0 críticas**, 12 moderadas.

- **Altas corrigidas** com `overrides` fixados em `package.json` (versões publicadas há mais de duas semanas):
  - `zod@4.6.5` aninhado no `@serwist/build`/`@serwist/turbopack` (GHSA-mrhx-c7xc-m3w5) → `4.6.7`, a mesma versão do
    projeto. A correção oficial é o `@serwist/turbopack@9.6.0`, publicado em 25/11/2026, novo demais.
  - `@grpc/grpc-js@~1.9` do `@firebase/firestore` (GHSA-m9gg-hp2v-232j e outras) → `1.14.7`. O app nunca importa o
    Firestore (só `firebase/app` e `firebase/auth`), e o grpc é a versão Node dele; a correção que o npm sugere é voltar
    para `firebase@9.14.0`.
- **Moderadas que ficam:** `uuid`/`gaxios`/`google-gax`/`teeny-request`/`retry-request` via `firebase-admin` → Firestore
  e Storage do Google Cloud, que o servidor não usa (só `firebase-admin/app` e `/auth`); a correção é `firebase-admin@14`
  (major). `glob`/`minimatch` via `@serwist/build`, que só rodam no build sobre padrões do próprio projeto.

## Revisão de segurança (Fase 4)

Rodada a revisão `security-review` sobre a fila offline e o servidor (`POST /api/library/commands` com `at` e
`commandId`, `src/server/library/{store,applied,removals,clamp}.ts`, `src/features/offline/store.ts`) e os cabeçalhos.
**Nenhum achado de confiança alta.** O que foi conferido:

- Todo SQL novo é parametrizado (Drizzle `sql\`\``); os dois `sql.raw` usam só constantes do código.
- Marcas de remoção e ids aplicados ficam por usuário (chave `(user_id, command_id)`; todo `where` filtra por
  `user_id`): um `commandId` de outra conta não bloqueia nem revela nada.
- `at` vem do cliente, mas é limitado a `now` (nunca no futuro, o que congelaria linhas) e recusado com mais de 30 dias;
  só muda a biblioteca do próprio usuário. O envelope tem 64 KiB no máximo e passa pelo schema Zod.
- A fila do aparelho guarda comandos por `uid` e revalida cada um com o schema ao ler; a conta seguinte no aparelho não
  envia a fila da anterior (E2E `offline-account.spec.ts`).

## Acessibilidade

### axe (WCAG 2 A/AA)

Coberto no E2E: `/entrar` (as duas abas), `/conta` logado e com o diálogo de exclusão aberto (`e2e/auth.spec.ts`), a
página "Sem conexão" e o indicador offline visível (`e2e/offline.spec.ts`), além das páginas de catálogo, Minha lista e o
painel de nota (`e2e/a11y.spec.ts`). Todos sem violações.

### Teclado

Passada real com o teclado no Playwright, que virou teste: `e2e/keyboard.spec.ts` (desktop). Cada controle é alcançado
só com Tab, precisa mostrar o anel de foco e funciona com Enter ou Espaço.

| Fluxo                                                        | Resultado                    |
| ------------------------------------------------------------ | ---------------------------- |
| "Pular para o conteúdo" é a primeira parada e pula o cabeçalho | ok                         |
| Abrir um título a partir do início                           | ok                           |
| Adicionar ("Quero ver")                                      | ok                           |
| Nota: abrir, Esc devolve o foco, setas/End, Espaço escolhe   | ok                           |
| Marcar episódio                                              | ok                           |
| Entrar (e-mail e senha)                                      | **falhou → corrigido**       |
| Excluir conta: abrir, Esc devolve o foco, digitar EXCLUIR, Enter | ok                       |
| Indicador offline                                            | não focável (é `status`), anunciado pelo leitor de tela |

- **Achado:** os campos de formulário (`src/features/auth/form-ui.tsx`: entrar, criar conta, senha da reautenticação)
  não mostravam o anel âmbar de foco. A classe `focus:outline-none` zerava `--tw-outline-style`, e o
  `focus-visible:outline-2` herdava `none`; só a borda mudava de cor. Removida, o anel de 2 px aparece como no resto do
  site.
- Os campos de busca (`/buscar` e a paleta) usam só a borda âmbar (ou o cursor, na paleta, que é o único campo do
  diálogo) como indicador; ficou assim por desenho.

### Contraste

Calculado a partir dos tokens de `src/app/globals.css` (fórmula WCAG 2.x). AA pede 4,5:1 para texto normal.

| Texto \ fundo  | ink-950 | ink-900 | ink-800 | ink-700 | ink-600 |
| -------------- | ------- | ------- | ------- | ------- | ------- |
| `amber`        | 10,30   | 9,80    | 9,09    | 8,08    | 6,64    |
| `amber-strong` | 12,47   | 11,85   | 11,00   | 9,77    | 8,03    |
| `ivory-muted`  | 8,51    | 8,10    | 7,51    | 6,67    | 5,48    |
| `ivory`        | 16,98   | 16,15   | 14,98   | 13,31   | 10,94   |

Tudo passa AA (e AAA, 7:1, sobre ink-950/900/800). `ink-950` sobre `amber` (botão primário): 10,30. Nenhum token mudou.

## SEO

- `src/app/robots.ts`: libera tudo menos `/conta`, `/entrar`, `/api/` e `/serwist/`; aponta o sitemap em `SITE_URL`.
- `src/app/sitemap.ts`: `/`, `/filmes`, `/series`, `/descobrir`, `/generos`, as listas de `/filmes/[lista]` e
  `/series/[lista]` e todas as páginas de gênero (das mesmas listas em cache que prerenderizam essas páginas). Sem páginas
  de título, conta, busca ou Minha lista. Os dois saem estáticos no build (`○ /robots.txt`, `○ /sitemap.xml`, revalida
  semanalmente como as listas de gênero).
- Conta, entrar, busca e offline continuam `noindex`.

## Pendências da Fase 3

- **Reautenticação:** o formulário de senha de "Excluir minha conta" ganhou `<input type="email" autocomplete="username"
  hidden>` com o e-mail da conta, no mesmo `<form>` da senha (`autocomplete="current-password"`), para gerenciadores de
  senha. Fora da árvore de acessibilidade e do Tab.
- **Firewall da Vercel** (`/api/recommendations`, `/api/tv/*`, login): proposta no plano, aplicar só com aprovação do
  autor. Não feito aqui.
- **Lembrete ao autor:** `!.env.example` no `.gitignore` (alteração dele, sem commit).

## Testes

- `npm test`: 192 arquivos, 1.620 testes, todos passando. Novos: `src/app/robots.test.ts`, `src/app/sitemap.test.ts`,
  `src/lib/security-headers.test.ts`, `src/lib/zod-jitless.test.ts`, `src/features/auth/ReauthStep.test.tsx` e os
  cabeçalhos em `src/features/auth/next-config.test.ts` (as regras passam pelo mesmo casamento de caminhos do Next).
- `npm run e2e` com a CSP aplicada: 126 passando, 14 pulados (os de teclado no celular entre eles). Novos:
  `e2e/security-seo.spec.ts` (cabeçalhos de `/`, escopo do service worker, `robots.txt`, `sitemap.xml`) e
  `e2e/keyboard.spec.ts`.
- `npm run lint`, `npm run typecheck` e `npm run build` sem erros nem avisos.
