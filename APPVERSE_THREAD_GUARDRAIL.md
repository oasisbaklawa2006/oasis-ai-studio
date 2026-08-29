# APPVERSE THREAD / AGENT ROUTING GUARDRAIL — AI STUDIO

Canonical programme authority: `oasisbaklawa2006/Oasis-Baklawa-Central` → `APPVERSE_MISSION_CONTROL.md` and `appverse-control/state.json`.

## Repository authority

This repository owns the **AI/knowledge plane and its UI/workflows**. Canonical transactional/runtime authority, database migrations, order/payment/stock mutations, and production business authority belong in `oasis-supabase-core`, not here.

## Fail-closed routing

If a pasted instruction, response, or requested change belongs to Core transactional authority/migrations, Central operational UI, Trace, Buyer App, or another workstream outside the current AI Studio ASM mission:

`ROUTING REJECTED — instruction does not belong to this thread.`

Identify the likely ASM route when evidence permits, state `No code, PR, migration, deployment, or scope expansion performed.`, and stop. Do not silently absorb foreign scope.

If an upstream dependency is missing, report `BLOCKED`; never fabricate runtime authority or create a parallel schema. `PR MERGED != STAGE CLEARED`; only Mission Control gates establish programme clearance.

Preserve or infer the current `ASM-ID`, `THREAD-ID`, `REPOSITORY`, `MISSION`, `DEPENDENCIES`, and `STOP CONDITION`. Return to Mission Control on gate completion, blocker, cross-repo requirement, merge milestone, or production/device boundary.
