#!/usr/bin/env bash
set -euo pipefail

page="src/pages/PublicCatalogue.tsx"
test -f "$page"

rg -q 'get_public_collection_catalogue' "$page"
rg -q 'get_public_legacy_catalogue_v1' "$page"
rg -q 'oasis\.legacy-public-catalogue\.v1' "$page"

if rg -q 'supabase\.from\("catalogues"\)|supabase\.from\("catalogue_products"\)|select\("[^\"]*products\(\*\)' "$page"; then
  echo "Public catalogue page must not query catalogue or product authority tables directly." >&2
  exit 1
fi

echo "public catalogue authority: PASS"
