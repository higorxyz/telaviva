# Pull Request Workflow

## Before opening a PR
1. Sync branch with latest `main`
2. Run quality checks locally:

```bash
npm run check
```

## Opening a PR
1. Use the PR template
2. Link related issue(s)
3. Provide screenshots/video for UI changes
4. Explain risk and rollback strategy for non-trivial changes

## Review and merge policy
- At least one reviewer approval required
- CI must be green (`quality` check)
- No unresolved review comments
