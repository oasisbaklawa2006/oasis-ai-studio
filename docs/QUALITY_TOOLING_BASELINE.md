# Oasis AI Studio quality-tooling baseline

This branch adds quality controls without changing the immutable recovery checkpoint at
`7288574278524029ed8d5f88f04a4cd387e45140`.

## Active without external accounts

- **CodeQL:** JavaScript/TypeScript data-flow and security analysis on PRs and `main`.
- **Semgrep Community:** OWASP, TypeScript and secrets rules. Advisory until findings are triaged.
- **Trivy:** filesystem/dependency SARIF; unresolved critical findings block.
- **Dependabot:** weekly grouped npm and GitHub Actions updates.
- **Super-Linter:** changed-file validation for Actions, JSON, Markdown, TypeScript/TSX and YAML.
- **Reviewdog:** ESLint comments on newly added PR lines; existing lint debt does not block unrelated work.
- **Biome:** fast local formatter/linter migration path. It does not replace ESLint yet.
- **Knip:** dead files, exports and dependencies inventory. Existing findings are a debt report, not auto-deletion authority.
- **Vitest V8 coverage:** text, JSON summary and HTML coverage reports.
- **Playwright:** manual read-only smoke workflow. `PRODUCT_AUTHORING_SAVE` is fixed to `0`.

## Configured but not active without owner infrastructure

- **SonarQube Community:** repository configuration and workflow are present. The job runs only after
  `SONAR_HOST_URL` (repository variable) and `SONAR_TOKEN` (secret) are configured. Community Edition
  does not provide every commercial PR-decoration feature.
- **Qodo PR-Agent:** not installed. It needs an LLM/API key or hosted service and therefore is not
  zero-cost or zero-administration by default.
- **Vercel Agent Code Review / Toolbar:** account-level Vercel features, not safely activated by a
  repository commit. Enable only after confirming account availability and pricing.

## Quality policy

1. Existing debt is recorded, never hidden by blanket disables.
2. New critical vulnerabilities, changed-line ESLint errors, failed tests, failed build, boundary
   violations and whitespace corruption block a PR.
3. Semgrep, Knip and full-repository Biome findings start as advisory inventories and become blocking
   only after their baselines are reviewed.
4. Tools may report problems but may not automatically rewrite application code, migrations or the
   production database.
5. Production Supabase remains read-only during code-quality verification.

## First measured baseline

- Reproducible install: 553 packages.
- Unit/contract suite: 86 files and 662 tests passed.
- V8 coverage: 30.69% statements/lines, 71.91% branches and 62.43% functions.
- Dependency audit: reduced from 19 findings (including 2 critical) to 2 development-server
  findings (1 high, 1 moderate, 0 critical) without `--force` or a major-version upgrade.
- Knip inventory: 13 unused files, 145 unused exports, 39 unused exported types, 26 dependency
  candidates, 3 duplicate exports and 2 unresolved imports across 96 files. These require human
  classification before removal.
- Biome inventory: 580 errors, 123 warnings and 64 informational findings across the existing tree.
  This is migration debt; Biome is not allowed to rewrite the repository automatically.
- Existing full-build TypeScript debt remains separate: `tsc -b --force` reports 128 errors across
  37 files, while the application gate `tsc --noEmit` passes.

## Local commands

```bash
npm ci
npm run quality:local
npm run lint:biome
npm run quality:dead-code
```
