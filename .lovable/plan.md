# Capability Check: External Supabase Preview (dfjslkwxawnzurolifpm) — Read-Only Answer

No changes were made. This is a capability statement only.

## Question
Can this Lovable project/agent provide or configure `LOVABLE_API_KEY` and `WHATSAPP_MEDIA_ALLOWED_HOSTS` as Edge Function secrets on the external Supabase preview project `dfjslkwxawnzurolifpm` without exposing secret values, and does the agent currently have authority/connection to that exact preview?

## Findings

### 1. Current authority / connection — NO
- This project's managed backend tooling (supabase read/migration/secret tools, sandbox DB env) is bound to the original Lovable Cloud project (`wgajrxyoararisiwjzox`), which was disabled earlier in this session.
- The frontend `.env` was re-pointed to the Oasis Central project (`tcxvcatsqqertcnycuop`), pending a proper UI reconnection — but that is Central, not the preview `dfjslkwxawnzurolifpm`.
- I have **no connection, credentials, or tooling bound to `dfjslkwxawnzurolifpm`**. I cannot read from or write to it, and I will not attempt to.

### 2. `LOVABLE_API_KEY` on an external Supabase project — NOT SUPPORTED (by design)
- `LOVABLE_API_KEY` is auto-provisioned per Lovable project, workspace-scoped, and encodes the workspace/project for billing and rate limiting. It is managed only through the Lovable platform (create/rotate tools).
- Its value is never revealed to the agent or user, so it **cannot** be copied into an external Supabase project's Edge Function secrets. There is no supported mechanism to "install" this project's `LOVABLE_API_KEY` onto `dfjslkwxawnzurolifpm`.
- Gateway/connector calls authenticated by this key are served by Lovable's gateway, not by the external Supabase project. The external preview would need its own integration path; this project's key is not transferable.

### 3. `WHATSAPP_MEDIA_ALLOWED_HOSTS` — supported pattern, but only via the owner's own tooling
- This is an ordinary, non-sensitive config value (a host allowlist). The supported mechanism on any external Supabase project is:
  - The project owner sets it with `supabase secrets set WHATSAPP_MEDIA_ALLOWED_HOSTS=... --project-ref dfjslkwxawnzurolifpm` (Supabase CLI), or via the external project's own dashboard Edge Function secrets UI.
  - Edge Functions then read it via `Deno.env.get("WHATSAPP_MEDIA_ALLOWED_HOSTS")`.
- I cannot perform this for you: I have no CLI session, access token, or management-API authority over that project ref, and Lovable's secret tools only manage secrets for the Lovable-managed environment, never third-party Supabase projects.

### 4. Secret-exposure guarantee
- The no-exposure requirement is satisfiable in principle: secret-set flows (Supabase CLI / dashboard, and Lovable's own secret tools) store values without printing them. `LOVABLE_API_KEY` values are never shown even here. The blocker is authority/transferability, not exposure handling.

## Bottom line
- Authority/connection to `dfjslkwxawnzurolifpm`: **none — cannot certify, read, or configure it from here.**
- `LOVABLE_API_KEY` onto that external preview: **not supported** — non-transferable, workspace-bound, value never exposed.
- `WHATSAPP_MEDIA_ALLOWED_HOSTS` onto that external preview: **supported only by the preview's owner** via Supabase CLI/dashboard secret-set; I can supply the exact commands/steps on request but cannot execute them.

## If you want to proceed
Options (require your approval and your action outside this agent):
1. You run `supabase secrets set` against `dfjslkwxawnzurolifpm` yourself; I draft the exact commands and the Edge Function code that consumes both vars.
2. Reconnect this Lovable project to a Supabase project via Connectors → Supabase, after which managed tooling applies to the connected project only.
3. Keep the WhatsApp media allowlist enforcement in this project's Edge Functions instead of the external preview.
