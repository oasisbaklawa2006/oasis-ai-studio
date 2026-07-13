# QA Test 05 - Staging Functional Workflows

## Objective

Run mutating lifecycle tests only in staging/preview disposable environments.

## Required Preconditions

- Environment is not production.
- Autonoma factory setup is complete.
- Test credentials are approved.
- Disposable test data can be created and torn down.

## Workflows

1. Create disposable product through factory or Fast Create.
2. Open in Full Product Editor.
3. Edit safe fields.
4. Verify validation blocks incomplete required fields.
5. Upload/replace/remove media only if test storage is disposable.
6. Create catalogue draft content.
7. Save draft.
8. Submit for review.
9. Reject with reason.
10. Correct and resubmit.
11. Approve using reviewer role.
12. Verify audit trail.
13. Verify unauthorized roles cannot perform governed actions.
14. Tear down created records.

## Failures

- mutations happen without audit
- unauthorized write succeeds
- teardown leaves records
- approval changes product master without governed snapshot
