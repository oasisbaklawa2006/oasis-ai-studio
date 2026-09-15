#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for Oasis AI Studio.
# - Installs pinned dependencies from package-lock.json.
# - Ensures a local .env exists so the Vite app can boot. Real Central Supabase
#   credentials injected as VITE_* environment secrets always take precedence
#   over this placeholder file (Vite prioritizes process.env over .env files).
set -euo pipefail

cd "$(dirname "$0")/.."

npm ci

if [ -z "${VITE_SUPABASE_URL:-}" ] && [ ! -f .env ]; then
  echo "[cloud-agent-setup] Writing placeholder .env (override with VITE_* secrets for a live backend)"
  cat > .env <<'ENV'
VITE_SUPABASE_URL=https://test-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=test-publishable-key
VITE_SUPABASE_PROJECT_ID=test-project
VITE_MEDIA_GOVERNANCE_MODE=testing
ENV
fi

echo "[cloud-agent-setup] Done."
