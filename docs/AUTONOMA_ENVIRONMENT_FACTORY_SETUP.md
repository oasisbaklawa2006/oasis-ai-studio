# Autonoma Environment Factory Setup

This branch adds `/api/autonoma`, a Vercel serverless endpoint for Autonoma's Environment Factory SDK.

## Required Vercel environment variables

Set these as server-side variables in Vercel before dry-running Autonoma scenarios:

- `AUTONOMA_SHARED_SECRET`
- `AUTONOMA_SIGNING_SECRET`
- `SUPABASE_URL` or `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTONOMA_TEST_EMAIL`
- `AUTONOMA_TEST_PASSWORD`

Do not prefix `SUPABASE_SERVICE_ROLE_KEY`, `AUTONOMA_SIGNING_SECRET`, `AUTONOMA_TEST_EMAIL`, or `AUTONOMA_TEST_PASSWORD` with `VITE_`.

## Data safety

The products factory creates records with:

- `source_collection = autonoma:<testRunId>`
- `source_document = autonoma-environment-factory`

Teardown only deletes records whose IDs match the created refs and whose `source_collection` starts with `autonoma:`.

Use a staging/preview Supabase project for mutating Autonoma dry runs whenever possible. Production dry runs can create disposable product rows and should only be used with explicit approval and cleanup monitoring.
