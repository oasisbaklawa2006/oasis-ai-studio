# Proposed Register Addition — Point 54a / ASM-OC-01 (DRAFT, NOT YET APPLIED)

**Status of this document:** proposal only. This session's write access is scoped to
`oasisbaklawa2006/oasis-ai-studio`; a push-access request to
`oasisbaklawa2006/Oasis-Baklawa-Central` was denied by the session permission
classifier (same boundary hit on the prior turn for `oasis-supabase-core`). The
text below is exactly what Mission Control directed be registered — it has not
been committed to `docs/APP_VERSE_MASTER_PROGRAMME_REGISTER.md` in Central, and
carries no authority until someone with push access to Central applies it there.

Apply by inserting immediately after the Phase C table (after Point 56, before
Phase D) in `docs/APP_VERSE_MASTER_PROGRAMME_REGISTER.md`, and adding a
corresponding row/cross-reference near Point 54.

---

## Point 54a — Oasis Connect: Governed Multi-Channel Publication & Consumer Contract

**Parent:** Point 54 — Implement the approved-product publication contract
**Status:** IN PROGRESS / CONNECT-1
**ASM work item:** ASM-OC-01 — OASIS CONNECT
**Owner:** Mission Control / `Oasis-Baklawa-Central`
**Repositories:** `oasis-supabase-core`, `oasis-ai-studio`, `Oasis-Baklawa-Central`, `oasis-trace`

**Purpose:** Create the plug-and-play consumer/channel integration layer through
which one canonical approved Oasis product/product-intelligence source can serve
different downstream consumers using governed channel profiles and consumer
authorization. Reference consumers: B2B Buyer App, future B2C App, B2C website,
B2B website, WhatsApp catalogue, CRM, catalogue/PDF outputs, Trace/Labelling,
future marketplace/API consumers. No separate product master may be created for
individual channels.

**Cross-point dependencies:**
- Point 54a defines the shared Oasis Connect publication/consumer contract.
- Point 55 uses Oasis Connect to publish approved operational product data to Central.
- Point 56 uses Oasis Connect to publish customer-safe product data to the Customer App/B2C consumers.
- Point 93 uses Oasis Connect/Core contracts where required for Central–Trace product/label command/event integration.
- Point 95 uses the existing Trace printer/reprint authority for label execution and verification.
- Oasis Connect does not replace Points 55, 56, 93 or 95 — it provides the common governed connection mechanism those points may consume.

**Dependency exception:** Point 54a may begin architecture, census, contract
definition and non-mutating design work early, before Points 3–53 are complete,
because this work defines future integration boundaries and prevents
incompatible implementation from being created independently across AI Studio,
Core, Central and Trace. Point 54a may **not** be declared COMPLETE, deployed to
production, or activate cross-application runtime dependencies until the
required predecessor and linked-point gates are satisfied.

Authorized under this exception: read-only repository census; existing-contract
discovery; architecture definition; field-authority registry design;
channel-profile design; API/RPC contract design; schema proposal; UI/configuration
design; test-plan creation.

Not authorized: production migrations; production Edge Function deployment;
schema mutation; bypassing repository ownership; replacement of existing Trace
authority; independent Central/AI Studio commercial authority changes.

**Programme percentage:** unchanged. Point 54 itself remains
`NOT STARTED`/open per existing register rules until its normal predecessor
conditions are met. This subpoint does not advance overall programme completion.

**Repository authority (as registered):**
- **Supabase Core** — shared persistence, RLS, RPCs, security, credentials, audit, backend contracts.
- **AI Studio** — catalogue/product intelligence and Oasis Connect configuration UX.
- **Central** — operational and commercial truth.
- **Trace** — physical printing, reprinting, scanning and label execution.
- **Mission Control** — cross-repository sequencing, scope control and certification.
