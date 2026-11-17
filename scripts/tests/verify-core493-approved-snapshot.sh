#!/usr/bin/env bash
# Disposable git-history regression tests for the approved one-time Core #493 snapshot.
# No network, Supabase credentials, production data or provider calls.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
root="$PWD"
source_path='supabase/functions/_shared/erpInboxBridge/processErpInboundRow.ts'
guard_path='scripts/check-core-backend-authority.sh'
original_commit='abeec87d9ca83ec91e78ba94ad554113d1d4c6e1'
original_blob='911461b637413f3525f04ebcb3b565ea2d670e8f'
approved_blob='216a3aec29b8b66caccd2c45a83c40a1747a9345'

scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT

git show "$original_commit:$source_path" > "$scratch/original.ts"
[[ "$(git hash-object "$scratch/original.ts")" == "$original_blob" ]] ||
  { echo 'Historical Studio blob does not match pinned source' >&2; exit 1; }
[[ "$(git hash-object "$source_path")" == "$approved_blob" ]] ||
  { echo 'Proposed Studio snapshot does not equal merged Core blob' >&2; exit 1; }

run_case() {
  local name="$1" expected="$2" directory="$scratch/$1"
  local base result=0
  mkdir -p "$directory/$(dirname "$source_path")" "$directory/$(dirname "$guard_path")"
  git -C "$directory" init -q
  git -C "$directory" config user.email 'ci@example.invalid'
  git -C "$directory" config user.name 'CI Snapshot Guard'
  cp "$scratch/original.ts" "$directory/$source_path"
  cp "$root/$guard_path" "$directory/$guard_path"
  if [[ "$name" == 'wrong_old_blob' ]]; then
    printf '\n// altered historical source\n' >> "$directory/$source_path"
  fi
  if [[ "$name" == 'change_existing_other' ]]; then
    mkdir -p "$directory/supabase/functions/legacy-example"
    printf 'export const version = 1;\n' > "$directory/supabase/functions/legacy-example/index.ts"
  fi
  if [[ "$name" == 'change_package_build' ]]; then
    printf '{"scripts":{"build":"vite build"}}\n' > "$directory/package.json"
  fi
  if [[ "$name" == "tamper_approved_workflow" ]]; then
    mkdir -p "$directory/.github/workflows"
    printf '%s\n' 'name: before' > "$directory/.github/workflows/core-backend-authority.yml"
  fi
  if [[ "$name" == "tamper_approved_biome" ]]; then
    mkdir -p "$directory/scripts"
    printf '%s\n' 'console.log("before")' > "$directory/scripts/biome-changed.mjs"
  fi
  git -C "$directory" add -A
  git -C "$directory" commit -qm 'historical base'
  base="$(git -C "$directory" rev-parse HEAD)"

  cp "$root/$source_path" "$directory/$source_path"
  case "$name" in
    wrong_new_blob)
      printf '\n// unauthorized appended code\n' >> "$directory/$source_path" ;;
    change_existing_other)
      printf 'export const version = 2;\n' > "$directory/supabase/functions/legacy-example/index.ts" ;;
    add_other)
      mkdir -p "$directory/supabase/functions/unapproved-worker"
      printf 'export {};\n' > "$directory/supabase/functions/unapproved-worker/index.ts" ;;
    rename_core)
      mv "$directory/$source_path" "$directory/$(dirname "$source_path")/renamed.ts" ;;
    add_deploy_workflow)
      mkdir -p "$directory/.github/workflows"
      printf '%s\n' 'jobs: {deploy: {steps: [{run: "supabase functions deploy whatsapp-studio-inbox-bridge"}]}}' > "$directory/.github/workflows/deploy.yml" ;;
    change_package_build)
      printf '{"scripts":{"build":"supabase functions deploy whatsapp-studio-inbox-bridge"}}\n' > "$directory/package.json" ;;
    add_unrelated_document)
      printf '%s\n' 'Unexpected file in one-time Core snapshot change set' > "$directory/README.md" ;;
    tamper_approved_workflow)
      printf '%s\n' 'jobs: {deploy: {steps: [{run: "supabase functions deploy whatsapp-studio-inbox-bridge"}]}}' > "$directory/.github/workflows/core-backend-authority.yml" ;;
    tamper_approved_biome)
      printf '%s\n' 'console.log("unauthorized")' > "$directory/scripts/biome-changed.mjs" ;;
    add_trailing_space_guard)
      # A lookalike path with trailing whitespace MUST not be allowlisted.
      printf '%s\n' '# unauthorized extra guard path' > "$directory/${guard_path} " ;;
    tamper_approved_test_script)
      mkdir -p "$directory/scripts/tests"
      printf '%s\n' 'echo bypass' > "$directory/scripts/tests/verify-core493-approved-snapshot.sh" ;;
  esac
  git -C "$directory" add -A
  git -C "$directory" commit -qm 'candidate refresh'
  if [[ "$name" == 'untracked_other' ]]; then
    mkdir -p "$directory/supabase/functions/untracked-worker"
    printf 'export {};\n' > "$directory/supabase/functions/untracked-worker/index.ts"
  fi
  ( cd "$directory"; bash "$guard_path" "$base" ) > "$scratch/$name.log" 2>&1 || result=$?
  if [[ "$expected" == 'pass' && "$result" -ne 0 ]] ||
     [[ "$expected" == 'reject' && "$result" -eq 0 ]]; then
    echo "One-time Core snapshot guard mismatch: $name expected $expected, got exit $result" >&2
    cat "$scratch/$name.log" >&2
    exit 1
  fi
  echo "PASS $name: $expected"
}

run_case exact_core493_blob pass
for negative in wrong_old_blob wrong_new_blob change_existing_other add_other rename_core untracked_other add_deploy_workflow change_package_build add_unrelated_document tamper_approved_workflow tamper_approved_biome add_trailing_space_guard tamper_approved_test_script; do
  run_case "$negative" reject
done
echo 'Core #493 frozen-snapshot gate: all fourteen positive/negative tests passed.'
