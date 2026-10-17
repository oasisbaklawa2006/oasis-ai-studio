/** Core review RPCs return JSON outcomes even when HTTP/PostgREST succeeded. */
export function validateReviewResult(
  data: unknown,
  expected: { action: "approved" | "rejected"; draftId: string; draftTable: string },
): { ok: boolean; message: string } {
  if (!data || typeof data !== "object" || Array.isArray(data))
    return {
      ok: false,
      message: "Review outcome could not be confirmed. Refresh before retrying.",
    };
  const row = data as Record<string, unknown>;
  if (row.ok !== true)
    return {
      ok: false,
      message:
        typeof row.message === "string"
          ? row.message
          : "Review was not completed. Refresh before retrying.",
    };
  if (
    row.action !== expected.action ||
    row.draft_id !== expected.draftId ||
    row.draft_table !== expected.draftTable
  )
    return {
      ok: false,
      message: "Review response did not match this submission. Refresh before retrying.",
    };
  return { ok: true, message: expected.action === "approved" ? "Approved" : "Rejected" };
}
