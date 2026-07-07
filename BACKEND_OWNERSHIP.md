# Backend Ownership Boundary

This repository is a frontend and AI Studio application repository.

It must not be treated as the canonical Supabase backend authority.

Canonical backend repository:

- oasis-supabase-core

This repository may contain application code, UI, frontend flows, catalogue tools, and operator workflows.

This repository must not own or casually deploy:

- supabase/functions
- supabase/migrations
- supabase/config.toml
- production database schema changes
- RLS policy changes
- storage policy changes

High-risk rule:

Do not deploy whatsapp-webhook from this repository.

Current verified status:

- oasis-supabase-core created and pushed
- whatsapp-studio-inbox-bridge deployed from oasis-supabase-core as v17
- bridge secret rotated
- dry run passed
- resolver SQL verification passed
- BRIDGE_ENABLED=false retained for safety
- legacy whatsapp-webhook untouched
- Supabase production auto-deploy remains OFF

Important:

The modified bridge/resolver backend source now belongs in oasis-supabase-core. AI Studio must not be used as the deployment source for Supabase backend infrastructure.
