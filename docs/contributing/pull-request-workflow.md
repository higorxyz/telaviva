# Fluxo de pull request

## Branch

1. Parta da `main` atualizada: `git switch main && git pull`.
2. Crie uma branch curta com o tipo da mudança: `feat/nota-pessoal`, `fix/foco-formulario`, `docs/readme`.
3. Uma branch por assunto. Mudanças longas (como a v2) podem viver numa branch própria por mais tempo, sempre com o CI
   verde.

## Commits

- Em inglês, no formato `tipo: descrição` no imperativo e em minúsculas:
  `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:` (o Dependabot usa `chore(deps):`).
- Pequenos e com um assunto só: `fix: show the focus ring on form fields`.
- Nunca commite segredos (`.env.local`, chaves, `DATABASE_URL`). Veja [configuracao.md](../setup/configuracao.md#8-o-que-nunca-fazer).

## Antes de abrir o PR

Rode localmente, com o `.env.local` real:

```bash
npm run lint        # ESLint, sem avisos
npm run typecheck   # TypeScript do app e do service worker
npm test            # Vitest (unidade e componentes; banco em PGlite)
npm run e2e         # build de produção + Playwright (desktop e celular), axe e offline
npm run build       # o build com o seu .env.local
```

`npm run check` roda lint, typecheck, testes e build em sequência. O `npm run e2e` sobe sozinho o emulador do Firebase
Auth, um mock do TMDb e um PGlite; o build dele vai para `.e2e/next` e não toca no `.next`.

Mudou variável de ambiente? Atualize o `.env.example`, as regras em `src/lib/check-env.ts` e o
[guia de configuração](../setup/configuracao.md), e rode `npm run env:check`.

## Abrindo o PR

1. Base: `main`. Use o template (`.github/pull_request_template.md`).
2. Diga o que mudou e por quê, e ligue a issue (`Closes #123`).
3. Mudou a interface? Anexe capturas no celular e no desktop.
4. Mudança arriscada (banco, service worker, login, CSP)? Explique o risco e como voltar atrás. Migrações precisam ser
   compatíveis com o código que está no ar. Cada preview tem o próprio branch do Neon, copiado do banco principal quando é
   criado: depois de uma migração, recrie o branch do preview ([configuracao.md](../setup/configuracao.md#6-migrações-do-banco)).

## Revisão e merge

- O check **`Lint, Typecheck, Test, Build and E2E`** (workflow `CI`) precisa estar verde.
- Revisão do dono do código (`.github/CODEOWNERS`) e nenhum comentário pendente.
- Prefira merge normal (sem squash), para manter os commits pequenos no histórico.
- Cada push na branch gera um preview na Vercel; o merge na `main` publica em `telaviva.vercel.app`.
