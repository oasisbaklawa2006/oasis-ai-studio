import type { SuggestionAuditEvent, SuggestionAuditAction } from "./types";

const AUDIT_KEY = "oasis_operator_suggestion_audit_v1";

function readLog(): SuggestionAuditEvent[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(AUDIT_KEY) ?? "[]") as SuggestionAuditEvent[];
  } catch {
    return [];
  }
}

function writeLog(events: SuggestionAuditEvent[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(AUDIT_KEY, JSON.stringify(events.slice(0, 200)));
}

export function appendSuggestionAudit(input: {
  message_id: string;
  utterance: string;
  action: SuggestionAuditAction;
  sku: string | null;
  product_name: string | null;
  confidence_band: string | null;
}): SuggestionAuditEvent {
  const event: SuggestionAuditEvent = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...input,
  };
  writeLog([event, ...readLog()]);
  return event;
}

export function getSuggestionAuditLog(): SuggestionAuditEvent[] {
  return readLog();
}

/** Test helper */
export function clearSuggestionAuditLog(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(AUDIT_KEY);
}
