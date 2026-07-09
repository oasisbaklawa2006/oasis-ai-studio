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
# 2. Supabase migrations/functions/DDL: this repo does not own schema.
#    Pre-existing legacy content (predating the ownership split) is reported
#    as a warning only — see docs/repo-ownership-guardrails.md. Only NEW
#    migration files, new Edge Function files, or newly added DDL statements
#    are hard failures, since that is what actually reintroduces schema
#    ownership going forward. Untracked new files are checked unconditionally
#    (no base ref needed); committed/staged additions and DDL diffs are
#    checked against the base branch when it can be resolved.
# ---------------------------------------------------------------------------
DDL_PATTERNS=(
  "CREATE TABLE"
  "ALTER TABLE"
  "DROP TABLE"
  "CREATE POLICY"
  "ALTER POLICY"
  "ENABLE ROW LEVEL SECURITY"
  "CREATE FUNCTION"
  "CREATE TRIGGER"
)

BASE_REF="${BOUNDARY_BASE_REF:-origin/main}"
HAVE_BASE=0
if git rev-parse --verify --quiet "${BASE_REF}" >/dev/null 2>&1; then
  HAVE_BASE=1
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

  # DDL patterns newly added (as +lines) anywhere under supabase/, including edits to existing
  # tracked files — committed since base, or still staged/unstaged locally.
  ddl_diff="$(git diff --unified=0 "${BASE_REF}" -- supabase 2>/dev/null | grep -E '^\+[^+]' || true)"
  if [ -n "$ddl_diff" ]; then
    for pattern in "${DDL_PATTERNS[@]}"; do
      hit="$(echo "$ddl_diff" | grep -F -- "$pattern" || true)"
      if [ -n "$hit" ]; then
        echo "BOUNDARY VIOLATION: newly added DDL pattern \"$pattern\" under supabase/ — schema authority belongs to oasis-supabase-core:"
        echo "$hit" | sed 's/^/  /'
        violations=$((violations + 1))
      fi
    done
  fi
else
  echo "NOTE: base ref \"${BASE_REF}\" not available — skipping tracked-file diff/DDL checks (nothing to compare against). Untracked-file checks above still ran."
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
