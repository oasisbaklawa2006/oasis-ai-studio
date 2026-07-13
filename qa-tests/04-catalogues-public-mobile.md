# QA Test 04 - Catalogues, Public Links, And Mobile

## Objective

Verify catalogue surfaces and mobile usability without unsafe mutation.

## Steps

1. Open `/catalogues`.
2. Open any existing catalogue detail safely.
3. Open `/admin/catalogue-builder` and inspect without saving.
4. Open public route `/c/:slug` for any available public catalogue.
5. Test desktop viewport `1440x900`.
6. Test mobile viewport `390x844`.
7. Check overflow, clipping, hidden controls, obstructed sticky bars, tap targets, and unreadable text.
8. Capture console errors and failed requests for each route.

## Failures

- public link blank or broken
- catalogue builder appears editable in production without guardrails
- mobile horizontal overflow
- product cards lose price/packaging/media truth
