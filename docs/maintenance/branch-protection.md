# Proteção da branch `main`

A `main` é o que está no ar em `telaviva.vercel.app`: cada merge nela vira um deploy de produção. Configure a proteção
em **GitHub → Settings → Branches** (ou **Rules → Rulesets**) para a `main`.

## Regras recomendadas

- Exigir pull request antes do merge.
- Exigir revisão do dono do código (`.github/CODEOWNERS`).
- Descartar aprovações antigas quando chegam commits novos.
- Exigir que os status checks passem antes do merge.
- Exigir que a branch esteja atualizada com a `main`.
- Incluir administradores e bloquear push direto na `main`.

## Status check obrigatório

| Check (nome exato)                     | Workflow | Job       |
| -------------------------------------- | -------- | --------- |
| `Lint, Typecheck, Test, Build and E2E` | `CI`     | `quality` |

**O nome precisa ser exatamente o do campo `name:` do job em `.github/workflows/ci.yml`.** O GitHub identifica o check
pelo nome do job, não pelo id (`quality`). Se o nome do job mudar, atualize a regra no mesmo PR; senão a regra fica
esperando um check que nunca chega e bloqueia todos os merges. O check só aparece na busca das configurações depois de
rodar pelo menos uma vez.

Esse job roda lint, typecheck, testes unitários e o `npm run e2e` (build de produção, Playwright no desktop e no celular,
axe e offline, com o emulador do Firebase Auth e PGlite). Ele não precisa de nenhum segredo: nada do CI usa as contas
reais.

## Por quê

- Nada entra em produção sem revisão e sem o CI verde.
- Testes, acessibilidade e o build de produção rodam em todo PR.
- O Dependabot (`.github/dependabot.yml`) abre PRs semanais de npm e GitHub Actions, que passam pelo mesmo check.
