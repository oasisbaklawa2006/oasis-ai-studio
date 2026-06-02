import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Copy, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { submitCatalogueDraft } from "@/features/catalogueDrafts/draftService";
import { draftTableMap } from "@/features/catalogueDrafts/draftTableMap";
import {
  canSubmitDraft,
  canWriteMasterDirectly,
  isCatalogueContributor,
} from "@/shared/auth/centralPermissions";
import type { Role } from "@/lib/permissions";

const ALIAS_TYPES = ["common_name","misspelling","local_slang","authentic_name","hindi_name","arabic_name","turkish_name","old_name","customer_term","salesman_term","visual_description","ai_generated"];

const DIRECT_ALIAS_ROLES: Role[] = ["owner", "admin", "product_manager"];

type WriteMode = "direct" | "draft" | "readonly";

type AliasRowInput = {
  alias: string;
  language?: string | null;
  script?: string | null;
  alias_type?: string;
  source?: string;
  is_active?: boolean;
};

// Simple internal seed map for "Generate basic aliases".
// Not an AI call — just deterministic suggestions for MVP.
const SEED_RULES: { match: RegExp; aliases: { alias: string; language?: string; script?: string; alias_type?: string }[] }[] = [
  { match: /kunafa|kadayif|kataifi|knafe|shredded filo/i, aliases: [
    { alias: "Kunafa" }, { alias: "Knafeh" }, { alias: "Kanafeh" }, { alias: "Konafa" },
    { alias: "Kunefe" }, { alias: "Künefe", language: "tr" }, { alias: "Kadayif", language: "tr" },
    { alias: "Kadayıf", language: "tr" }, { alias: "Kadaif" }, { alias: "Kataifi" },
    { alias: "Kadaifi" }, { alias: "Katayef" }, { alias: "Kataïf" },
    { alias: "Shredded filo", alias_type: "visual_description" },
    { alias: "Shredded phyllo", alias_type: "visual_description" },
    { alias: "Kadaifi pastry" }, { alias: "Kataifi pastry" },
    { alias: "Arabic seviyan", language: "hi", alias_type: "local_slang" },
    { alias: "Tel kadayıf", language: "tr" },
    { alias: "قطايف", language: "ar", script: "arabic", alias_type: "arabic_name" },
    { alias: "كنافة", language: "ar", script: "arabic", alias_type: "arabic_name" },
  ]},
  { match: /pyramid.*baklawa|cashew pyramid|boukaj/i, aliases: [
    { alias: "Cashew Pyramid" }, { alias: "Pyramid Baklawa" }, { alias: "Plain Pyramid" },
    { alias: "Boukaj", alias_type: "authentic_name" }, { alias: "Bokaj" },
    { alias: "Baklava Pyramid" }, { alias: "Baklawa Pyramid" },
    { alias: "Cashew Boukaj" }, { alias: "Cashew Baklava Pyramid" },
    { alias: "Kaju Pyramid", language: "hi", alias_type: "hindi_name" },
    { alias: "Kaju Baklawa", language: "hi", alias_type: "hindi_name" },
    { alias: "काजू पिरामिड", language: "hi", script: "devanagari", alias_type: "hindi_name" },
  ]},
  { match: /katori|cashew tart|cashew cup/i, aliases: [
    { alias: "Cashew Tart" }, { alias: "Katori Baklawa" }, { alias: "Katori" },
    { alias: "Cashew Katori" }, { alias: "Kaju Katori", language: "hi", alias_type: "hindi_name" },
    { alias: "Baklava Tart" }, { alias: "Baklawa Tart" }, { alias: "Cashew Cup" },
    { alias: "Kaju Cup", language: "hi", alias_type: "hindi_name" },
    { alias: "काजू कटोरी", language: "hi", script: "devanagari", alias_type: "hindi_name" },
  ]},
];

const buildCreatePayload = (productId: string, row: AliasRowInput) => ({
  scope: "product_alias" as const,
  product_id: productId,
  alias: row.alias,
  language: row.language ?? null,
  script: row.script ?? null,
  alias_type: row.alias_type ?? "common_name",
  source: row.source ?? "manual",
});

const buildMutatePayload = (productId: string, row: AliasRowInput) => ({
  ...buildCreatePayload(productId, row),
  is_active: row.is_active ?? true,
});

interface Props { productId: string; productName: string; }

export function AliasManager({ productId, productName }: Props) {
  const { roles } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [draft, setDraft] = useState({ alias: "", language: "", alias_type: "common_name" });
  const [writeMode, setWriteMode] = useState<WriteMode>("readonly");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("product_aliases").select("*").eq("product_id", productId).order("created_at", { ascending: false });
    setItems(data ?? []);
  };

  useEffect(() => {
    load();
  }, [productId]);

  useEffect(() => {
    (async () => {
      const roleList = roles as Role[];
      const hasDirect = roleList.some((r) => DIRECT_ALIAS_ROLES.includes(r)) || (await canWriteMasterDirectly());
      if (hasDirect) {
        setWriteMode("direct");
        return;
      }
      if (await isCatalogueContributor()) {
        const canSubmit = await canSubmitDraft(draftTableMap.alias.permission);
        setWriteMode(canSubmit ? "draft" : "readonly");
        return;
      }
      setWriteMode("readonly");
    })();
  }, [roles]);

  const canMutate = writeMode === "direct" || writeMode === "draft";

  const addDirect = async (rows: AliasRowInput[]) => {
    if (!rows.length) return;
    const payload = rows.map((r) => ({
      product_id: productId,
      alias: r.alias,
      language: r.language ?? null,
      script: r.script ?? null,
      alias_type: r.alias_type ?? "common_name",
      source: r.source ?? "manual",
    }));
    const { error } = await supabase.from("product_aliases").upsert(payload, { onConflict: "product_id,normalized_alias", ignoreDuplicates: true });
    if (error) {
      toast.error(error.message);
      return false;
    }
    await load();
    return true;
  };

  const submitAliasCreateDraft = async (row: AliasRowInput) => {
    return submitCatalogueDraft({
      draftType: "alias",
      operation: "create",
      payload: buildCreatePayload(productId, row),
      targetRecordId: null,
    });
  };

  const addOne = async () => {
    const trimmed = draft.alias.trim();
    if (!trimmed || submitting || !canMutate) return;

    setSubmitting(true);
    try {
      const row: AliasRowInput = { ...draft, alias: trimmed, source: "manual" };

      if (writeMode === "direct") {
        const ok = await addDirect([row]);
        if (ok) {
          setDraft({ alias: "", language: "", alias_type: "common_name" });
          toast.success("Alias added.");
        }
        return;
      }

      const res = await submitAliasCreateDraft(row);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setDraft({ alias: "", language: "", alias_type: "common_name" });
      toast.success("Submitted for approval. Approved aliases will appear here after review.");
    } finally {
      setSubmitting(false);
    }
  };

  const generate = async () => {
    if (submitting || !canMutate) return;

    const matches = SEED_RULES.filter((r) => r.match.test(productName));
    const rows = matches.flatMap((m) => m.aliases.map((a) => ({ ...a, source: "system_generated" })));
    if (!rows.length) {
      toast.info("No starter aliases matched. Add them manually.");
      return;
    }

    setSubmitting(true);
    try {
      if (writeMode === "direct") {
        const ok = await addDirect(rows);
        if (ok) toast.success(`Added ${rows.length} starter aliases`);
        return;
      }

      let submitted = 0;
      for (const row of rows) {
        const res = await submitAliasCreateDraft(row);
        if (res.ok) submitted += 1;
        else toast.error(res.message);
      }
      if (submitted > 0) {
        toast.success(
          `Submitted ${submitted} alias draft${submitted === 1 ? "" : "s"} for approval. Approved aliases will appear here after review.`,
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggle = async (item: any, v: boolean) => {
    if (submitting || !canMutate) return;

    setSubmitting(true);
    try {
      if (writeMode === "direct") {
        const { error } = await supabase.from("product_aliases").update({ is_active: v }).eq("id", item.id);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Alias updated.");
        await load();
        return;
      }

      const res = await submitCatalogueDraft({
        draftType: "alias",
        operation: "update",
        payload: buildMutatePayload(productId, {
          alias: item.alias,
          language: item.language,
          script: item.script,
          alias_type: item.alias_type,
          source: item.source,
          is_active: v,
        }),
        targetRecordId: item.id,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Submitted for approval. Active state will update after review.");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (item: any) => {
    if (submitting || !canMutate) return;

    setSubmitting(true);
    try {
      if (writeMode === "direct") {
        const { error } = await supabase.from("product_aliases").delete().eq("id", item.id);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Alias removed.");
        await load();
        return;
      }

      const res = await submitCatalogueDraft({
        draftType: "alias",
        operation: "delete_request",
        payload: buildMutatePayload(productId, {
          alias: item.alias,
          language: item.language,
          script: item.script,
          alias_type: item.alias_type,
          source: item.source,
          is_active: item.is_active,
        }),
        targetRecordId: item.id,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Delete request submitted for approval. This alias stays visible until review.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyAll = () => {
    navigator.clipboard.writeText(items.map((i) => i.alias).join("\n"));
    toast.success("Copied alias list");
  };

  return (
    <div className="card-elevated p-6 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-xl">Aliases & search terms</h3>
          <p className="text-xs text-muted-foreground">Internal search aids — misspellings, local names (Hindi/Arabic/Turkish), slang, authentic names. Not public product names.</p>
          {writeMode === "draft" && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Alias changes are submitted for approval. Approved aliases will appear here after review.
            </p>
          )}
        </div>
        {canMutate && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={generate} disabled={submitting}>
              <Sparkles className="h-4 w-4 mr-1" />Generate basic
            </Button>
            <Button size="sm" variant="ghost" onClick={copyAll} disabled={!items.length || submitting}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        )}
        {!canMutate && (
          <Button size="sm" variant="ghost" onClick={copyAll} disabled={!items.length}>
            <Copy className="h-4 w-4" />
          </Button>
        )}
      </div>

      {canMutate && (
        <div className="grid sm:grid-cols-[1fr_120px_160px_auto] gap-2 items-end">
          <div>
            <Label className="text-xs">New alias</Label>
            <Input
              value={draft.alias}
              onChange={(e) => setDraft({ ...draft, alias: e.target.value })}
              placeholder="e.g. Kadayif"
              disabled={submitting}
            />
          </div>
          <div>
            <Label className="text-xs">Language</Label>
            <Input
              value={draft.language}
              onChange={(e) => setDraft({ ...draft, language: e.target.value })}
              placeholder="ar/hi/tr…"
              disabled={submitting}
            />
          </div>
          <div>
            <Label className="text-xs">Type</Label>
            <select
              className="w-full h-10 px-2 rounded border bg-background text-sm disabled:opacity-50"
              value={draft.alias_type}
              onChange={(e) => setDraft({ ...draft, alias_type: e.target.value })}
              disabled={submitting}
            >
              {ALIAS_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <Button onClick={addOne} disabled={submitting || !draft.alias.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            {submitting ? "Submitting…" : writeMode === "draft" ? "Submit" : "Add"}
          </Button>
        </div>
      )}

      <div className="border-t pt-3 space-y-1.5 max-h-80 overflow-auto">
        {items.map((a) => (
          <div key={a.id} className={`flex items-center gap-3 text-sm py-1.5 px-2 rounded ${a.is_active ? "" : "opacity-50"}`}>
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium">{a.alias}</div>
              <div className="text-[11px] text-muted-foreground">
                {a.alias_type}{a.language ? ` · ${a.language}` : ""} · {a.source}
                {a.confidence_score !== 1 ? ` · ${a.confidence_score}` : ""}
              </div>
            </div>
            {canMutate ? (
              <>
                <Switch
                  checked={a.is_active}
                  onCheckedChange={(v) => toggle(a, v)}
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => remove(a)}
                  disabled={submitting}
                  className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                  aria-label={`Remove ${a.alias}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            ) : (
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">View only</span>
            )}
          </div>
        ))}
        {items.length === 0 && <div className="text-xs text-muted-foreground text-center py-3">No aliases yet.</div>}
      </div>
    </div>
  );
}
