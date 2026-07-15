import { useCallback, useEffect, useState } from "react";
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
let capabilityUnavailable = false;
const subs = new Set<(f: FeatureFlag[]) => void>();

async function loadAll(): Promise<FeatureFlag[]> {
  if (capabilityUnavailable) return cache ?? [];
  const { data, error } = await supabase.from("feature_flags").select("*");
  if (error) {
    // Production does not currently expose this optional capability. Cache that
    // state for the lifetime of the SPA so every page does not repeat the same
    // failing request. Settings continues to show the capability as unavailable.
    capabilityUnavailable = true;
    const unavailableFlags: FeatureFlag[] = [];
    cache = unavailableFlags;
    console.warn("[feature_flags] load failed", error.message);
    subs.forEach((cb) => {
      cb(unavailableFlags);
    });
    return unavailableFlags;
  }
  const loadedFlags = (data ?? []) as FeatureFlag[];
  cache = loadedFlags;
  subs.forEach((cb) => {
    cb(loadedFlags);
  });
  return loadedFlags;
}

export function refreshFeatureFlags() {
  return loadAll();
}

export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);
  useEffect(() => {
    const cb = (f: FeatureFlag[]) => setFlags(f);
    subs.add(cb);
    if (!cache) loadAll().finally(() => setLoading(false));
    else setLoading(false);
    return () => {
      subs.delete(cb);
    };
  }, []);
  const refresh = useCallback(async () => {
    setLoading(true);
    await loadAll();
    setLoading(false);
  }, []);
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
