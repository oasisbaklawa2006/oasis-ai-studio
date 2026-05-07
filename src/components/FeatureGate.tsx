import { Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import { useAuth } from "@/contexts/AuthContext";
import { ReactNode } from "react";

interface Props {
  featureKey: string;
  children: ReactNode;
  /** Show a locked card to owner/admin instead of nothing. Defaults true. */
  showLockedToAdmin?: boolean;
  /** When the feature is not enabled, render nothing for everyone. */
  hideWhenInactive?: boolean;
  /** Compact inline lock badge instead of full card. */
  compact?: boolean;
  label?: string;
}

export function FeatureGate({ featureKey, children, showLockedToAdmin = true, hideWhenInactive, compact, label }: Props) {
  const { flag, loading } = useFeatureFlag(featureKey);
  const { roles } = useAuth();
  if (loading) return null;
  const isAdmin = roles.includes("owner") || roles.includes("admin");
  if (flag?.is_enabled) return <>{children}</>;

  if (hideWhenInactive && !isAdmin) return null;
  if (!isAdmin) {
    if (!flag?.is_visible) return null;
    // Visible but not enabled → show locked state to all team members
  } else if (!showLockedToAdmin) {
    return null;
  }

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground border border-dashed rounded px-2 py-1">
        <Lock className="h-3 w-3" /> {label ?? flag?.feature_name ?? "Feature"} — not activated
      </span>
    );
  }

  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm space-y-1">
      <div className="flex items-center gap-2 font-medium">
        <Lock className="h-4 w-4" /> {label ?? flag?.feature_name ?? "Feature"} — not activated yet
      </div>
      <p className="text-xs text-muted-foreground">
        Configure this from the{" "}
        <Link to="/settings" className="underline">Future Features Activation Center</Link>.
      </p>
    </div>
  );
}
