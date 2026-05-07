import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ShieldAlert, History } from "lucide-react";
import { Button } from "@/components/ui/button";

type Row = {
  id: string;
  feature_key: string | null;
  action: string | null;
  old_status: string | null;
  new_status: string | null;
  performed_by: string | null;
  notes: string | null;
  created_at: string;
};

const ACTION_TONE: Record<string, string> = {
  enable: "bg-success/15 text-success",
  disable: "bg-muted text-muted-foreground",
  show: "bg-accent-soft text-accent-foreground",
  hide: "bg-muted text-muted-foreground",
  test_connection: "bg-primary/10 text-primary",
};

const AuditLog = () => {
  const { roles } = useAuth();
  const allowed = roles.includes("owner") || roles.includes("admin");
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { email?: string; full_name?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("feature_activation_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) { setLoading(false); return; }
    const list = (data ?? []) as Row[];
    setRows(list);
    const ids = Array.from(new Set(list.map((r) => r.performed_by).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id,email,full_name").in("id", ids);
      const map: Record<string, any> = {};
      (ps ?? []).forEach((p: any) => { map[p.id] = p; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { if (allowed) load(); }, [allowed]);

  if (!allowed) {
    return (
      <>
        <PageHeader title="Activation Audit Log" subtitle="Owner/Admin only." />
        <div className="card-elevated p-6 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-warning" />
          <div className="text-sm">You do not have permission to view the audit log.</div>
        </div>
      </>
    );
  }

  const filtered = rows.filter((r) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      (r.feature_key ?? "").toLowerCase().includes(q) ||
      (r.action ?? "").toLowerCase().includes(q) ||
      (r.notes ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <>
      <PageHeader
        title="Activation Audit Log"
        subtitle="All feature enable, disable, show, hide and test actions."
        actions={<Button size="sm" variant="outline" onClick={load} disabled={loading}><History className="h-4 w-4 mr-1" />Refresh</Button>}
      />

      <div className="card-elevated p-3 mb-4">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by feature, action, or note…"
          className="w-full bg-transparent outline-none text-sm px-2 py-1"
        />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Loading audit log…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground py-10 text-center">No audit entries.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const who = r.performed_by ? (profiles[r.performed_by]?.full_name || profiles[r.performed_by]?.email || r.performed_by.slice(0, 8)) : "system";
            return (
              <div key={r.id} className="card-elevated p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-sm">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`badge-soft text-[10px] uppercase ${ACTION_TONE[r.action ?? ""] ?? "bg-muted text-muted-foreground"}`}>{r.action ?? "—"}</span>
                  <span className="font-medium truncate">{r.feature_key ?? "—"}</span>
                  {(r.old_status || r.new_status) && (
                    <span className="text-xs text-muted-foreground truncate">
                      {r.old_status ?? "—"} → {r.new_status ?? "—"}
                    </span>
                  )}
                </div>
                <div className="flex flex-col sm:items-end text-xs text-muted-foreground shrink-0">
                  <span>{new Date(r.created_at).toLocaleString()}</span>
                  <span className="truncate max-w-[200px]">by {who}</span>
                </div>
                {r.notes && <div className="sm:basis-full text-xs text-muted-foreground border-t pt-2 sm:pt-2 break-words">{r.notes}</div>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default AuditLog;
