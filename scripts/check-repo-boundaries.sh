#!/usr/bin/env bash
# Repo ownership boundary check for oasis-ai-studio.
# Fails if this repo reintroduces Oasis-Baklawa-Central operations app
# ownership, or newly adds Supabase migration/schema/DDL/Edge Function
# ownership that belongs to oasis-supabase-core.
# See docs/repo-ownership-guardrails.md for the ownership split this enforces.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

violations=0
warnings=0

# ---------------------------------------------------------------------------
# 1. Central operations app ownership must never appear in src/.
#    (Reading catalogue_ai_studio_drafts/audit rows via Supabase client/types,
#    or existing WhatsApp/product-intelligence copy, never matches any of
#    these — they are exact Central route/component names, not generic
#    business words.)
# ---------------------------------------------------------------------------
CENTRAL_PATTERNS=(
  "/admin/orders"
  "/admin/finance"
  "/admin/dispatch"
  "/admin/warehouse"
  "/admin/inventory"
  "/admin/production"
  "AdminOrders"
  "AdminFinance"
  "AdminPackingDispatch"
  "DispatchManagement"
  "InventoryCommandCenter"
  "FinanceGovernanceBoard"
)

if [ -d "src" ]; then
  for pattern in "${CENTRAL_PATTERNS[@]}"; do
    matches="$(grep -rIl --fixed-strings -- "$pattern" src 2>/dev/null || true)"
    if [ -n "$matches" ]; then
      echo "BOUNDARY VIOLATION: Central operations ownership pattern \"$pattern\" found in:"
      echo "$matches" | sed 's/^/  /'
      violations=$((violations + 1))
    fi
  done
else
  echo "NOTE: src/ not found — skipping Central ownership scan."
fi

# ---------------------------------------------------------------------------
# 2. Supabase migrations/functions: this repo does not own schema.
#    Pre-existing legacy content (predating the ownership split) is reported
#    as a warning only — see docs/repo-ownership-guardrails.md. Ownership is
#    enforced purely at FILE-IDENTITY level:
#      - a brand new supabase/migrations/*.sql or supabase/functions/** file
#        is always a hard failure (new backend/schema ownership) — whether it
#        arrives untracked, staged, or committed since the base branch.
#      - an edit to an EXISTING (already-tracked-at-base) legacy file is
#        reported as a warning only, never a hard failure.
#    Deliberately NOT implemented: grepping added ("+") diff lines under
#    supabase/ for DDL keywords (CREATE TABLE, ALTER TABLE, CREATE POLICY,
#    etc.). That line-diff approach can't distinguish a genuinely new DDL
#    statement from a reformat / line-ending change / whitespace rewrite of
#    an already-legacy migration — every touched line reappears as a "+"
#    line even when nothing semantically changed, which false-positived on
#    routine legacy-file edits (Bugbot: "Legacy migration reformat triggers
#    DDL"). A correct statement-aware differ would need a real SQL parser to
#    normalize whitespace/line-endings/comments and compare statement
#    signatures between base and HEAD — that complexity/fragility was judged
#    not worth it here. File identity (new vs. pre-existing) is the reliable
#    signal instead: new files are exactly the case that reintroduces schema
#    ownership; edits to legacy files are exactly the case that must stay
#    warning-only per the guardrail's own promise.
# ---------------------------------------------------------------------------

# BOUNDARY_BASE_REF, when set (e.g. by CI — see .github/workflows/repo-boundaries.yml),
# is the correct diff base for this run (the PR base sha, or the pre-push sha) and is
# expected to resolve: if it doesn't, that's a checkout/history problem, not "no base
# available", so we fail loudly rather than silently falling through to a same-commit
# origin/main diff that would report zero new violations no matter what changed.
# When unset (local/dev runs), fall back to origin/main, warning if even that can't
# be resolved — tracked-diff checks are skipped in that case, but the untracked-file
# checks above always ran regardless.
HAVE_BASE=0
if [ -n "${BOUNDARY_BASE_REF:-}" ]; then
  BASE_REF="$BOUNDARY_BASE_REF"
  if git rev-parse --verify --quiet "${BASE_REF}^{commit}" >/dev/null 2>&1; then
    HAVE_BASE=1
  else
    echo "ERROR: BOUNDARY_BASE_REF=\"${BASE_REF}\" was provided but could not be resolved to a commit."
    echo "This usually means the checkout did not fetch enough history (actions/checkout needs fetch-depth: 0) or the base sha is invalid (e.g. a branch-creation push with a null 'before' sha)."
    echo "Failing loudly instead of silently skipping the diff-based boundary checks — see docs/repo-ownership-guardrails.md."
    exit 1
  fi
else
  BASE_REF="origin/main"
  if git rev-parse --verify --quiet "${BASE_REF}^{commit}" >/dev/null 2>&1; then
    HAVE_BASE=1
  fi
fi

if [ -d "supabase/migrations" ]; then
  existing_migrations="$(find supabase/migrations -type f -name '*.sql' 2>/dev/null | sort)"
  if [ -n "$existing_migrations" ]; then
    count="$(echo "$existing_migrations" | wc -l | tr -d ' ')"
    echo "NOTE: supabase/migrations contains $count pre-existing .sql file(s) — legacy content predating the ownership split, not enforced by this check. See docs/repo-ownership-guardrails.md."
    warnings=$((warnings + 1))
  fi
fi

if [ -d "supabase/functions" ]; then
  existing_functions="$(find supabase/functions -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort)"
  if [ -n "$existing_functions" ]; then
    count="$(echo "$existing_functions" | wc -l | tr -d ' ')"
    echo "NOTE: supabase/functions contains $count pre-existing Edge Function(s) — legacy content predating the ownership split, not enforced by this check. See docs/repo-ownership-guardrails.md."
    warnings=$((warnings + 1))
  fi
fi

# Untracked new files under supabase/migrations or supabase/functions — this
# check needs no base ref at all (an untracked file has no history to diff
# against) and must always run, so a missing/unresolvable base ref can never
# let a new schema/function file slip through the local pre-PR gate.
untracked_migrations="$(git ls-files --others --exclude-standard -- supabase/migrations 2>/dev/null | grep -E '\.sql$' || true)"
if [ -n "$untracked_migrations" ]; then
  echo "BOUNDARY VIOLATION: untracked Supabase migration file(s) — schema ownership belongs to oasis-supabase-core:"
  echo "$untracked_migrations" | sed 's/^/  /'
  violations=$((violations + 1))
fi

untracked_functions="$(git ls-files --others --exclude-standard -- supabase/functions 2>/dev/null || true)"
if [ -n "$untracked_functions" ]; then
  echo "BOUNDARY VIOLATION: untracked Supabase Edge Function file(s) — Edge Function ownership belongs to oasis-supabase-core:"
  echo "$untracked_functions" | sed 's/^/  /'
  violations=$((violations + 1))
fi

if [ "$HAVE_BASE" -eq 1 ]; then
  # New migration files committed or staged since the base branch. (Untracked
  # new files are already covered above, independent of base-ref resolution.)
  new_migrations="$(git diff --name-only --diff-filter=A "${BASE_REF}" -- supabase/migrations 2>/dev/null | grep -E '\.sql$' || true)"
  if [ -n "$new_migrations" ]; then
    echo "BOUNDARY VIOLATION: new Supabase migration file(s) added — schema ownership belongs to oasis-supabase-core:"
    echo "$new_migrations" | sed 's/^/  /'
    violations=$((violations + 1))
  fi

  # New Edge Function files committed or staged since the base branch.
  new_functions="$(git diff --name-only --diff-filter=A "${BASE_REF}" -- supabase/functions 2>/dev/null || true)"
  if [ -n "$new_functions" ]; then
    echo "BOUNDARY VIOLATION: new Supabase Edge Function file(s) added — Edge Function ownership belongs to oasis-supabase-core:"
    echo "$new_functions" | sed 's/^/  /'
    violations=$((violations + 1))
  fi

  # Edits to EXISTING legacy migration/function files — warning only, never a
  # hard failure, no matter what content (including DDL keywords) the edit
  # touches. This is what makes a routine legacy-migration reformat pass.
  modified_migrations="$(git diff --name-only --diff-filter=M "${BASE_REF}" -- supabase/migrations 2>/dev/null | grep -E '\.sql$' || true)"
  if [ -n "$modified_migrations" ]; then
    count="$(echo "$modified_migrations" | wc -l | tr -d ' ')"
    echo "NOTE: $count existing legacy supabase/migrations file(s) modified — warning only, not a hard failure (see docs/repo-ownership-guardrails.md):"
    echo "$modified_migrations" | sed 's/^/  /'
    warnings=$((warnings + 1))
  fi

  modified_functions="$(git diff --name-only --diff-filter=M "${BASE_REF}" -- supabase/functions 2>/dev/null || true)"
  if [ -n "$modified_functions" ]; then
    count="$(echo "$modified_functions" | wc -l | tr -d ' ')"
    echo "NOTE: $count existing legacy supabase/functions file(s) modified — warning only, not a hard failure (see docs/repo-ownership-guardrails.md):"
    echo "$modified_functions" | sed 's/^/  /'
    warnings=$((warnings + 1))
  fi
else
  echo "NOTE: base ref \"${BASE_REF}\" not available — skipping tracked-file diff checks (nothing to compare against). Untracked-file checks above still ran."
fi

# ---------------------------------------------------------------------------
if [ "$violations" -gt 0 ]; then
  echo ""
  echo "Repo ownership boundary check FAILED ($violations violation(s), $warnings pre-existing warning(s))."
  echo "See docs/repo-ownership-guardrails.md."
  exit 1
fi

echo ""
echo "Repo ownership boundary check passed ($warnings pre-existing legacy warning(s), 0 new violations)."
