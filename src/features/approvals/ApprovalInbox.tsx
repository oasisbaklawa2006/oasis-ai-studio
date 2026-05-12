import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isCatalogueReviewer } from "@/shared/auth/centralPermissions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

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

const read = (payload: Record<string, any> | null | undefined, ...keys: string[]) => {
  if (!payload) return "—";
  for (const key of keys) {
    if (payload[key] !== undefined && payload[key] !== null && payload[key] !== "") return String(payload[key]);
  }
  return "—";
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
              <Button key={tab.key} variant={isActive ? "default" : "outline"} onClick={() => setActiveTab(tab.key)}>
                {tab.label} ({count})
              </Button>
            );
          })}
        </div>

        <div className="space-y-4">
          {currentItems.length === 0 && (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No items in this section.</div>
          )}

          {currentItems.map((r) => {
            const isPending = r.status === "pending_approval";
            const isApproved = r.status === "approved";
            const isRejected = r.status === "rejected";

            return (
              <div key={`${r.draftType}-${r.id}`} className="rounded-xl bg-white p-4 shadow-sm border space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <div className="font-semibold capitalize">{r.draftType} draft · {r.operation || "update"}</div>
                    <div className="text-muted-foreground">Target: {r.target_record_id || "(new)"}</div>
                  </div>

                  {isPending && <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-semibold">AWAITING APPROVAL</span>}
                  {isApproved && <span className="rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-semibold">APPROVED</span>}
                  {isRejected && <span className="rounded-full bg-red-100 text-red-800 px-3 py-1 text-xs font-semibold">REJECTED</span>}
                </div>

                <div className="text-sm text-muted-foreground space-y-1">
                  <div>{formatAge(r.submitted_at)}</div>
                  <div>Submitted by: {getSubmittedBy(r)}</div>
                  {isRejected && <div className="text-red-700 font-medium">Reason: {r.rejection_reason || "No reason provided"}</div>}
                  {isRejected && r.rejected_at && <div>Rejected at: {new Date(r.rejected_at).toLocaleString()}</div>}
                </div>

                {r.draftType === "product" ? (
                  <div className="rounded-lg border bg-slate-50 p-3 text-sm space-y-2">
                    <div><span className="font-medium">Product Name:</span> {read(r.payload, "product_name", "name")}</div>
                    <div><span className="font-medium">Product Class:</span> {read(r.payload, "product_class", "class")}</div>
                    <div><span className="font-medium">Product Type:</span> {read(r.payload, "product_type", "type")}</div>
                    <div><span className="font-medium">Category:</span> {read(r.payload, "category")}</div>
                    <div><span className="font-medium">Subcategory:</span> {read(r.payload, "subcategory")}</div>
                    <div><span className="font-medium">Main Department:</span> {read(r.payload, "main_department")}</div>
                    <div><span className="font-medium">Production Department:</span> {read(r.payload, "production_department")}</div>
                    <div><span className="font-medium">Primary Pack:</span> {read(r.payload, "primary_pack")}</div>
                    <div><span className="font-medium">MOQ:</span> {read(r.payload, "moq")}</div>
                    <div><span className="font-medium">Pricing:</span> {read(r.payload, "pricing")}</div>
                    <div><span className="font-medium">Compliance Review Needed:</span> {read(r.payload, "compliance_review_needed")}</div>
                    <div><span className="font-medium">BOM Required:</span> {read(r.payload, "bom_required")}</div>
                    <div><span className="font-medium">Expected BOM Type:</span> {read(r.payload, "expected_bom_type")}</div>
                    <div><span className="font-medium">Submitted By:</span> {getSubmittedBy(r)}</div>
                    <div><span className="font-medium">Submitted At:</span> {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"}</div>
                    <div><span className="font-medium">Target:</span> {r.target_record_id || "(new)"}</div>
                    <div><span className="font-medium">Operation:</span> {r.operation || "update"}</div>

                    <div className="pt-1">
                      <div className="font-medium mb-1">Review Flags:</div>
                      <div className="flex flex-wrap gap-2">
                        {FLAG_CHIPS.map((flag) => (
                          <span key={flag} className="rounded-full bg-slate-200 px-2 py-0.5 text-xs">{flag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm">Draft type: <span className="font-medium capitalize">{r.draftType}</span></div>
                )}

                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground">View technical payload</summary>
                  <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-56">{JSON.stringify(r.payload, null, 2)}</pre>
                </details>

                {isPending && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Reject reason (required)"
                      value={reasons[r.id] ?? ""}
                      onChange={(e) => setReasons((x) => ({ ...x, [r.id]: e.target.value }))}
                    />
                    <Button variant="outline" onClick={() => reject(r)}>Reject</Button>
                    <Button onClick={() => approve(r)}>Approve</Button>
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
