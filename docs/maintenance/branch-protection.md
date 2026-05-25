# Branch Protection Baseline

This repository uses CI and templates. For full governance, configure branch protection on `main` in GitHub settings.

## Recommended rules for `main`
- Require a pull request before merging
- Require at least 1 approval
- Dismiss stale approvals when new commits are pushed
- Require review from code owners
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Include administrators
- Restrict direct pushes to `main`

## Required status checks
- `quality` (from workflow `CI`)

## Why this matters
- Prevents direct unreviewed changes
- Enforces lint, tests, coverage gate, and build on every PR
- Creates a stable default for long-term maintenance
