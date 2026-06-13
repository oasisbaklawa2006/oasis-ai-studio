import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isCatalogueReviewer } from "@/shared/auth/centralPermissions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  blockPilotApprovalMessage,
  isDraftSku,
  isStructuredOasisSku,
} from "@/features/productAuthority/skuGuard";

type ApprovalStatus = "pending_approval" | "approved" | "rejected";

type ApprovalItem = {
  id: string;
  status: ApprovalStatus;
  payload?: Record<string, any> | null;
  operation?: string | null;
  submitted_at?: string | null;
  submitted_by?: string | null;
  submitter_name?: string | null;
  submitter_email?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  target_record_id?: string | null;
  draftType: string;
  approveFn: string;
  rejectFn: string;
};

const SOURCES = [
  { type: "product", table: "catalogue_product_drafts", approve: "approve_catalogue_product_draft", reject: "reject_catalogue_product_draft" },
  { type: "media", table: "catalogue_media_submissions", approve: "approve_catalogue_media_submission", reject: "reject_catalogue_media_submission" },
  { type: "alias", table: "catalogue_alias_drafts", approve: "approve_catalogue_alias_draft", reject: "reject_catalogue_alias_draft" },
  { type: "bom", table: "catalogue_bom_drafts", approve: "approve_catalogue_bom_draft", reject: "reject_catalogue_bom_draft" },
  { type: "moq", table: "catalogue_moq_drafts", approve: "approve_catalogue_moq_draft", reject: "reject_catalogue_moq_draft" },
  { type: "pricing", table: "catalogue_pricing_drafts", approve: "approve_catalogue_pricing_draft", reject: "reject_catalogue_pricing_draft" },
  { type: "tag", table: "catalogue_tag_drafts", approve: "approve_catalogue_tag_draft", reject: "reject_catalogue_tag_draft" },
] as const;

const TABS = [
  { key: "pending_approval", label: "Awaiting Approval" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejection Bin" },
] as const;

/** Fallback labels when payload has no `needs_admin_review_flags` (main inbox behavior). */
const FLAG_CHIPS = ["SKU", "Pricing", "Nutrition", "Compliance", "BOM", "MOQ", "Department"];

const getSubmittedBy = (item: ApprovalItem) => item.submitter_name || item.submitter_email || item.submitted_by || "Unknown";

const formatAge = (dateStr?: string | null) => {
  if (!dateStr) return "Submitted recently";
  const ms = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.max(1, Math.floor(ms / 60000));
  if (minutes < 60) return `Submitted ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Submitted ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `Submitted ${days} day${days === 1 ? "" : "s"} ago`;
};

const nestedRead = (payload: Record<string, any> | null | undefined, path: string) => {
  if (!payload) return undefined;
  return path.split(".").reduce<any>((acc, key) => (acc == null ? undefined : acc[key]), payload);
};

const read = (payload: Record<string, any> | null | undefined, ...paths: string[]) => {
  for (const path of paths) {
    const value = nestedRead(payload, path);
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  return "—";
};

const formatProductMoq = (payload: Record<string, any> | null | undefined) => {
  const moqValue = nestedRead(payload, "moq.moq_value");
  const moqUom = nestedRead(payload, "moq.moq_uom");
  const incValue = nestedRead(payload, "moq.increment_value");
  const incUom = nestedRead(payload, "moq.increment_uom");

  const base = [moqValue, moqUom].filter((v) => v !== undefined && v !== null && v !== "").join(" ");
  const increment = [incValue, incUom].filter((v) => v !== undefined && v !== null && v !== "").join(" ");

  if (!base && !increment) {
    const legacy = read(payload, "moq");
    return legacy !== "—" ? legacy : "—";
  }
  if (!increment) return base;
  return `${base}, increment ${increment}`;
};

const formatPricing = (payload: Record<string, any> | null | undefined) => {
  const mrp = nestedRead(payload, "pricing.mrp");
  const b2b = nestedRead(payload, "pricing.b2b_price");
  const exportPrice = nestedRead(payload, "pricing.export_price");
  const gst = nestedRead(payload, "pricing.gst_rate");

  const lines = [
    mrp !== undefined && mrp !== null && mrp !== "" ? `MRP: ${mrp}` : null,
    b2b !== undefined && b2b !== null && b2b !== "" ? `B2B: ${b2b}` : null,
    exportPrice !== undefined && exportPrice !== null && exportPrice !== "" ? `Export: ${exportPrice}` : null,
    gst !== undefined && gst !== null && gst !== "" ? `GST: ${gst}` : null,
  ].filter(Boolean);

  if (lines.length) return lines.join(" • ");
  const legacy = read(payload, "pricing");
  return legacy !== "—" ? legacy : "—";
};

const formatBom = (payload: Record<string, any> | null | undefined) => {
  const required = nestedRead(payload, "bom.required");
  const expectedType = nestedRead(payload, "bom.expected_type");
  const requiredText = required === true ? "Required" : required === false ? "Not required" : null;
  if (requiredText && expectedType) return `${requiredText} (${expectedType})`;
  if (requiredText) return requiredText;
  if (expectedType) return String(expectedType);

  const legacyRequired = read(payload, "bom_required");
  const legacyType = read(payload, "expected_bom_type");
  if (legacyRequired !== "—" || legacyType !== "—") {
    return [legacyRequired !== "—" ? legacyRequired : null, legacyType !== "—" ? legacyType : null].filter(Boolean).join(" · ");
  }
  return "—";
};

const getReviewFlags = (payload: Record<string, any> | null | undefined) => {
  const flags = nestedRead(payload, "needs_admin_review_flags");
  if (!flags || typeof flags !== "object") return [];
  return Object.entries(flags)
    .filter(([, enabled]) => enabled === true)
    .map(([key]) => key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
};

const getDisplayReviewFlags = (payload: Record<string, any> | null | undefined) => {
  const dynamic = getReviewFlags(payload);
  return dynamic.length > 0 ? dynamic : FLAG_CHIPS;
};

export default function ApprovalInbox() {
  const [allowed, setAllowed] = useState(false);
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<ApprovalStatus>("pending_approval");

  const load = async () => {
    const all: ApprovalItem[] = [];
    for (const s of SOURCES) {
      const { data } = await (supabase as any)
        .from(s.table)
        .select("*")
        .in("status", ["pending_approval", "approved", "rejected"])
        .order("submitted_at", { ascending: false });

      (data ?? []).forEach((d: any) => all.push({ ...d, draftType: s.type, approveFn: s.approve, rejectFn: s.reject }));
    }
    setItems(all);
  };

  useEffect(() => {
    (async () => {
      const ok = await isCatalogueReviewer();
      setAllowed(ok);
      if (ok) load();
    })();
  }, []);

  const groupedByStatus = useMemo(() => {
    return {
      pending_approval: items.filter((i) => i.status === "pending_approval"),
      approved: items.filter((i) => i.status === "approved"),
      rejected: items.filter((i) => i.status === "rejected"),
    };
  }, [items]);

  const approve = async (r: ApprovalItem) => {
    if (r.draftType === "product") {
      const sku =
        read(r.payload, "sku_draft.sku", "identity.sku", "sku") ??
        read(r.payload, "sku_draft", "sku");
      const skuStr = typeof sku === "string" ? sku : null;
      if (isDraftSku(skuStr)) {
        const msg = blockPilotApprovalMessage(skuStr) ?? "DRAFT-* SKU cannot be approved.";
        toast.error(msg);
        return;
      }
      if (skuStr && !isStructuredOasisSku(skuStr)) {
        toast.error("Product approval blocked: assign structured OAS SKU before approve.");
        return;
      }
    }

    const { error } = await (supabase as any).rpc(r.approveFn, { draft_id: r.id });
    if (error) {
      if (/not finalized/i.test(error.message)) toast.warning(error.message);
      else toast.error(error.message);
      return;
    }
    toast.success("Approved");
    load();
  };

  const reject = async (r: ApprovalItem) => {
    const reason = (reasons[r.id] || "").trim();
    if (!reason) {
      toast.error("Rejection reason is required");
      return;
    }
    const { error } = await (supabase as any).rpc(r.rejectFn, { draft_id: r.id, reason });
    if (error) return toast.error(error.message);
    toast.success("Rejected");
    setReasons((x) => ({ ...x, [r.id]: "" }));
    load();
  };

  if (!allowed) return <div className="p-4 text-sm">Approval inbox is restricted to catalogue reviewers.</div>;

  const currentItems = groupedByStatus[activeTab];

  return (
    <>
      <PageHeader title="Approval Inbox" subtitle="Review desk for pending, approved, and rejected drafts" />

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const count = groupedByStatus[tab.key].length;
            const isActive = activeTab === tab.key;
            return (
              <Button key={tab.key} variant={isActive ? "default" : "outline"} className="rounded-full" onClick={() => setActiveTab(tab.key)}>
                {tab.label} ({count})
              </Button>
            );
          })}
        </div>

        <div className="space-y-4">
          {currentItems.length === 0 && (
            <div className="catalogue-empty py-10">
              <p className="catalogue-empty-text">No items in this section.</p>
            </div>
          )}

          {currentItems.map((r) => {
            const isPending = r.status === "pending_approval";
            const isApproved = r.status === "approved";
            const isRejected = r.status === "rejected";
            const reviewFlags = getDisplayReviewFlags(r.payload);
            const flagsFromPayload = getReviewFlags(r.payload).length > 0;

            return (
              <div key={`${r.draftType}-${r.id}`} className="luxe-panel space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <div className="font-semibold capitalize text-foreground">{r.draftType} draft · {r.operation || "update"}</div>
                    <div className="text-muted-foreground">Target: {r.target_record_id || "(new)"}</div>
                  </div>

                  {isPending && <span className="badge-soft catalogue-status-review">Awaiting approval</span>}
                  {isApproved && <span className="badge-soft catalogue-status-published">Approved</span>}
                  {isRejected && <span className="badge-soft bg-destructive/10 text-destructive border border-destructive/20">Rejected</span>}
                </div>

                <div className="text-sm text-muted-foreground space-y-1">
                  <div>{formatAge(r.submitted_at)}</div>
                  <div>Submitted by: {getSubmittedBy(r)}</div>
                  {isRejected && <div className="text-destructive font-medium">Reason: {r.rejection_reason || "No reason provided"}</div>}
                  {isRejected && r.rejected_at && <div>Rejected at: {new Date(r.rejected_at).toLocaleString()}</div>}
                </div>

                {r.draftType === "product" ? (
                  <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 text-sm space-y-2">
                    <div><span className="font-medium text-foreground">Product Name:</span> {read(r.payload, "identity.product_name", "product_name", "name")}</div>
                    <div><span className="font-medium text-foreground">Product Class:</span> {read(r.payload, "identity.product_class", "product_class", "class")}</div>
                    <div><span className="font-medium text-foreground">Product Type:</span> {read(r.payload, "identity.product_type", "product_type", "type")}</div>
                    <div><span className="font-medium text-foreground">Category:</span> {read(r.payload, "identity.category", "category")}</div>
                    <div><span className="font-medium text-foreground">Subcategory:</span> {read(r.payload, "identity.subcategory", "subcategory")}</div>
                    <div>
                      <span className="font-medium text-foreground">Department Route:</span>{" "}
                      {`${read(r.payload, "identity.main_department", "main_department")} → ${read(r.payload, "identity.production_department", "production_department")}`}
                    </div>
                    <div><span className="font-medium text-foreground">Primary Pack:</span> {read(r.payload, "packing.pack_preview", "primary_pack")}</div>
                    <div><span className="font-medium text-foreground">MOQ:</span> {formatProductMoq(r.payload)}</div>
                    <div><span className="font-medium text-foreground">Pricing:</span> {formatPricing(r.payload)}</div>
                    <div><span className="font-medium text-foreground">Compliance Review Needed:</span> {read(r.payload, "compliance.review_needed", "compliance_review_needed")}</div>
                    <div><span className="font-medium text-foreground">BOM:</span> {formatBom(r.payload)}</div>
                    <div><span className="font-medium text-foreground">Submitted By:</span> {getSubmittedBy(r)}</div>
                    <div><span className="font-medium text-foreground">Submitted At:</span> {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"}</div>
                    <div><span className="font-medium text-foreground">Target:</span> {r.target_record_id || "(new)"}</div>
                    <div><span className="font-medium text-foreground">Operation:</span> {r.operation || "update"}</div>

                    <div className="pt-2 border-t border-border/50">
                      <div className="font-medium mb-1.5 text-foreground">
                        Review Flags{flagsFromPayload ? "" : " (standard areas)"}:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {reviewFlags.map((flag) => (
                          <span
                            key={flag}
                            className={`rounded-full px-2.5 py-0.5 text-xs ${flagsFromPayload ? "bg-accent/15 text-accent-foreground border border-accent/25" : "bg-muted text-muted-foreground"}`}
                          >
                            {flag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Draft type: <span className="font-medium capitalize text-foreground">{r.draftType}</span>
                  </div>
                )}

                <details className="text-sm group">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                    View technical payload
                  </summary>
                  <pre className="mt-2 text-xs bg-muted/50 border border-border/60 p-3 rounded-lg overflow-auto max-h-56">
                    {JSON.stringify(r.payload, null, 2)}
                  </pre>
                </details>

                {isPending && (
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <Input
                      className="flex-1"
                      placeholder="Rejection reason (required)"
                      value={reasons[r.id] ?? ""}
                      onChange={(e) => setReasons((x) => ({ ...x, [r.id]: e.target.value }))}
                      aria-label="Rejection reason"
                    />
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" className="rounded-full" onClick={() => reject(r)} disabled={!(reasons[r.id] || "").trim()}>
                        Reject
                      </Button>
                      <Button className="rounded-full" onClick={() => approve(r)}>Approve</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
