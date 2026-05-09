import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isCatalogueReviewer } from "@/shared/auth/centralPermissions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const SOURCES = [
  { type: "product", table: "catalogue_product_drafts", approve: "approve_catalogue_product_draft", reject: "reject_catalogue_product_draft" },
  { type: "media", table: "catalogue_media_submissions", approve: "approve_catalogue_media_submission", reject: "reject_catalogue_media_submission" },
  { type: "alias", table: "catalogue_alias_drafts", approve: "approve_catalogue_alias_draft", reject: "reject_catalogue_alias_draft" },
  { type: "bom", table: "catalogue_bom_drafts", approve: "approve_catalogue_bom_draft", reject: "reject_catalogue_bom_draft" },
  { type: "moq", table: "catalogue_moq_drafts", approve: "approve_catalogue_moq_draft", reject: "reject_catalogue_moq_draft" },
  { type: "pricing", table: "catalogue_pricing_drafts", approve: "approve_catalogue_pricing_draft", reject: "reject_catalogue_pricing_draft" },
  { type: "tag", table: "catalogue_tag_drafts", approve: "approve_catalogue_tag_draft", reject: "reject_catalogue_tag_draft" },
] as const;

export default function ApprovalInbox() {
  const [allowed, setAllowed] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const load = async () => {
    const all: any[] = [];
    for (const s of SOURCES) {
      const { data } = await (supabase as any).from(s.table).select("*").eq("status", "pending_approval").order("submitted_at", { ascending: false });
      (data ?? []).forEach((d: any) => all.push({ ...d, draftType: s.type, approveFn: s.approve, rejectFn: s.reject }));
    }
    setItems(all);
  };
  useEffect(() => { (async () => { const ok = await isCatalogueReviewer(); setAllowed(ok); if (ok) load(); })(); }, []);
  const grouped = useMemo(() => items.reduce((a: any, it: any) => ((a[it.draftType] ||= []).push(it), a), {}), [items]);
  const approve = async (r: any) => { const { error } = await (supabase as any).rpc(r.approveFn, { draft_id: r.id }); if (error) { if (/not finalized/i.test(error.message)) toast.warning(error.message); else toast.error(error.message); return; } toast.success("Approved"); load(); };
  const reject = async (r: any) => { const { error } = await (supabase as any).rpc(r.rejectFn, { draft_id: r.id, reason: reasons[r.id] || "Rejected" }); if (error) return toast.error(error.message); toast.success("Rejected"); load(); };
  if (!allowed) return <div className="p-4 text-sm">Approval inbox is restricted to catalogue reviewers.</div>;
  return <>
    <PageHeader title="Approval Inbox" subtitle="Pending drafts across catalogue modules" />
    <div className="space-y-6">{Object.entries(grouped).map(([k, arr]: any) => <div key={k} className="card-elevated p-4 space-y-3"><h3 className="font-semibold capitalize">{k}</h3>{arr.map((r: any) => <div key={r.id} className="border rounded p-3 text-sm space-y-2"><div><b>{r.operation}</b> · {r.submitted_by} · {new Date(r.submitted_at).toLocaleString()}</div><div>Target: {r.target_record_id || "(new)"}</div><pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">{JSON.stringify(r.payload, null, 2)}</pre><div className="flex gap-2"><Input placeholder="Reject reason" value={reasons[r.id] ?? ""} onChange={(e) => setReasons((x) => ({ ...x, [r.id]: e.target.value }))} /><Button variant="outline" onClick={() => reject(r)}>Reject</Button><Button onClick={() => approve(r)}>Approve</Button></div></div>)}</div>)}</div>
  </>;
}
