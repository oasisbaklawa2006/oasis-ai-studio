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
#    as a warning only — see docs/repo-ownership-guardrails.md. Ownership is
#    enforced with TWO complementary rules, both keyed off FILE IDENTITY
#    (new vs. already-tracked-at-base), never off diffing an existing file's
#    changed lines:
#      a) Any brand new path under supabase/migrations/*.sql or
#         supabase/functions/** is always a hard failure outright — the
#         location alone is the whole schema/Edge-Function surface, so its
#         mere existence as a new path is the violation. No content check
#         needed or done.
#      b) A brand new *.sql path anywhere ELSE under supabase/ (e.g.
#         supabase/schema/new_table.sql, supabase/seed_schema.sql) is only a
#         hard failure if its content contains a DDL/RLS/backend-ownership
#         statement (DDL_PATTERNS below) — otherwise a stray non-schema .sql
#         file outside migrations isn't itself a boundary violation. Because
#         the whole file is new, this is a plain content grep of the file as
#         it exists now, not a diff — no reformat/line-ending false positive
#         is possible, since there is no "before" version to diff against.
#      Either way, "new" covers untracked, staged, or committed-since-base —
#      see the untracked scan above and the A/C/R/T diff below.
#    An edit to an EXISTING (already-tracked-at-base) file anywhere under
#    supabase/ — including one containing DDL keywords — is reported as a
#    warning only, never a hard failure.
#    Deliberately NOT implemented: grepping added ("+") diff lines of an
#    EXISTING file for DDL keywords. That line-diff approach can't
#    distinguish a genuinely new DDL statement from a reformat / line-ending
#    change / whitespace rewrite of an already-legacy migration — every
#    touched line reappears as a "+" line even when nothing semantically
#    changed, which false-positived on routine legacy-file edits (Bugbot:
#    "Legacy migration reformat triggers DDL"). A correct statement-aware
#    differ would need a real SQL parser to normalize whitespace/line-
#    endings/comments and compare statement signatures between base and
#    HEAD — that complexity/fragility was judged not worth it here. File
#    identity (new vs. pre-existing) is the reliable signal instead.
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

# True if the given (currently-existing-on-disk) file contains any DDL/RLS/
# backend-ownership statement. Only ever called on a file that is entirely
# NEW (untracked, or newly added/renamed/copied in) — never on an existing
# file's diff — so a single content grep is sufficient and can't false-
# positive on an unrelated reformat of separate, pre-existing content.
file_has_ddl() {
  local f="$1" p
  [ -f "$f" ] || return 1
  for p in "${DDL_PATTERNS[@]}"; do
    if grep -F -q -- "$p" "$f" 2>/dev/null; then
      return 0
    fi
  done
  return 1
}

# BOUNDARY_BASE_REF, when set to a real sha/ref (e.g. by CI — see
# .github/workflows/repo-boundaries.yml), is the correct diff base for this
# run (the PR base sha, or the pre-push sha) and is expected to resolve: if
# it doesn't, that's a checkout/history problem, not "no base available", so
# we fail loudly rather than silently falling through to a same-commit
# origin/main diff that would report zero new violations no matter what
# changed.
#
# Two cases are explicitly NOT "a base that should resolve but didn't" —
# both are treated as "no base available" and fall back to the same local-
# fallback path (try origin/main; warn, don't fail, if even that can't be
# resolved; skip tracked-diff checks either way):
#   - BOUNDARY_BASE_REF unset/empty — a local/dev run, or a CI trigger with
#     no natural base (e.g. workflow_dispatch).
#   - BOUNDARY_BASE_REF is the all-zero sha (0000000000000000000000000000000000000000).
#     GitHub sets github.event.before to this on a push event that has no
#     prior commit to point at (creating a branch, or main's very first
#     push) — there is genuinely no "before" commit to diff against, so
#     treating it as an unresolvable real sha would fail CI on a perfectly
#     clean push with zero actual boundary violations.
# Either way, the untracked-file checks above already ran regardless of any
# of this — they need no base at all.
ALL_ZERO_SHA_RE='^0+$'
HAVE_BASE=0
if [ -n "${BOUNDARY_BASE_REF:-}" ] && [[ ! "${BOUNDARY_BASE_REF}" =~ $ALL_ZERO_SHA_RE ]]; then
  BASE_REF="$BOUNDARY_BASE_REF"
  if git rev-parse --verify --quiet "${BASE_REF}^{commit}" >/dev/null 2>&1; then
    HAVE_BASE=1
  else
    echo "ERROR: BOUNDARY_BASE_REF=\"${BASE_REF}\" was provided but could not be resolved to a commit."
    echo "This usually means the checkout did not fetch enough history (actions/checkout needs fetch-depth: 0) or the base sha is invalid."
    echo "Failing loudly instead of silently skipping the diff-based boundary checks — see docs/repo-ownership-guardrails.md."
    exit 1
  fi
else
  if [ -n "${BOUNDARY_BASE_REF:-}" ]; then
    echo "WARNING: Boundary base ref is all-zero; tracked diff checks are skipped for this run."
  fi
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

# Untracked new *.sql files anywhere ELSE under supabase/ (outside
# migrations/functions, already handled above) — new backend ownership can
# just as easily land in e.g. supabase/schema/new_table.sql as in
# supabase/migrations/. Content-checked (not a location-only hard fail,
# unlike migrations/functions) since a non-DDL .sql file here isn't itself a
# boundary violation. Also needs no base ref — same reasoning as above.
untracked_other_sql="$(git ls-files --others --exclude-standard -- supabase 2>/dev/null \
  | grep -E '\.sql$' \
  | grep -Ev '^supabase/migrations/|^supabase/functions/' || true)"
if [ -n "$untracked_other_sql" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    if file_has_ddl "$f"; then
      echo "BOUNDARY VIOLATION: untracked Supabase SQL file outside migrations/ contains DDL — schema authority belongs to oasis-supabase-core: $f"
      violations=$((violations + 1))
    fi
  done <<< "$untracked_other_sql"
fi

if [ "$HAVE_BASE" -eq 1 ]; then
  # New migration/function paths committed or staged since the base branch.
  #
  # `--diff-filter=A` (added) alone is NOT enough: `git mv some/other/file.sql
  # supabase/migrations/x.sql`, or copying a tracked file into supabase/, is
  # reported by git as status R (renamed) or C (copied), never A — so an
  # A-only filter lets a file walk straight into forbidden backend-ownership
  # territory without ever showing up as "added". We scan the FULL repo diff
  # (no pathspec — restricting to supabase/ up front can suppress rename
  # pairing against a source path outside it) with rename/copy detection on,
  # then classify every row ourselves:
  #   - A/T rows have one path column: that path IS the new/changed file.
  #   - R/C rows have two path columns (old, new): the DESTINATION (new) path
  #     is what matters — a rename health-checks against where the file ends
  #     up, not where it used to live. The source path is irrelevant here
  #     (moving a file OUT of supabase/ isn't a boundary violation).
  # Any A/C/R/T row whose destination lands under supabase/migrations/*.sql
  # or supabase/functions/** is new backend/schema ownership and hard-fails
  # outright, exactly like a freshly created file would. A destination
  # elsewhere under supabase/*.sql is collected separately and only hard-
  # fails if its content contains DDL (checked below, after the loop) — a
  # non-schema .sql file dropped outside migrations isn't itself forbidden.
  new_migrations=""
  new_functions=""
  new_other_sql=""
  while IFS=$'\t' read -r status path1 path2; do
    [ -z "$status" ] && continue
    case "$status" in
      A*|T*) dest="$path1" ;;
      R*|C*) dest="$path2" ;;
      *) continue ;;
    esac
    case "$dest" in
      supabase/migrations/*.sql) new_migrations="${new_migrations}${dest}"$'\n' ;;
      supabase/functions/*) new_functions="${new_functions}${dest}"$'\n' ;;
      supabase/*.sql) new_other_sql="${new_other_sql}${dest}"$'\n' ;;
    esac
  done < <(git diff --name-status -M -C --diff-filter=ACRT "${BASE_REF}" 2>/dev/null)
  new_migrations="$(printf '%s' "$new_migrations" | grep -v '^$' | sort -u || true)"
  new_functions="$(printf '%s' "$new_functions" | grep -v '^$' | sort -u || true)"
  new_other_sql="$(printf '%s' "$new_other_sql" | grep -v '^$' | sort -u || true)"

  if [ -n "$new_migrations" ]; then
    echo "BOUNDARY VIOLATION: new Supabase migration path(s) introduced (added, renamed, or copied in) — schema ownership belongs to oasis-supabase-core:"
    echo "$new_migrations" | sed 's/^/  /'
    violations=$((violations + 1))
  fi
  if [ -n "$new_functions" ]; then
    echo "BOUNDARY VIOLATION: new Supabase Edge Function path(s) introduced (added, renamed, or copied in) — Edge Function ownership belongs to oasis-supabase-core:"
    echo "$new_functions" | sed 's/^/  /'
    violations=$((violations + 1))
  fi
  if [ -n "$new_other_sql" ]; then
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      if file_has_ddl "$f"; then
        echo "BOUNDARY VIOLATION: new Supabase SQL path outside migrations/ contains DDL (added, renamed, or copied in) — schema authority belongs to oasis-supabase-core: $f"
        violations=$((violations + 1))
      fi
    done <<< "$new_other_sql"
  fi

  # Edits to EXISTING legacy migration/function files (same path in base and
  # HEAD, i.e. genuinely status M — rename detection above doesn't reclassify
  # same-path changes) — warning only, never a hard failure, no matter what
  # content (including DDL keywords) the edit touches. This is what makes a
  # routine legacy-migration reformat pass instead of false-positiving.
  modified_migrations="$(git diff --name-only -M -C --diff-filter=M "${BASE_REF}" -- supabase/migrations 2>/dev/null | grep -E '\.sql$' || true)"
  if [ -n "$modified_migrations" ]; then
    count="$(echo "$modified_migrations" | wc -l | tr -d ' ')"
    echo "NOTE: $count existing legacy supabase/migrations file(s) modified — warning only, not a hard failure (see docs/repo-ownership-guardrails.md):"
    echo "$modified_migrations" | sed 's/^/  /'
    warnings=$((warnings + 1))
  fi

  modified_functions="$(git diff --name-only -M -C --diff-filter=M "${BASE_REF}" -- supabase/functions 2>/dev/null || true)"
  if [ -n "$modified_functions" ]; then
    count="$(echo "$modified_functions" | wc -l | tr -d ' ')"
    echo "NOTE: $count existing legacy supabase/functions file(s) modified — warning only, not a hard failure (see docs/repo-ownership-guardrails.md):"
    echo "$modified_functions" | sed 's/^/  /'
    warnings=$((warnings + 1))
  fi
else
  echo "NOTE: base ref \"${BASE_REF}\" not available — skipping tracked-file diff checks (nothing to compare against). Untracked-file checks above still ran (independent of base-ref availability — an untracked file has no history to diff against in the first place, so it needs none)."
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
