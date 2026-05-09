# Oasis AI Studio

Oasis AI Studio is an internal product/catalogue operations frontend for managing products, media, labels, ingredients, hampers, and catalogue publishing workflows.

## Rebuild direction
- This repository is being rebuilt toward a **Central Supabase** backend model.
- Do **not** introduce Lovable Cloud runtime dependencies.
- Use only the project Supabase client environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`

## Setup
1. Copy environment template:
   - `cp .env.example .env`
2. Fill required variables in `.env`.
3. Install dependencies:
   - `npm install`

## Development
- Start dev server:
  - `npm run dev`

## Quality checks
- Build:
  - `npm run build`
- Lint:
  - `npm run lint`
- Tests:
  - `npm test`

## Rules for current rebuild phase
- No Lovable Cloud usage.
- No direct Central Supabase schema changes in this phase.
- No SQL/migrations unless a migration-specific PR is approved.
