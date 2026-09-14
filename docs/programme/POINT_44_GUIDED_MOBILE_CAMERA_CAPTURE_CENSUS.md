# Point 44 — Guided Mobile Camera Capture Canonical Closure

**ASM:** AI Studio Product Master media / photography authority  
**Mission Control authority:** Central #459 — Point 44 = guided mobile camera capture  
**Starting SHA:** `5f446a00a9a9a11d8854b8b8191c6293e7190eaf` (Point 43 PR #172 exact head)  
**Mandatory merge predecessor:** PR #167 (Point 42) → PR #172 (Point 43)  
**Boundary:** No image generation, no production mutation, no enhancement/QA/outputs (Points 45–47)

## Exact baseline census

| Surface | Path | Role | Guided capture status |
| --- | --- | --- | --- |
| Point 42 families | `src/features/mediaReadiness/controlledPhotographyFamilies.ts` | Family → slot → uploader chain (upstream) | Consumed by Point 44 slot binding |
| Point 43 benchmark governance | `src/features/mediaReadiness/benchmarkPhotographyGovernance.ts` | Oasis-neutral capture constraints (upstream) | Presented in guidance before acceptance |
| **Point 44 contract** | `src/features/mediaReadiness/guidedMobileCameraCapture.ts` | **NEW** — canonical guided capture contract | Authoritative |
| Product media uploader | `src/components/ProductMediaUploader.tsx` | 14 upload types; `capture="environment"` on camera input; gallery/camera/video buttons | **GAP:** generic camera, no slot-bound guidance |
| Media library page | `src/pages/Media.tsx` | Global `/media` upload dialog; gallery + camera inputs | **GAP:** no product-family or slot binding |
| Fast Create hero | `src/pages/FastCreateProduct.tsx` | Generic `accept="image/*"` file picker | **GAP:** no camera capture attribute |
| Catalogue media slots | `src/features/catalogueAiStudio/catalogueMediaSlots.ts` | Studio Media tab adapters (Point 42 + 43 + **44**) | Wired |
| OCR intake | `src/components/productIntake/OcrIntakeFields.tsx` | Document OCR file picker | Out of scope — not product photography |
| Voice capture | `src/components/productIntake/useVoiceCapture.ts` | Speech-to-text intake | Out of scope — not photography |
| Testing PDF upload | `src/pages/Testing.tsx` | PDF-only file input | Out of scope |
| Category 1 import | `src/pages/Category1ImportStaging.tsx` | Spreadsheet file upload | Out of scope |

## Browser capability / capture attribute census

| Surface | `accept` | `capture` | `multiple` | Slot binding | Permission error handling |
| --- | --- | --- | --- | --- | --- |
| `ProductMediaUploader` gallery | `image/*` | — | yes (full mode) | Uses selected `type` state — **not validated against family** | None |
| `ProductMediaUploader` camera | `image/*` | `environment` | no | Same as gallery — **no guided constraints** | None |
| `ProductMediaUploader` video | `video/*` | — | no | Video type only | None |
| `ProductMediaUploader` required-slot upload | `image/*` | — | no | Per-slot `uploadToSlot` — **gallery only, no camera** | None |
| `Media.tsx` gallery | `image/*,video/*` | — | yes | Manual type selector — **no family binding** | None |
| `Media.tsx` camera | `image/*` | `environment` | no | Same type selector | None |
| `FastCreateProduct` hero | `image/*` | — | no | Hero only | None |

## Desktop-only assumptions and bypass risks

| Risk | Location | Point 44 mitigation |
| --- | --- | --- |
| Camera and gallery shown equally without capability gating | `ProductMediaUploader.tsx` | Contract assesses `guidedCameraEligible`; UI wiring deferred |
| Generic file picker where guided capture required | Required-slot buttons use gallery-only | Census gap documented; contract binds slot before acceptance |
| No camera-permission failure handling | All camera inputs | `camera_permission_denied` fail-closed in contract |
| Wrong-slot uploads possible | `type` state vs slot target decoupled | `validateCaptureTargetMatch` + `bindCaptureSlot` fail-closed |
| Ungoverned direct persistence | Upload paths skip guidance | `validateCaptureHandoff` before persistence (adapter ready) |
| EXIF/orientation issues | No client-side normalization | `preserveExifOrientation: true` — original preserved for Point 46 QA |
| Bypass Point 42/43 requirements | URL paste, generic gallery | `silent_fallback_forbidden` on mobile without explicit ack |

## Software capture guidance vs physical quality (boundary)

| Lane | Point 44 owns | Separate points |
| --- | --- | --- |
| Viewport / crop hints | `CAPTURE_VIEWPORT_GUIDANCE` per readiness slot | — |
| Orientation guidance | Portrait/landscape/square per slot | — |
| Benchmark constraints presentation | Point 43 overlay in `buildCaptureGuidance` | — |
| Physical camera quality (focus, lighting hardware) | — | Operator responsibility |
| Photo enhancement | — | **Point 45** |
| QA scoring / approval | — | **Point 46** |
| Output derivatives (resize, WebP, etc.) | — | **Point 47** |

## Guided capture contract (Point 44)

| Domain | Rule | Protected by |
| --- | --- | --- |
| Product identity | `productId` required before slot binding | `product_identity_unresolved` |
| Slot binding | Uploader type must map to family-applicable readiness slot | `unknown_uploader_type`, `unknown_slot` |
| Family chain | Point 42 → Point 43 resolution required | `family_resolution_failed` |
| Camera capability | Secure context + `mediaDevices.getUserMedia` for guided mobile | `camera_capability_unsupported` |
| Camera permission | Denied permission blocks guided capture | `camera_permission_denied` |
| Capture target | Handoff uploader type must match bound slot | `capture_target_mismatch` |
| Fallback policy | Gallery allowed only with explicit ack on mobile | `silent_fallback_forbidden` |
| Pixel fidelity | Original bytes preserved; no retouch/generation | `handoffPolicy.preserveOriginalPixels` |

## Fail-closed policy rules

1. Missing `productId` → `product_identity_unresolved`.
2. Unknown uploader type → `unknown_uploader_type`.
3. Uploader type not applicable to resolved family → `unknown_slot`.
4. Point 42 family resolution failure propagates → `family_resolution_failed`.
5. Mobile + camera eligible + permission denied → `camera_permission_denied`.
6. Handoff uploader type mismatch → `capture_target_mismatch`.
7. Mobile gallery fallback without explicit acknowledgement → `silent_fallback_forbidden`.
8. Non-image MIME at handoff → `unsupported_media_type`.

## Files touched

| File | Change |
| --- | --- |
| `src/features/mediaReadiness/guidedMobileCameraCapture.ts` | **NEW** — Point 44 canonical guided capture contract |
| `src/features/mediaReadiness/guidedMobileCameraCapture.test.ts` | **NEW** — viewport/capability/permission/slot-binding tests |
| `src/features/catalogueAiStudio/catalogueMediaSlots.ts` | Wire `catalogueGuidedMobileCapture*` adapters |
| `src/features/catalogueAiStudio/catalogueMediaSlots.test.ts` | Point 44 adapter wiring tests |
| `src/features/mediaReadiness/controlledPhotographyFamilies.ts` | Update census downstream path for Point 44 |
| `src/features/mediaReadiness/benchmarkPhotographyGovernance.ts` | Update census downstream path for Point 44 |
| `docs/programme/POINT_44_GUIDED_MOBILE_CAMERA_CAPTURE_CENSUS.md` | **NEW** — this census |

## Gate state

| Gate | Status |
| --- | --- |
| Branched from Point 43 #172 head `5f446a0` | **PASS** |
| Guided capture contract implemented | **PASS** |
| Reconciled with Point 42 families + Point 43 benchmarks — no parallel taxonomy | **PASS** |
| Points 45–47 kept separate | **PASS** |
| PR dependent on #167 and #172 | **DRAFT** — await predecessor merges, then rebase |
| Mobile-camera UAT | **NOT CLEARED** — contract + tests only; real device UAT required for stage clearance |
| Merge | **STOP** — await review from `dineshmutrejabackup-cmd` |
