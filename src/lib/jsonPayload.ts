import type { Json } from "@/integrations/supabase/types";

/** Serialize exactly the JSON representation sent to Core, without widening SDK types. */
export function jsonPayload(value: unknown): Json {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("Payload is not JSON serializable.");
  return JSON.parse(serialized) as Json;
}
