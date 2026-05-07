import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FeatureFlag = {
  feature_key: string;
  feature_name: string;
  description: string | null;
  status: "planned" | "configured" | "test_passed" | "enabled" | "disabled" | "error";
  is_visible: boolean;
  is_enabled: boolean;
  required_role: string[];
  setup_notes: string | null;
  last_tested_at: string | null;
  last_test_result: string | null;
};

let cache: FeatureFlag[] | null = null;
const subs = new Set<(f: FeatureFlag[]) => void>();

async function loadAll(): Promise<FeatureFlag[]> {
  const { data, error } = await supabase.from("feature_flags").select("*");
  if (error) {
    console.warn("[feature_flags] load failed", error.message);
    return [];
  }
  cache = (data ?? []) as FeatureFlag[];
  subs.forEach((cb) => cb(cache!));
  return cache;
}

export function refreshFeatureFlags() { return loadAll(); }

export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);
  useEffect(() => {
    const cb = (f: FeatureFlag[]) => setFlags(f);
    subs.add(cb);
    if (!cache) loadAll().finally(() => setLoading(false));
    else setLoading(false);
    return () => { subs.delete(cb); };
  }, []);
  const refresh = useCallback(async () => { setLoading(true); await loadAll(); setLoading(false); }, []);
  return { flags, loading, refresh };
}

export function useFeatureFlag(key: string) {
  const { flags, loading } = useFeatureFlags();
  const flag = flags.find((f) => f.feature_key === key) ?? null;
  return {
    flag,
    loading,
    isEnabled: !!flag?.is_enabled,
    isVisible: !!flag?.is_visible,
  };
}
