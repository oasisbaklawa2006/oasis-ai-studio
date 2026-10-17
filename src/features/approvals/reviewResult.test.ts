import { expect, it } from "vitest";
import { validateReviewResult } from "./reviewResult";

const expected = {
  action: "approved",
  draftId: "fixture",
  draftTable: "catalogue_media_submissions",
} as const;
const good = {
  ok: true,
  action: expected.action,
  draft_id: expected.draftId,
  draft_table: expected.draftTable,
};
it.each([
  null,
  undefined,
  {},
  [],
  { ok: false, message: "Approval mapping not finalized" },
  { ...good, draft_id: "other" },
  { ...good, draft_table: "other" },
  { ...good, action: "rejected" },
])("never reports success for malformed, denied or mismatched outcome %j", (data) => {
  expect(validateReviewResult(data, expected).ok).toBe(false);
});
it("requires affirmative result with matching action and identity", () => {
  expect(validateReviewResult(good, expected).ok).toBe(true);
});
