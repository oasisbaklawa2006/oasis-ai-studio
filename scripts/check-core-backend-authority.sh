#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
base_ref="${1:-}"

fail() {
  echo "CORE BACKEND AUTHORITY VIOLATION: $*" >&2
  exit 1
}

[[ -n "$base_ref" ]] || fail "comparison base is required"
[[ ! "$base_ref" =~ ^0+$ ]] || fail "all-zero comparison base is not auditable"
git rev-parse --verify "${base_ref}^{commit}" >/dev/null 2>&1 || fail "comparison base does not resolve: $base_ref"

is_core_owned_path() {
  case "$1" in
    supabase/migrations/*.sql|supabase/functions/*) return 0 ;;
    *) return 1 ;;
  esac
}

# One-time immutable Core #493 snapshot refresh; not permission to author backend code.
# Canonical approval: oasis-supabase-core PR #493 merge fb47a9508dad3d676776ae8fe0172b67c8284d71.
# Any later modification, unrelated file, rename, deletion or copied file still fails.
core493_path='supabase/functions/_shared/erpInboxBridge/processErpInboundRow.ts'
core493_old_studio_blob='911461b637413f3525f04ebcb3b565ea2d670e8f'
core493_approved_core_blob='216a3aec29b8b66caccd2c45a83c40a1747a9345'

# The one-time exception may change only these audited G5 source/guard/test files.
# Unrelated workflows, deployment hooks, scripts or package changes are rejected.
is_only_approved_core493_sync_scope() {
  local changed_path actual_blob
  while read -r changed_path; do
    case "$changed_path" in
      "$core493_path"|"scripts/check-core-backend-authority.sh")
        ;;
      ".github/workflows/core-backend-authority.yml")
        actual_blob="$(git rev-parse "HEAD:$changed_path" 2>/dev/null)" || return 1
        [[ "$actual_blob" == "742a393ef826bc386c4c2feba8a5589e3ae4204c" ]] || return 1
        ;;
      "scripts/biome-changed.mjs")
        actual_blob="$(git rev-parse "HEAD:$changed_path" 2>/dev/null)" || return 1
        [[ "$actual_blob" == "b39261b082003e65f7f0117a9fa1b1c6d1b46e42" ]] || return 1
        ;;
      "scripts/tests/verify-core493-approved-snapshot.sh")
        actual_blob="$(git rev-parse "HEAD:$changed_path" 2>/dev/null)" || return 1
        [[ "$actual_blob" == "85ee87355bfb58907ad6e55f3dee3e0efb023e3d" ]] || return 1
        ;;
      *) return 1 ;;
    esac
  done < <(git diff --name-only -M -C "$base_ref" HEAD)
}
is_reviewed_one_time_core493_refresh() {
  local status="${1:-}" path="${2:-}" before_blob after_blob
  [[ "$status" == "M" && "$path" == "$core493_path" ]] || return 1
  before_blob="$(git rev-parse "${base_ref}:${path}" 2>/dev/null)" || return 1
  after_blob="$(git rev-parse "HEAD:${path}" 2>/dev/null)" || return 1
  [[ "$before_blob" == "$core493_old_studio_blob" ]] || return 1
  [[ "$after_blob" == "$core493_approved_core_blob" ]] || return 1
  is_only_approved_core493_sync_scope
}

violations=()
while IFS=$'\t' read -r status path1 path2; do
  [[ -n "$status" ]] || continue
  case "$status" in
    R*|C*)
      if is_core_owned_path "$path1" || is_core_owned_path "$path2"; then
        violations+=("$status $path1 -> $path2")
      fi
      ;;
    *)
      if is_core_owned_path "$path1"; then
        if is_reviewed_one_time_core493_refresh "$status" "$path1"; then
          echo "CORE BACKEND AUTHORITY: verified one-time Core #493 snapshot sync: $path1"
        else
          violations+=("$status $path1")
        fi
      fi
      ;;
  esac
done < <(git diff --name-status -M -C "$base_ref" HEAD)

while IFS= read -r path; do
  [[ -n "$path" ]] || continue
  if is_core_owned_path "$path"; then
    violations+=("untracked $path")
  fi
done < <(git ls-files --others --exclude-standard)

if ((${#violations[@]})); then
  printf '%s\n' "CORE BACKEND AUTHORITY VIOLATION: oasis-ai-studio may consume Core contracts but may not add, edit, delete, rename or copy Supabase migrations or Edge Functions." >&2
  printf '  %s\n' "${violations[@]}" >&2
  printf '%s\n' "Move backend/schema changes to oasisbaklawa2006/oasis-supabase-core." >&2
  exit 1
fi

echo "Core backend authority guard passed: historical AI Studio backend artifacts are frozen and no Core-owned backend surface changed."
