#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Ensure .env exists when secrets are injected by the Cloud Agent environment.
if [[ ! -f .env ]] && [[ -n "${VITE_SUPABASE_URL:-}" ]] && [[ -n "${VITE_SUPABASE_PUBLISHABLE_KEY:-}" ]]; then
  cat > .env <<EOF
VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}
VITE_SUPABASE_PROJECT_ID=${VITE_SUPABASE_PROJECT_ID:-}
VITE_MEDIA_GOVERNANCE_MODE=${VITE_MEDIA_GOVERNANCE_MODE:-testing}
EOF
fi

if [[ -z "${VITE_SUPABASE_URL:-}" ]] || [[ -z "${VITE_SUPABASE_PUBLISHABLE_KEY:-}" ]]; then
  echo "[cloud-agent-start] Warning: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are not set."
  echo "[cloud-agent-start] Add them as environment secrets to connect to Central Supabase."
  exit 0
fi

echo "[cloud-agent-start] Supabase env configured for $(echo "$VITE_SUPABASE_URL" | sed -E 's|https://([^.]+)\.supabase\.co|\1|')"
