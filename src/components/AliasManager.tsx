import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
import { getAliasText, hasAliasActiveFlag } from "@/lib/aliasDisplay";
import { insertProductAlias } from "@/lib/aliasSchemaAdapter";
import {
  PRODUCT_LANGUAGE_TERM_TYPES,
  TERM_TYPE_LABELS,
  TERM_TYPE_UI_NOTICE,
  buildAdminAliasInsert,
  buildContributorAliasDraftPayload,
  inferDefaultTermType,
  type ProductLanguageTermType,
} from "@/features/productLanguage/terms";
import {
  getStoredTermType,
  removeStoredTermType,
  setStoredTermType,
} from "@/features/productLanguage/termTypeStorage";

const DIRECT_ALIAS_ROLES: Role[] = ["owner", "admin", "product_manager"];

type WriteMode = "direct" | "draft" | "readonly";

type AliasRowInput = {
  alias: string;
  language?: string | null;
  script?: string | null;
  alias_type?: string;
  source?: string;
  is_active?: boolean;
  term_type?: ProductLanguageTermType;
};

import { seedAliasesFromName } from "@/features/productLanguage/aliasSeedRules";

function resolveTermType(productId: string, item: Record<string, unknown>): ProductLanguageTermType {
  const id = String(item.id ?? "");
  if (id) {
    const stored = getStoredTermType(productId, id);
    if (stored) return stored;
  }
  return inferDefaultTermType({
    product_id: item.product_id as string | null | undefined,
    alias_type: item.alias_type as string | null | undefined,
  });
}

interface Props {
  productId: string;
  productName: string;
  id?: string;
  onAliasesChange?: () => void;
}

export function AliasManager({ productId, productName, id: sectionId, onAliasesChange }: Props) {
  const { roles } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [activeTermType, setActiveTermType] = useState<ProductLanguageTermType>("official_alias");
  const [draft, setDraft] = useState({ alias: "", language: "" });
  const [writeMode, setWriteMode] = useState<WriteMode>("readonly");
  const [submitting, setSubmitting] = useState(false);
  const [termTypeVersion, setTermTypeVersion] = useState(0);

  const officialName = productName.trim() || "—";

  const load = async () => {
    const trimmedName = productName.trim();
    const byProductId = supabase
      .from("product_aliases")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    const byCanonical =
      trimmedName.length > 0
        ? supabase
            .from("product_aliases")
            .select("*")
            .is("product_id", null)
            .ilike("canonical_name", trimmedName)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] });

    const [linked, legacy] = await Promise.all([byProductId, byCanonical]);
    const merged = [...(linked.data ?? []), ...(legacy.data ?? [])];
    const seen = new Set<string>();
    setItems(merged.filter((row) => (seen.has(row.id) ? false : (seen.add(row.id), true))));
    onAliasesChange?.();
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

  const itemsWithTermType = useMemo(
    () =>
      items.map((item) => ({
        item,
        termType: resolveTermType(productId, item),
      })),
    [items, productId, termTypeVersion],
  );

  const tabItems = useMemo(
    () => itemsWithTermType.filter(({ termType }) => termType === activeTermType),
    [itemsWithTermType, activeTermType],
  );

  const bumpTermTypes = () => setTermTypeVersion((v) => v + 1);

  const addDirect = async (rows: AliasRowInput[], termType: ProductLanguageTermType) => {
    if (!rows.length) return false;
    const canonical = productName.trim() || "Unnamed product";
    let inserted = 0;

    for (const r of rows) {
      const insertPayload = buildAdminAliasInsert(productId, canonical, r.alias, {
        alias_type: r.alias_type ?? termType,
        source: r.source ?? "manual",
      });
      if (!insertPayload.alias) continue;

      const { data, error } = await insertProductAlias(supabase, insertPayload);

      if (error) {
        if (/duplicate|unique/i.test(error.message)) continue;
        toast.error(error.message);
        return false;
      }

      if (data?.id) {
        setStoredTermType(productId, data.id, termType);
      }
      inserted += 1;
    }

    if (!inserted) {
      toast.info("No new aliases added (duplicates skipped).");
      return false;
    }

    bumpTermTypes();
    await load();
    return true;
  };

  const submitAliasCreateDraft = async (row: AliasRowInput, termType: ProductLanguageTermType) => {
    const canonical = productName.trim() || "Unnamed product";
    return submitCatalogueDraft({
      draftType: "alias",
      operation: "create",
      payload: buildContributorAliasDraftPayload({
        productId,
        canonicalName: canonical,
        aliasText: row.alias,
        termType,
        language: row.language,
        script: row.script,
        source: row.source,
      }),
      targetRecordId: null,
    });
  };

  const buildMutateDraftPayload = (row: AliasRowInput, termType: ProductLanguageTermType) => {
    const canonical = productName.trim() || "Unnamed product";
    return {
      ...buildContributorAliasDraftPayload({
        productId,
        canonicalName: canonical,
        aliasText: row.alias,
        termType,
        language: row.language,
        script: row.script,
        source: row.source,
      }),
      is_active: row.is_active ?? true,
    };
  };

  const addOne = async () => {
    const trimmed = draft.alias.trim();
    if (!trimmed || submitting || !canMutate) return;

    setSubmitting(true);
    try {
      const row: AliasRowInput = { ...draft, alias: trimmed, source: "manual", term_type: activeTermType };

      if (writeMode === "direct") {
        const ok = await addDirect([row], activeTermType);
        if (ok) {
          setDraft({ alias: "", language: "" });
          toast.success(`${TERM_TYPE_LABELS[activeTermType]} added.`);
        }
        return;
      }

      const res = await submitAliasCreateDraft(row, activeTermType);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setStoredTermType(productId, `draft:${trimmed.toLowerCase()}`, activeTermType);
      bumpTermTypes();
      setDraft({ alias: "", language: "" });
      toast.success("Submitted for approval. Approved aliases will appear here after review.");
    } finally {
      setSubmitting(false);
    }
  };

  const generate = async () => {
    if (submitting || !canMutate) return;

    const seeded = seedAliasesFromName(productName);
    const rows = seeded.map((a) => ({ ...a, source: "system_generated" }));
    if (!rows.length) {
      toast.info("Could not derive aliases from product name. Add them manually.");
      return;
    }

    setSubmitting(true);
    try {
      const termType: ProductLanguageTermType =
        activeTermType === "regional_term" ? "regional_term" : "search_keyword";

      if (writeMode === "direct") {
        const ok = await addDirect(rows, termType);
        if (ok) toast.success(`Added ${rows.length} starter terms`);
        return;
      }

      let submitted = 0;
      for (const row of rows) {
        const res = await submitAliasCreateDraft(row, termType);
        if (res.ok) submitted += 1;
        else toast.error(res.message);
      }
      if (submitted > 0) {
        toast.success(
          `Submitted ${submitted} draft${submitted === 1 ? "" : "s"} for approval.`,
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggle = async (item: any, v: boolean) => {
    if (submitting || !canMutate) return;
    const termType = resolveTermType(productId, item);

    setSubmitting(true);
    try {
      if (writeMode === "direct") {
        if (!hasAliasActiveFlag(item)) {
          toast.info("Active toggle is not supported on this catalogue schema.");
          return;
        }
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
        payload: buildMutateDraftPayload(
          {
            alias: getAliasText(item),
            language: item.language,
            script: item.script,
            alias_type: item.alias_type,
            source: item.source,
            is_active: v,
          },
          termType,
        ),
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
    const termType = resolveTermType(productId, item);

    setSubmitting(true);
    try {
      if (writeMode === "direct") {
        const { error } = await supabase.from("product_aliases").delete().eq("id", item.id);
        if (error) {
          toast.error(error.message);
          return;
        }
        removeStoredTermType(productId, item.id);
        bumpTermTypes();
        toast.success("Alias removed.");
        await load();
        return;
      }

      const res = await submitCatalogueDraft({
        draftType: "alias",
        operation: "delete_request",
        payload: buildMutateDraftPayload(
          {
            alias: getAliasText(item),
            language: item.language,
            script: item.script,
            alias_type: item.alias_type,
            source: item.source,
            is_active: item.is_active,
          },
          termType,
        ),
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
    navigator.clipboard.writeText(tabItems.map(({ item }) => getAliasText(item)).join("\n"));
    toast.success("Copied term list");
  };

  const changeItemTermType = (itemId: string, termType: ProductLanguageTermType) => {
    setStoredTermType(productId, itemId, termType);
    bumpTermTypes();
  };

  return (
    <div id={sectionId} className="card-elevated p-6 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-xl">Product language terms</h3>
          <p className="text-xs text-muted-foreground">
            Typed search and channel vocabulary — misspellings, customer phrases, WhatsApp keywords, regional names.
          </p>
          <p className="text-xs text-warning mt-2 leading-relaxed border border-warning/30 bg-warning/5 rounded-md px-2 py-1.5">
            {TERM_TYPE_UI_NOTICE}
          </p>
          {writeMode === "draft" && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Term changes are submitted for approval. Approved terms will appear here after review.
            </p>
          )}
        </div>
        {canMutate && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={generate} disabled={submitting}>
              <Sparkles className="h-4 w-4 mr-1" />Generate basic
            </Button>
            <Button size="sm" variant="ghost" onClick={copyAll} disabled={!tabItems.length || submitting}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        )}
        {!canMutate && (
          <Button size="sm" variant="ghost" onClick={copyAll} disabled={!tabItems.length}>
            <Copy className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="rounded-md border bg-muted/20 p-3 space-y-1">
        <Label className="text-xs text-muted-foreground">Official Name (read-only)</Label>
        <div className="text-sm font-medium">{officialName}</div>
        <p className="text-[11px] text-muted-foreground">Sourced from products.name — edit on the Identity tab.</p>
      </div>

      <Tabs value={activeTermType} onValueChange={(v) => setActiveTermType(v as ProductLanguageTermType)}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/40 p-1">
          {PRODUCT_LANGUAGE_TERM_TYPES.map((t) => (
            <TabsTrigger key={t} value={t} className="text-xs">
              {TERM_TYPE_LABELS[t]}
            </TabsTrigger>
          ))}
        </TabsList>

        {PRODUCT_LANGUAGE_TERM_TYPES.map((termType) => (
          <TabsContent key={termType} value={termType} className="mt-4 space-y-3">
            {termType === "whatsapp_keyword" && (
              <p className="text-xs text-warning border border-warning/30 bg-warning/5 rounded-md px-2 py-1.5">
                WhatsApp keywords affect order matching and require reviewer approval before use in chat flows.
              </p>
            )}

            {canMutate && (
              <div className="grid sm:grid-cols-[1fr_120px_auto] gap-2 items-end">
                <div>
                  <Label className="text-xs">New {TERM_TYPE_LABELS[termType].toLowerCase()}</Label>
                  <Input
                    value={draft.alias}
                    onChange={(e) => setDraft({ ...draft, alias: e.target.value })}
                    placeholder={
                      termType === "whatsapp_keyword"
                        ? "e.g. need cashew kitta"
                        : "e.g. Kaju Kitta"
                    }
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
                <Button onClick={addOne} disabled={submitting || !draft.alias.trim()}>
                  <Plus className="h-4 w-4 mr-1" />
                  {submitting ? "Submitting…" : writeMode === "draft" ? "Submit" : "Add"}
                </Button>
              </div>
            )}

            <div className="border-t pt-3 space-y-1.5 max-h-80 overflow-auto">
              {tabItems.map(({ item, termType: itemTermType }) => {
                const aliasText = getAliasText(item);
                const active = hasAliasActiveFlag(item) ? item.is_active : true;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 text-sm py-1.5 px-2 rounded ${active ? "" : "opacity-50"}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{aliasText}</div>
                      <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1">
                        <Badge variant="outline" className="text-[10px] py-0">
                          {TERM_TYPE_LABELS[itemTermType]}
                        </Badge>
                        {[item.language, item.source].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    {writeMode === "direct" && canMutate && (
                      <select
                        className="h-8 px-1 rounded border bg-background text-[11px] max-w-[120px]"
                        value={itemTermType}
                        onChange={(e) => changeItemTermType(item.id, e.target.value as ProductLanguageTermType)}
                        aria-label={`Term type for ${aliasText}`}
                      >
                        {PRODUCT_LANGUAGE_TERM_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {TERM_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    )}
                    {canMutate ? (
                      <>
                        {hasAliasActiveFlag(item) && (
                          <Switch
                            checked={!!item.is_active}
                            onCheckedChange={(v) => toggle(item, v)}
                            disabled={submitting}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => remove(item)}
                          disabled={submitting}
                          className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                          aria-label={`Remove ${aliasText}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">View only</span>
                    )}
                  </div>
                );
              })}
              {tabItems.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-3">
                  No {TERM_TYPE_LABELS[termType].toLowerCase()}s yet.
                </div>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
