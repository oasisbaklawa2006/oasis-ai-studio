/**
 * Assembles plain text from an oasis-ai-chat SSE stream (data: {...} lines + data: [DONE]).
 * Falls back to raw trimmed text when no stream lines are present — never throws.
 */
export function parseChatCompletionStreamText(raw: string): string {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const dataLines = lines.filter((l) => l.startsWith("data:"));
  if (dataLines.length === 0) return raw.trim();

  let assembled = "";
  for (const line of dataLines) {
    const payload = line.slice("data:".length).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const parsed = JSON.parse(payload);
      const delta = parsed?.choices?.[0]?.delta?.content;
      if (typeof delta === "string") assembled += delta;
    } catch {
      // Malformed chunk — skip rather than abort the whole response.
    }
  }
  return assembled.trim();
}
