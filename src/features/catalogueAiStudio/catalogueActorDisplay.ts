/**
 * Resolves the raw actor_id / created_by / reviewed_by UUIDs stored on catalogue AI-Studio
 * drafts and audit rows into human-readable labels, using the existing `profiles` table
 * (read-only — no new table, no migration). Without this, the governance workflow and audit
 * trail only ever show opaque UUIDs, which defeats the point of showing "who approved/rejected
 * this and when" at all.
 */
import { supabase } from "@/integrations/supabase/client";

export type ActorProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

/** Pure — picks the best available label for a resolved profile, falling back to a short id. */
export function formatActorLabel(profile: ActorProfile | undefined, actorId: string): string {
  if (profile?.full_name) return profile.full_name;
  if (profile?.email) return profile.email;
  return `${actorId.slice(0, 8)}…`;
}

/** Fetches display labels for a set of actor ids in one query. Never throws — a lookup failure
 * (e.g. RLS denies reading another user's profile) degrades to short-id labels, not an error. */
export async function fetchActorLabels(actorIds: Array<string | null | undefined>): Promise<Record<string, string>> {
  const ids = Array.from(new Set(actorIds.filter((id): id is string => Boolean(id))));
  if (ids.length === 0) return {};

  try {
    const { data, error } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    if (error) throw error;
    const byId = new Map((data ?? []).map((p) => [p.id, p as ActorProfile]));
    const labels: Record<string, string> = {};
    for (const id of ids) {
      labels[id] = formatActorLabel(byId.get(id), id);
    }
    return labels;
  } catch {
    const labels: Record<string, string> = {};
    for (const id of ids) labels[id] = formatActorLabel(undefined, id);
    return labels;
  }
}
