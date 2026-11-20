# Vitest 4 coverage measurement migration — 21 November 2026

## Scope

AI Studio PR #296 upgrades Vite and Vitest, retaining the same full-source coverage `include` / `exclude` rules and the 180 existing test files. The application code on the comparison branches is unchanged; the migration's functional test suite passes all **1,597 tests** before and after the test-runner upgrade.

Vitest documents coverage-report changes from v3 to v4 due to improved V8 coverage remapping: [Vitest 4 migration guide](https://v4.vitest.dev/guide/migration.html)

## Exact evidence

| Metric | Pre-upgrade protected main `b54da43ac2868a1d465ec2a377154abb5348eda7` (Vitest 3) | PR #296 `760a21f4f53a66c347a20397a3841a0f8c1193cd` (Vitest 4) |
| --- | ---: | ---: |
| Test files | 180 passing | 180 passing |
| Tests | 1,597 passing | 1,597 passing |
| Statements | 49.16% | 45.89% |
| Branches | 77.53% | 42.85% |
| Functions | 76.97% | 43.65% |
| Lines | 49.16% | 46.92% |

GitHub Actions evidence:
- Vitest 3: [baseline test job](https://github.com/oasisbaklawa2006/oasis-ai-studio/actions/jobs/136544159688)
- Vitest 4: [migrated test job](https://github.com/oasisbaklawa2006/oasis-ai-studio/actions/jobs/136621560272)

The Vitest 4 coverage reports are **not directly numerically comparable** to the old thresholds. Keeping the old floors caused an artificial red gate despite the same tests passing; reducing or excluding measured source files would be a misleading repair.

## Retained quality bar and conservative ratchet

The existing `statements: 30` and `lines: 30` floors remain intact. The new Vitest 4 floors are `branches: 40`, `functions: 40` measured across the **same full-source inclusion scope**.

Relative to each runner's measured 1,597-test baseline:
- **Branches:** old floor 70/77.53 = 90.29% of baseline; new 40/42.85 = **93.35%** of baseline.
- **Functions:** old floor 60/76.97 = 77.95% of baseline; new 40/43.65 = **91.64%** of baseline.

Thus the new floors allow **less relative coverage regression** than the old floors. These version-specific floors are not a claim that untested pages or code are covered. Coverage must be increased with new tests; do not remove the current source coverage patterns or bypass the check.

## Remaining gates

Require exact-head TypeScript, 1,597+ tests, full-source coverage, build, all security scans and CodeRabbit/Codacy review; seek independent reviewer approval. A green CI run is source evidence, not authenticated preview or production certification.
