/** Studio #272 contract — Core is canonical. UI never writes users/roles directly. */
import { supabase } from "@/integrations/supabase/client";

export const STUDIO_PROFILES = [
  { key: "studio_admin", label: "AI Studio Manager" },
  { key: "product_editor", label: "Product Creator / Editor" },
  { key: "quality_controller", label: "Product Quality Controller" },
  { key: "product_pricing_manager", label: "Product & Pricing Manager" },
  { key: "channel_pricing_manager", label: "Channel / Customer Pricing Manager" },
  { key: "catalogue_specialist", label: "AI Catalogue Specialist" },
  { key: "catalogue_distribution", label: "Catalogue Distribution / Marketing" },
  { key: "viewer", label: "Product / Catalogue Viewer" },
] as const;

export const STUDIO_PERMISSIONS = [
  "ai_studio.products.read",
  "ai_studio.products.create",
  "ai_studio.products.update",
  "ai_studio.products.review",
  "ai_studio.media.manage",
  "ai_studio.catalogues.view",
  "ai_studio.catalogues.build",
  "ai_studio.catalogues.review",
  "ai_studio.catalogues.distribute",
  "ai_studio.pricing.propose",
  "ai_studio.pricing.select_approved",
  "ai_studio.ai.use",
  "ai_studio.settings.manage",
  "ai_studio.users.manage",
  "ai_studio.audit.read",
] as const;

export type StudioAccessStatus =
  | "pending_approval"
  | "active"
  | "suspended"
  | "revoked"
  | "rejected";
export const STUDIO_ACCESS_STATUSES: readonly StudioAccessStatus[] = [
  "pending_approval",
  "active",
  "suspended",
  "revoked",
  "rejected",
];

export type StudioAccessRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  core_active: boolean;
  invite_status: string | null;
  studio_status: string;
  profile_keys: string[];
  overrides: Record<string, boolean>;
  version: number;
};

export function parseStudioAccessRow(raw: unknown): StudioAccessRow | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.user_id !== "string" || !item.user_id) return null;
  const overrides: Record<string, boolean> = {};
  if (item.overrides && typeof item.overrides === "object" && !Array.isArray(item.overrides)) {
    for (const [key, value] of Object.entries(item.overrides)) {
      if ((STUDIO_PERMISSIONS as readonly string[]).includes(key) && typeof value === "boolean") {
        overrides[key] = value;
      }
    }
  }
  return {
    user_id: item.user_id,
    email: typeof item.email === "string" ? item.email : null,
    display_name: typeof item.display_name === "string" ? item.display_name : null,
    core_active: item.core_active === true,
    invite_status: typeof item.invite_status === "string" ? item.invite_status : null,
    studio_status: typeof item.studio_status === "string" ? item.studio_status : "not_assigned",
    profile_keys: Array.isArray(item.profile_keys)
      ? item.profile_keys.filter((value): value is string => typeof value === "string")
      : [],
    overrides,
    version: typeof item.version === "number" && Number.isInteger(item.version) ? item.version : 0,
  };
}

type StudioRpc = (
  name: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

// Bridge pending Core database type regeneration. Runtime endpoint and RLS/RPC
// enforce all authority, including pending/suspended identities and AAL2.
const studioRpc = supabase.rpc as unknown as StudioRpc;

export async function readStudioAccessDirectory(): Promise<StudioAccessRow[]> {
  const authority = await studioRpc("can_manage_ai_studio_access_v1");
  if (authority.error) throw new Error("Studio access backend is not configured or available.");
  if (authority.data !== true)
    throw new Error("Access denied: Studio access management permission required.");
  const result = await studioRpc("list_ai_studio_access_v1");
  if (result.error) throw new Error(result.error.message);
  if (!Array.isArray(result.data)) throw new Error("Invalid Studio access directory response.");
  return result.data.map(parseStudioAccessRow).filter((x): x is StudioAccessRow => x !== null);
}

export async function setStudioAccess(input: {
  userId: string;
  status: StudioAccessStatus;
  profiles: string[];
  overrides: Record<string, boolean>;
  reason: string;
  expectedVersion: number;
}): Promise<void> {
  if (input.reason.trim().length < 8)
    throw new Error("An audit reason of at least eight characters is required.");
  if (!STUDIO_ACCESS_STATUSES.includes(input.status)) throw new Error("Invalid access status.");
  if (input.profiles.some((x) => !STUDIO_PROFILES.some((p) => p.key === x))) {
    throw new Error("Owner and unknown profiles cannot be assigned here.");
  }
  if (
    Object.keys(input.overrides).some((x) => !(STUDIO_PERMISSIONS as readonly string[]).includes(x))
  ) {
    throw new Error("Unknown permission override.");
  }
  if (input.status === "active" && input.profiles.length === 0) {
    throw new Error("An active user must have at least one Studio profile.");
  }
  const { error } = await studioRpc("set_ai_studio_access_v1", {
    p_user_id: input.userId,
    p_status: input.status,
    p_profiles: input.profiles,
    p_overrides: input.overrides,
    p_reason: input.reason.trim(),
    p_expected_version: input.expectedVersion,
  });
  if (error) throw new Error(error.message);
}
