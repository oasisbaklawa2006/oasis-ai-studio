#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

npm ci

# Cloud Agent secrets are injected as environment variables. Vite reads VITE_* from
# process.env, but some scripts and tooling expect a .env file — create one when secrets
# are available and no .env exists yet.
if [[ ! -f .env ]] && [[ -n "${VITE_SUPABASE_URL:-}" ]] && [[ -n "${VITE_SUPABASE_PUBLISHABLE_KEY:-}" ]]; then
  cat > .env <<EOF
VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}
VITE_SUPABASE_PROJECT_ID=${VITE_SUPABASE_PROJECT_ID:-}
VITE_MEDIA_GOVERNANCE_MODE=${VITE_MEDIA_GOVERNANCE_MODE:-testing}
EOF
fi
