# POINT 41 — Live Storage & Physical Camera UAT Checklist

**Work item:** Central #459 Point 41 (Media workspace)  
**Scope:** Human/physical verification only — **not** claimed by software PR #143  
**Environment:** AI Studio staging or production preview (Vercel exact-head) with live Supabase  
**Bucket:** `product-media` (`AI_STUDIO_MEDIA_BUCKET`)

## Preconditions

| # | Check | Pass criteria |
| --- | --- | --- |
| P1 | Authenticated catalogue contributor or direct-write role | `/media` shows Add Media when `canMutate` |
| P2 | Authenticated catalogue reviewer | `/media/review` loads submissions desk (not access-denied) |
| P3 | Target Supabase project | Same project as AI Studio env vars (`VITE_SUPABASE_URL`) |
| P4 | Bucket exists | `product-media` bucket present (migration `20260506093134` applied in target project) |

## A. Bucket reachability (read-only probe)

| # | Step | Expected result | Evidence to capture |
| --- | --- | --- | --- |
| A1 | Open **Testing → 5-SKU Pilot Readiness** (`/testing/pilot-readiness`) | Bucket probe runs without `missing` | Screenshot of bucket OK / owner-action banner absent |
| A2 | Or run `probeProductMediaBucket()` in browser console on `/media` | Returns reachable, not `missing` | Console output or network tab `storage.list` 200 |

**Fail-closed:** If bucket missing, stop — apply Core migration in Supabase Dashboard; do not bypass with local-only uploads.

## B. Gallery upload (`/media`)

| # | Step | Expected result | Evidence to capture |
| --- | --- | --- | --- |
| B1 | Select product, choose **From gallery**, pick JPEG ≤50 MiB | File passes client validation; upload succeeds or draft submitted | Toast success; row in library or pending notice |
| B2 | With **Type** set to image, attempt `.txt` file or `.mp4` video (genuinely disallowed MIME for image-only validation) | **Rejected before storage** with validation toast | No storage object created |
| B3 | Attempt oversize file (>50 MiB / 52,428,800 bytes) | **Rejected before storage** | No storage object created |
| B4 | Reload `/media` | Uploaded asset persists with correct approval-state badge | Screenshot of card with status badge |

## C. Physical camera capture (`/media`)

| # | Step | Expected result | Evidence to capture |
| --- | --- | --- | --- |
| C1 | On **physical mobile device** (iOS Safari or Android Chrome), open exact-head preview | `/media` loads | Device + URL in notes |
| C2 | Tap **Take photo**, capture image | Camera intent opens; capture returns to app | Photo appears in upload flow |
| C3 | Complete upload for linked product | Storage path `products/{sku\|id}/raw/{ts}-{filename}` or `.../submissions/...` in draft mode | Network tab storage upload 200 + `product_media` row |
| C4 | Verify public URL loads on device | Image renders in library card | Screenshot on device |

**Note:** Desktop webcam is out of scope unless `capture="environment"` is explicitly tested on a laptop with camera — mobile is the authoritative gate.

## D. Media review workflow (`/media/review`)

| # | Step | Expected result | Evidence to capture |
| --- | --- | --- | --- |
| D1 | As contributor, submit media in draft mode | `catalogue_media_submissions` row `pending_approval` | Row visible in review desk |
| D2 | As reviewer, open `/media/review` | Payload preview (image link or safe URL) and metadata match submission | Screenshot |
| D3 | Reject with reason | Row moves to Rejected; `review_notes` / rejection visible | Screenshot |
| D4 | Confirm **Approve** is hidden/disabled in `/media/review` and Approval Inbox for media until Core mapping ships | UI shows blocked notice; reject still works | Screenshot of notice (no Approve button) |

**Known Core constraint:** `approve_catalogue_media_submission` remains fail-closed (*Approval mapping not finalized*) until Core finalizes mapping — AI Studio UI must not expose a nonfunctional Approve action.

## E. Post-upload persistence

| # | Step | Expected result | Evidence to capture |
| --- | --- | --- | --- |
| E1 | Hard refresh `/media` after B/C upload | Asset still listed | Screenshot |
| E2 | Confirm `product_media.file_url` is https public URL from `product-media` bucket | URL pattern matches `getMediaPublicUrl` | DB row or network inspect |

## Sign-off

| Field | Value |
| --- | --- |
| Tester | |
| Date (UTC) | |
| Preview URL / commit SHA | |
| Supabase project ref | |
| Overall | PASS / FAIL / BLOCKED |
| Blockers | |

**Software closure (PR #143) ends here.** Programme Point 41 stage clearance requires completed sign-off above.
