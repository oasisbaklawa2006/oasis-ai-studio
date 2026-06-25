# ERP `whatsapp_messages` — Live Schema Audit

**Audit date:** 2026-06-25  
**Supabase project:** `tcxvcatsqqertcnycuop` (oasis-baklawa)  
**Table:** `public.whatsapp_messages` (67 rows total)

## 1. Table schema

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `contact_id` | `uuid` | NO | — | FK → `whatsapp_contacts.id` |
| `order_id` | `uuid` | YES | — | FK → `orders.id` |
| `direction` | `varchar` | NO | — | CHECK: `inbound` \| `outbound` |
| `message_type` | `varchar` | NO | `'text'` | e.g. `text`, `image`, `video` |
| `content` | `text` | YES | — | Message body (text messages) |
| `media_url` | `text` | YES | — | Media path when non-text |
| `provider` | `varchar` | NO | — | Live rows: `whatsapp` |
| `provider_message_id` | `varchar` | YES | — | Meta `wamid.*` when present |
| `status` | `varchar` | NO | `'pending'` | Inbound samples: `received` |
| `retry_count` | `int` | YES | `0` | Outbound retry metadata |
| `failure_reason` | `text` | YES | — | |
| `message_timestamp` | `timestamp` (no TZ) | YES | `now()` | **Cursor field** for bridge poll |
| `created_at` | `timestamp` (no TZ) | YES | `now()` | Insert time fallback |
| `packet_id` | `uuid` | YES | — | Stitcher packet FK |
| `packet_sequence` | `int` | YES | — | |
| `packet_status` | `varchar` | YES | `'open'` | |
| `is_raw` | `boolean` | YES | `true` | |
| `stitched_at` | `timestamp` (no TZ) | YES | — | |

**Phone join table:** `public.whatsapp_contacts`

| Column | Type | Notes |
|--------|------|-------|
| `phone_number` | `varchar` UNIQUE | E.164 digits without `+` (e.g. `919891162212`) |
| `customer_name` | `varchar` | Often null in live inbound samples |

## 2. Phone / body / provider_message_id columns

| Studio ingest arg | ERP source | Example (latest inbound) |
|-------------------|------------|--------------------------|
| `_sender_phone` | `whatsapp_contacts.phone_number` via `contact_id` join | `919891162212` → normalize to `+919891162212` |
| `_sender_name` | `whatsapp_contacts.customer_name` | `null` |
| `_message_body` | `whatsapp_messages.content` | `10 kg Midya pista` |
| `_provider_message_id` | `whatsapp_messages.provider_message_id` | `wamid.HBgMOTE5ODkxMTYyMjEyFQIAEhgUM0EzMDYyQUQ1QkU5MjY4OTc5N0EA` |
| `_message_type` | `whatsapp_messages.message_type` | `text` |
| `_received_at` | `whatsapp_messages.message_timestamp` | `2026-06-24 22:42:02` → ISO UTC |
| `_raw_payload` | Full ERP row + `bridge_source` | `{ bridge_source: "erp_whatsapp_messages", erp_row_id, … }` |

**Idempotency fallback:** `erp:{whatsapp_messages.id}` when `provider_message_id` is null.

## 3. Correct inbound filter

```sql
WHERE m.direction = 'inbound'
```

**Distribution (live):** 66 inbound, 1 outbound.

**Inbound message types:** 59 `text`, 6 `image`, 1 `video`.

**Bridge MVP:** ingest `text` only (skip `image`/`video`/`outbound` — matches Studio webhook adapter rules).

**Poll query:**

```sql
SELECT m.*, c.phone_number, c.customer_name
FROM public.whatsapp_messages m
JOIN public.whatsapp_contacts c ON c.id = m.contact_id
WHERE m.direction = 'inbound'
  AND m.message_timestamp > :cursor
ORDER BY m.message_timestamp ASC, m.id ASC
LIMIT :batch_limit;
```

## 4. Five latest inbound rows (redacted sample)

| `message_timestamp` | `phone_number` | `content` (truncated) | `provider_message_id` (prefix) |
|---------------------|----------------|------------------------|--------------------------------|
| 2026-06-24 22:42:02 | 919891162212 | 10 kg Midya pista | `wamid.HBgMOTE5ODkx…` |
| 2026-06-22 11:04:58 | 919442611969 | Hi | `wamid.HBgMOTE5NDQy…` |
| 2026-06-21 18:32:46 | 919814030057 | 👍 | `wamid.HBgMOTE5ODE0…` |
| 2026-06-21 13:58:03 | 918527207555 | Whts your travel date? … | `wamid.HBgMOTE4NTI3…` |
| 2026-06-21 13:57:45 | 918527207555 | You put the query on just dail… | `wamid.HBgMOTE4NTI3…` |

## 5. ERP vs Studio Supabase project

**YES — same project.**

Both `whatsapp_messages` (ERP legacy webhook writes) and `whatsapp_inbound_messages` (Studio Phase 2C inbox) live in **`tcxvcatsqqertcnycuop`**.

Implications:

- Bridge uses **one** `SUPABASE_SERVICE_ROLE_KEY` (read ERP + write Studio inbox).
- No `ERP_SUPABASE_URL` / cross-project read key required for MVP.
- `whatsapp-webhook` v99 remains unchanged; bridge is read-only on `whatsapp_messages`.

## 6. GO / NO-GO

| Gate | Result |
|------|--------|
| `whatsapp_messages` schema confirmed | **GO** |
| Inbound filter (`direction = 'inbound'`) | **GO** |
| Phone/body/wamid mapping | **GO** |
| Same Supabase project | **GO** |
| No `whatsapp-webhook` changes | **GO** (bridge is separate slug) |

### **GO — implement `whatsapp-studio-inbox-bridge`**
