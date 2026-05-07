import { PageHeader } from "@/components/PageHeader";
import { Lock, Loader2, ShieldCheck, AlertTriangle, PlugZap, Eye, EyeOff, Power, PowerOff, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useFeatureFlags, refreshFeatureFlags, type FeatureFlag } from "@/hooks/useFeatureFlags";

type Integration = {
  integration_key: string;
  display_name: string;
  provider: string | null;
  status: string;
  secret_required: boolean;
  secret_status: string;
  test_endpoint: string | null;
  last_tested_at: string | null;
  last_test_result: any;
  notes: string | null;
};

const STATUS_TONE: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  configured: "bg-accent-soft text-accent-foreground",
  test_passed: "bg-success/15 text-success",
  enabled: "bg-success/15 text-success",
  disabled: "bg-muted text-muted-foreground",
  error: "bg-destructive/15 text-destructive",
};

const PdfHeroCleanup = () => {
  const { roles } = useAuth();
  const allowed = roles.includes("owner") || roles.includes("admin");
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    const { count: c } = await supabase
      .from("products").select("id", { count: "exact", head: true })
      .ilike("hero_image_url", "%/_pdf_pages/%");
    setCount(c ?? 0);
  };
  useEffect(() => { if (allowed) refresh(); }, [allowed]);
  if (!allowed) return null;
  const run = async () => {
    if (!confirm(`Clear PDF page hero images on ${count} products?`)) return;
    setBusy(true);
    try {
      const { data: products } = await supabase.from("products").select("id, hero_image_url").ilike("hero_image_url", "%/_pdf_pages/%");
      const urls = (products ?? []).map((p: any) => p.hero_image_url).filter(Boolean) as string[];
      const ids = (products ?? []).map((p: any) => p.id);
      if (urls.length) await supabase.from("product_media").update({ type: "source_pdf_page", status: "reference_only" }).in("file_url", urls);
      if (ids.length) await supabase.from("products").update({ hero_image_url: null }).in("id", ids);
      toast.success(`Cleared hero on ${ids.length} products`);
      await refresh();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="card-elevated p-4 mb-6 border-warning/40">
      <div className="flex items-center gap-2 mb-2"><Trash2 className="h-4 w-4 text-warning" /><h3 className="font-display">Clear imported PDF page hero images</h3></div>
      <p className="text-sm text-muted-foreground mb-2">{count === null ? "Counting…" : `${count} products use a PDF screenshot as hero.`}</p>
      <Button onClick={run} disabled={busy || !count} variant="destructive" size="sm">
        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}Clear hero on {count ?? 0} products
      </Button>
    </div>
  );
};

const FeatureCard = ({ f, integ, canManage, onChange }: { f: FeatureFlag; integ?: Integration; canManage: boolean; onChange: () => void }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const audit = async (action: string, oldStatus: string, newStatus: string, notes?: string) => {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("feature_activation_audit").insert({
      feature_key: f.feature_key, action, old_status: oldStatus, new_status: newStatus,
      performed_by: u.user?.id, notes,
    });
  };

  const update = async (patch: Partial<FeatureFlag>, action: string) => {
    setBusy(action);
    const old = f.status;
    const next: any = { ...patch };
    const { error } = await supabase.from("feature_flags").update(next).eq("feature_key", f.feature_key);
    if (error) { toast.error(error.message); setBusy(null); return; }
    await audit(action, old, next.status ?? old);
    toast.success(`${f.feature_name}: ${action}`);
    await refreshFeatureFlags(); onChange();
    setBusy(null);
  };

  const enable = () => update({ is_enabled: true, is_visible: true, status: "enabled" }, "enable");
  const disable = () => update({ is_enabled: false, status: "disabled" }, "disable");
  const show = () => update({ is_visible: true }, "show");
  const hide = () => update({ is_visible: false, is_enabled: false, status: "disabled" }, "hide");

  const test = async () => {
    setBusy("test");
    try {
      const { data, error } = await supabase.functions.invoke("test-integration", { body: { integration_key: f.feature_key } });
      if (error) throw error;
      const ok = (data as any)?.ok;
      toast[ok ? "success" : "warning"]((data as any)?.message ?? (ok ? "Connected" : "Not configured"));
      await refreshFeatureFlags(); onChange();
    } catch (e: any) {
      toast.error(e.message ?? "Test failed");
    } finally { setBusy(null); }
  };

  return (
    <div className="card-elevated p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display text-base truncate">{f.feature_name}</div>
          <div className="text-xs text-muted-foreground">{f.description}</div>
        </div>
        <span className={`badge-soft text-[10px] uppercase ${STATUS_TONE[f.status] ?? "bg-muted text-muted-foreground"}`}>{f.status}</span>
      </div>
      <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
        <span>Visible: {f.is_visible ? "yes" : "no"}</span>
        <span>·</span>
        <span>Enabled: {f.is_enabled ? "yes" : "no"}</span>
        {integ && <><span>·</span><span>Secret: {integ.secret_status}</span></>}
        {f.last_tested_at && <><span>·</span><span>Last test: {new Date(f.last_tested_at).toLocaleString()}</span></>}
      </div>

      <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground">
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} Setup checklist
      </button>
      {open && (
        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5 border-l-2 border-muted pl-4">
          {(f.setup_notes ?? "Configure provider, secrets, and test before enabling.").split("·").map((s, i) => (
            <li key={i}>{s.trim()}</li>
          ))}
        </ul>
      )}
      {f.last_test_result && <p className="text-[11px] text-muted-foreground border-t pt-2">Last result: {f.last_test_result}</p>}

      {canManage ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
          <Button size="sm" variant="outline" disabled={!!busy} onClick={test}>
            {busy === "test" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <PlugZap className="h-3 w-3 mr-1" />}Test
          </Button>
          {f.is_enabled ? (
            <Button size="sm" variant="outline" disabled={!!busy} onClick={disable}><PowerOff className="h-3 w-3 mr-1" />Disable</Button>
          ) : (
            <Button size="sm" disabled={!!busy} onClick={enable}><Power className="h-3 w-3 mr-1" />Enable</Button>
          )}
          {f.is_visible ? (
            <Button size="sm" variant="outline" disabled={!!busy} onClick={hide}><EyeOff className="h-3 w-3 mr-1" />Hide</Button>
          ) : (
            <Button size="sm" variant="outline" disabled={!!busy} onClick={show}><Eye className="h-3 w-3 mr-1" />Show</Button>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Owner/Admin only.</p>
      )}
    </div>
  );
};

const Settings = () => {
  const { roles } = useAuth();
  const canManage = roles.includes("owner") || roles.includes("admin");
  const { flags, loading, refresh } = useFeatureFlags();
  const [integs, setIntegs] = useState<Integration[]>([]);

  const loadIntegs = async () => {
    const { data } = await supabase.from("integration_settings").select("*");
    setIntegs((data ?? []) as any);
  };
  useEffect(() => { loadIntegs(); }, []);
  const integByKey = useMemo(() => Object.fromEntries(integs.map((i) => [i.integration_key, i])), [integs]);

  const ready = flags.filter((f) => f.is_enabled || f.status === "test_passed");
  const setup = flags.filter((f) => !f.is_enabled && f.status !== "test_passed" && f.is_visible || (!f.is_enabled && (f.status === "configured" || f.status === "planned" || f.status === "error")));
  const setupSet = new Set(setup.map((f) => f.feature_key));
  const readySet = new Set(ready.map((f) => f.feature_key));
  const hidden = flags.filter((f) => !readySet.has(f.feature_key) && !setupSet.has(f.feature_key));

  const refreshAll = async () => { await refresh(); await loadIntegs(); };

  return (
    <>
      <PageHeader title="Future Features & Integration Activation" subtitle="Enable, hide, and test future-ready modules. Secrets stay in backend." />
      <PdfHeroCleanup />

      <div className="card-elevated p-4 mb-6 bg-accent-soft/40 text-sm flex items-start gap-2">
        <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>
          API secrets are <strong>never stored in the frontend</strong>. Add them as backend (Edge Function) secrets.
          SKU and product_id are permanent identities — alias names are search helpers only and must never be used as external references.
        </span>
      </div>

      {!canManage && (
        <div className="card-elevated p-4 mb-6 text-sm flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 mt-0.5" /><span>You can view feature status. Only Owner/Admin can change activation.</span>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Loading features…</div>
      ) : (
        <div className="space-y-8">
          <Section title="Ready to use" tone="success" items={ready} integByKey={integByKey} canManage={canManage} onChange={refreshAll} empty="No features enabled yet." />
          <Section title="Setup required" tone="warn" items={setup} integByKey={integByKey} canManage={canManage} onChange={refreshAll} empty="No features awaiting setup." />
          <Section title="Disabled / hidden" tone="muted" items={hidden} integByKey={integByKey} canManage={canManage} onChange={refreshAll} empty="No hidden features." />
        </div>
      )}
    </>
  );
};

const Section = ({ title, tone, items, integByKey, canManage, onChange, empty }: any) => (
  <section>
    <div className="flex items-center gap-2 mb-3">
      {tone === "warn" && <AlertTriangle className="h-4 w-4 text-warning" />}
      {tone === "success" && <ShieldCheck className="h-4 w-4 text-success" />}
      <h2 className="font-display text-lg">{title}</h2>
      <span className="text-xs text-muted-foreground">({items.length})</span>
    </div>
    {items.length === 0 ? (
      <p className="text-xs text-muted-foreground">{empty}</p>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map((f: FeatureFlag) => (
          <FeatureCard key={f.feature_key} f={f} integ={integByKey[f.feature_key]} canManage={canManage} onChange={onChange} />
        ))}
      </div>
    )}
  </section>
);

export default Settings;
