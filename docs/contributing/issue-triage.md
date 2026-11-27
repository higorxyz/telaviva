# Triagem de issues

## Labels

- `bug`, `enhancement`: o tipo (os templates já aplicam).
- `needs-triage`: ainda não avaliada (aplicada pelos templates).
- `dependencies`, `ci`: PRs do Dependabot.
- `severity:blocker`, `severity:major`, `severity:minor`: gravidade, depois da triagem.

## Fluxo

1. **Reproduzir.** Anote aparelho (celular ou desktop), navegador, se a pessoa estava logada ou como visitante e se
   estava offline. Problemas que somem num recarregamento completo podem ser cache do service worker.
2. **Classificar** a gravidade e a área (catálogo, detalhe, busca, Minha lista, conta e login, offline, CI).
3. **Definir o critério de aceite**: o que precisa acontecer para a issue estar resolvida.
4. **Ligar** issues e PRs relacionados e tirar o `needs-triage`.
5. **Priorizar.** Bugs de quem usa no dia a dia vêm antes de melhorias.

## Gravidade

- **blocker:** quebra um fluxo principal em produção (abrir o site, a Minha lista, entrar, marcar episódio) ou perde ou
  vaza dados de alguém. Considere o botão de emergência do service worker ou o rollback da Vercel
  ([configuracao.md](../setup/configuracao.md#7-lançamento-e-operação-em-produção)).
- **major:** um recurso quebrado com alternativa, ou com impacto alto.
- **minor:** baixo impacto, visual ou caso raro.

## Segurança

Falhas de segurança não vão em issue pública: avise o mantenedor em particular. Nunca peça nem cole valores de
variáveis de ambiente numa issue; a saída de `npm run env:check` (só nomes) pode ser colada.
