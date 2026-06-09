import { Badge } from "@/components/ui/badge";
import { LIVE_CENTRAL_WRITE_ENABLED } from "@/features/catalogueSnapshot/centralSyncPayload";
import { cn } from "@/lib/utils";

export type AuthorityBadgeKind =
  | "authority_draft"
  | "local_only"
  | "not_synced_to_central"
  | "central_live_write_disabled";

const BADGE_META: Record<
  AuthorityBadgeKind,
  { label: string; className: string; title: string }
> = {
  authority_draft: {
    label: "AUTHORITY DRAFT",
    className: "bg-amber-500/15 text-amber-800 border-amber-500/30 dark:text-amber-200",
    title: "Changes are draft submissions or unsaved form state — not canonical master data.",
  },
  local_only: {
    label: "LOCAL ONLY",
    className: "bg-orange-500/15 text-orange-900 border-orange-500/30 dark:text-orange-200",
    title: "Data is stored in this browser only and is not authoritative for Oasis Central.",
  },
  not_synced_to_central: {
    label: "NOT SYNCED TO CENTRAL",
    className: "bg-sky-500/15 text-sky-900 border-sky-500/30 dark:text-sky-200",
    title: "Snapshot or preview exists locally; Oasis Central has not received this version.",
  },
  central_live_write_disabled: {
    label: "CENTRAL LIVE WRITE DISABLED",
    className: "bg-muted text-muted-foreground border-border",
    title: "Outbound sync to Oasis Central is intentionally disabled in this build.",
  },
};

type Props = {
  show?: Partial<Record<AuthorityBadgeKind, boolean>>;
  className?: string;
};

export function AuthorityStatusBadges({ show, className }: Props) {
  const flags: Record<AuthorityBadgeKind, boolean> = {
    authority_draft: show?.authority_draft ?? false,
    local_only: show?.local_only ?? false,
    not_synced_to_central: show?.not_synced_to_central ?? false,
    central_live_write_disabled:
      show?.central_live_write_disabled ?? !LIVE_CENTRAL_WRITE_ENABLED,
  };

  const visible = (Object.entries(flags) as [AuthorityBadgeKind, boolean][]).filter(
    ([, on]) => on,
  );

  if (!visible.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {visible.map(([kind]) => {
        const meta = BADGE_META[kind];
        return (
          <Badge
            key={kind}
            variant="outline"
            className={cn("text-[10px] font-semibold tracking-wide", meta.className)}
            title={meta.title}
          >
            {meta.label}
          </Badge>
        );
      })}
    </div>
  );
}

export function CentralSyncReadOnlyBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-muted/40 p-3 space-y-2",
        className,
      )}
    >
      <AuthorityStatusBadges
        show={{
          central_live_write_disabled: true,
          not_synced_to_central: true,
        }}
      />
      <p className="text-sm text-muted-foreground">
        <strong className="text-foreground">Central Sync Preview — read-only.</strong>{" "}
        Generate and export preview JSON for review. No outbound POST, webhook, or live write
        to Oasis Central is performed from this app.
      </p>
    </div>
  );
}
