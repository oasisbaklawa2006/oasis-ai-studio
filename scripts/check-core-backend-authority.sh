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

is_reviewed_one_time_core493_refresh() {
  local status="${1:-}" path="${2:-}" before_blob after_blob
  [[ "$status" == "M" && "$path" == "$core493_path" ]] || return 1
  before_blob="$(git rev-parse "${base_ref}:${path}" 2>/dev/null)" || return 1
  after_blob="$(git rev-parse "HEAD:${path}" 2>/dev/null)" || return 1
  [[ "$before_blob" == "$core493_old_studio_blob" ]] || return 1
  [[ "$after_blob" == "$core493_approved_core_blob" ]] || return 1
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
