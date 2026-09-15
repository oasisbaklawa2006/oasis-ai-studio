#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for the Oasis Appverse workspace.
#
# Reproduces the verified tooling and repository setup for a freshly created
# Cursor agent environment:
#   - Node.js / npm (provided by the base image)
#   - Deno (pinned)                -> /usr/local/bin/deno   (on the default PATH)
#   - Supabase CLI (pinned)        -> /usr/local/bin/supabase
#   - Node dependency install from each repo's committed lockfile (npm ci)
#   - AI Studio Vite .env bootstrap (placeholder only; real creds via secrets)
#
# Guarantees:
#   - Idempotent: safe to run repeatedly. Never regenerates lockfiles
#     (npm ci is read-only against package-lock.json) and never edits app source.
#   - No secrets are written. Real VITE_* / backend credentials are injected as
#     environment secrets and always take precedence over the placeholder .env.
#   - No Docker dependency (Docker is unavailable in the nested Cloud Agent VM).
set -euo pipefail

# Pinned tool versions (match the verified VM). Override via env if a repo later
# pins a different compatible version.
DENO_VERSION="${DENO_VERSION:-2.9.6}"
SUPABASE_VERSION="${SUPABASE_VERSION:-2.117.0}"
BIN_DIR="/usr/local/bin"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STUDIO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"       # oasis-ai-studio
WORKSPACE_ROOT="$(cd "$STUDIO_DIR/.." && pwd)"   # repos root (siblings live here)

log() { echo "[cloud-agent-setup] $*"; }

# install_to_bin <src-file> <dest-name>: place an executable on the default PATH,
# using sudo when the target is not directly writable.
install_to_bin() {
  local src="$1" name="$2"
  if [ -w "$BIN_DIR" ]; then
    install -m 0755 "$src" "$BIN_DIR/$name"
  else
    sudo install -m 0755 "$src" "$BIN_DIR/$name"
  fi
}

ensure_deno() {
  if command -v deno >/dev/null 2>&1 && [ "$(deno --version 2>/dev/null | head -1 | awk '{print $2}')" = "$DENO_VERSION" ]; then
    log "deno ${DENO_VERSION} already present ($(command -v deno))"
    return
  fi
  log "installing deno ${DENO_VERSION}"
  local tmp; tmp="$(mktemp -d)"
  curl -fsSL "https://github.com/denoland/deno/releases/download/v${DENO_VERSION}/deno-x86_64-unknown-linux-gnu.zip" -o "$tmp/deno.zip"
  unzip -o -q "$tmp/deno.zip" -d "$tmp"
  install_to_bin "$tmp/deno" deno
  rm -rf "$tmp"
  log "deno -> $(deno --version | head -1)"
}

ensure_supabase() {
  if command -v supabase >/dev/null 2>&1 && [ "$(supabase --version 2>/dev/null)" = "$SUPABASE_VERSION" ]; then
    log "supabase CLI ${SUPABASE_VERSION} already present ($(command -v supabase))"
    return
  fi
  log "installing supabase CLI ${SUPABASE_VERSION}"
  local tmp; tmp="$(mktemp -d)"
  curl -fsSL "https://github.com/supabase/cli/releases/download/v${SUPABASE_VERSION}/supabase_linux_amd64.tar.gz" -o "$tmp/supabase.tar.gz"
  tar -xzf "$tmp/supabase.tar.gz" -C "$tmp" supabase
  install_to_bin "$tmp/supabase" supabase
  rm -rf "$tmp"
  log "supabase CLI -> $(supabase --version)"
}

# Install Node dependencies from the committed lockfile for each canonical repo
# that is present in the workspace. npm ci is deterministic and never rewrites
# package-lock.json. oasis-supabase-core is Deno-based and has no npm lockfile.
install_node_deps() {
  local repo
  for repo in oasis-ai-studio oasis-baklawa Oasis-Baklawa-Central oasis-trace; do
    local dir="$WORKSPACE_ROOT/$repo"
    if [ -f "$dir/package-lock.json" ]; then
      log "npm ci -> $repo"
      (cd "$dir" && npm ci)
    else
      log "skip $repo (not present in this workspace)"
    fi
  done
}

# AI Studio needs VITE_SUPABASE_* to boot the Vite app. Write a placeholder .env
# only when no real credential is injected and no .env already exists. Vite gives
# process.env (injected secrets) precedence over .env, so real secrets win.
ensure_studio_env() {
  if [ -z "${VITE_SUPABASE_URL:-}" ] && [ ! -f "$STUDIO_DIR/.env" ]; then
    log "writing placeholder AI Studio .env (override with VITE_* secrets for a live backend)"
    cat > "$STUDIO_DIR/.env" <<'ENV'
VITE_SUPABASE_URL=https://test-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=test-publishable-key
VITE_SUPABASE_PROJECT_ID=test-project
VITE_MEDIA_GOVERNANCE_MODE=testing
ENV
  else
    log "AI Studio .env present or VITE_SUPABASE_URL secret injected; leaving as-is"
  fi
}

ensure_deno
ensure_supabase
install_node_deps
ensure_studio_env

log "Done. node=$(node --version) npm=$(npm --version) deno=$(deno --version | head -1 | awk '{print $2}') supabase=$(supabase --version)"
