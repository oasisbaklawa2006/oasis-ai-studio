import { useCallback, useEffect, useState } from "react";

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
  // The canonical production project has no feature_flags table. Do not issue
  // a knowingly invalid request on every full page load. All optional features
  // remain safely disabled until a governed backend capability is approved.
  const loadedFlags: FeatureFlag[] = [];
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
