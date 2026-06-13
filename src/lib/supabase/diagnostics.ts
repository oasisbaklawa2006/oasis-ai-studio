import {
  LIVE_CENTRAL_MIGRATION_PRODUCT_MEDIA_AND_BOM,
  LIVE_CENTRAL_SUPABASE_PROJECT_REF,
} from "@/features/productAuthority/liveProductsSchema";

export type SupabaseFailureKind =
  | "missing_table"
  | "missing_column"
  | "missing_rpc"
  | "rls_denied"
  | "bucket_missing"
  | "auth"
  | "network"
  | "config"
  | "unknown";

export type SupabaseFailure = {
  kind: SupabaseFailureKind;
  message: string;
  code?: string;
  hint?: string;
  ownerAction?: string;
  table?: string;
  field?: string;
  bucket?: string;
};

type PostgrestLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function errorMessage(error: PostgrestLikeError | null | undefined): string {
  if (!error) return "";
  return [error.message, error.details, error.hint].filter(Boolean).join(" — ");
}

export function diagnoseSupabaseFailure(
  error: PostgrestLikeError | null | undefined,
  context: string,
): SupabaseFailure | null {
  if (!error) return null;

  const code = error.code ?? "";
  const message = errorMessage(error) || "Unknown Supabase error";
  const hint = error.hint;
  const lower = message.toLowerCase();

  const columnMatch = message.match(/Could not find the '([^']+)' column.*'([^']+)'/i);
  if (code === "PGRST204" || columnMatch) {
    const field = columnMatch?.[1];
    const table = columnMatch?.[2] ?? "products";
    let ownerAction = "Verify live schema contract in liveProductsSchema.ts.";
    if (field && /_price|price_basis/i.test(field)) {
      ownerAction =
        "Channel pricing and price basis belong on product_pricing_rules, not products.";
    } else if (field === "bom_required") {
      ownerAction =
        "Apply migration 20260613130000_live_central_product_media_bucket_and_bom_required on live Central (tcxvcatsqqertcnycuop).";
    }
    return {
      kind: "missing_column",
      code,
      message,
      hint,
      field,
      table,
      ownerAction,
    };
  }

  if (
    code === "42P01" ||
    lower.includes("does not exist") ||
    (lower.includes("could not find the table") && !columnMatch) ||
    (lower.includes("schema cache") && lower.includes("table"))
  ) {
    const tableMatch = message.match(/'([^']+)'/);
    return {
      kind: "missing_table",
      code,
      message,
      hint,
      table: tableMatch?.[1],
      ownerAction: "Apply the required Supabase migration for this table/view.",
    };
  }

  if (
    lower.includes("could not find the function") ||
    lower.includes("function") && lower.includes("does not exist") ||
    code === "PGRST202"
  ) {
    const rpcMatch = message.match(/function\s+([^\s(]+)/i);
    return {
      kind: "missing_rpc",
      code,
      message,
      hint,
      field: rpcMatch?.[1],
      ownerAction: "Deploy the required RPC in Supabase before retrying.",
    };
  }

  if (
    code === "42501" ||
    lower.includes("permission denied") ||
    lower.includes("row-level security") ||
    lower.includes("violates row-level security")
  ) {
    return {
      kind: "rls_denied",
      code,
      message,
      hint,
      ownerAction: "Confirm authenticated user role and RLS policies for this table.",
    };
  }

  if (lower.includes("bucket not found") || lower.includes("storage bucket")) {
    const bucketMatch = message.match(/bucket[^'"]*['"]([^'"]+)['"]/i);
    return {
      kind: "bucket_missing",
      code,
      message,
      hint,
      bucket: bucketMatch?.[1] ?? "product-media",
      ownerAction: `Apply migration ${LIVE_CENTRAL_MIGRATION_PRODUCT_MEDIA_AND_BOM} on live Central (${LIVE_CENTRAL_SUPABASE_PROJECT_REF}).`,
    };
  }

  if (code === "PGRST301" || lower.includes("jwt") || lower.includes("not authenticated")) {
    return {
      kind: "auth",
      code,
      message,
      hint,
      ownerAction: "Sign in again. Verify Vercel env vars match Central Supabase anon key.",
    };
  }

  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("load failed")
  ) {
    return {
      kind: "network",
      code,
      message,
      hint,
      ownerAction: "Check browser network tab and Supabase project status.",
    };
  }

  return {
    kind: "unknown",
    code,
    message: `${context}: ${message}`,
    hint,
    ownerAction: "Check browser console and Supabase logs for this query.",
  };
}

function withOwnerAction(message: string, ownerAction?: string): string {
  if (!ownerAction) return message;
  return `${message} → ${ownerAction}`;
}

export function formatSupabaseFailure(failure: SupabaseFailure): string {
  switch (failure.kind) {
    case "missing_column":
      return withOwnerAction(
        `Live schema mismatch: field ${failure.field ?? "unknown"} is not present on ${failure.table ?? "table"}.`,
        failure.ownerAction,
      );
    case "missing_table":
      return withOwnerAction(
        `Required table/view is missing or not deployed: ${failure.table ?? "unknown"}.`,
        failure.ownerAction,
      );
    case "missing_rpc":
      return withOwnerAction(
        `Required RPC is missing or not deployed: ${failure.field ?? "unknown"}.`,
        failure.ownerAction,
      );
    case "rls_denied":
      return "Permission/RLS blocked this action.";
    case "bucket_missing":
      return withOwnerAction(
        `Storage bucket "${failure.bucket ?? "unknown"}" is missing or inaccessible.`,
        failure.ownerAction,
      );
    case "network":
      return "Supabase network connection failed.";
    case "auth":
      return "Supabase session/auth is missing or expired.";
    default:
      break;
  }

  const parts = [failure.message];
  if (failure.code) parts.push(`(code ${failure.code})`);
  if (failure.ownerAction) parts.push(`→ ${failure.ownerAction}`);
  return parts.join(" ");
}

/**
 * User-facing diagnostic for Supabase/PostgREST/storage errors.
 * Prefer this over generic connectivity messages when queries return structured errors.
 */
export function formatSupabaseDiagnostic(error: unknown, context: string): string {
  if (!error) return `${context} failed.`;

  if (typeof error === "object" && error !== null && "kind" in error) {
    return formatSupabaseFailure(error as SupabaseFailure);
  }

  const failure = diagnoseSupabaseFailure(error as PostgrestLikeError, context);
  if (!failure) return `${context} failed.`;

  if (failure.kind === "unknown" && context.toLowerCase().includes("catalogue versions")) {
    return `${context} failed. This may be caused by a missing table, RLS policy, or deployment mismatch. Supabase itself is reachable.`;
  }

  const formatted = formatSupabaseFailure(failure);

  if (/duplicate key.*uq_product_pricing_rules_product_channel|uq_price_rule_product_channel/i.test(failure.message)) {
    return "Pricing for this channel already exists. Updating existing row.";
  }

  return formatted;
}
