type PricingPayload = Record<string, unknown> | null | undefined;

const NESTED_PATH_SEGMENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const nestedRead = (payload: PricingPayload, path: string) => {
  if (!payload) return undefined;
  let current: unknown = payload;
  for (const key of path.split(".")) {
    if (!NESTED_PATH_SEGMENT.test(key)) return undefined;
    if (!current || typeof current !== "object") return undefined;
    const record = current as Record<string, unknown>;
    if (!Object.hasOwn(record, key)) return undefined;
    current = Reflect.get(record, key);
  }
  return current;
};

export const formatPricing = (payload: PricingPayload) => {
  const displayValue = (value: unknown): string | null =>
    typeof value === "string" && value.trim()
      ? value.trim()
      : typeof value === "number" && Number.isFinite(value)
        ? String(value)
        : null;

  const fields = [
    ["MRP", "pricing.mrp"],
    ["B2B", "pricing.b2b_price"],
    ["Export", "pricing.export_price"],
    ["GST", "pricing.gst_rate"],
  ] as const;
  const lines = fields.flatMap(([label, path]) => {
    const value = displayValue(nestedRead(payload, path));
    return value === null ? [] : [`${label}: ${value}`];
  });
  if (lines.length) return lines.join(" • ");

  return displayValue(nestedRead(payload, "pricing")) ?? "—";
};
