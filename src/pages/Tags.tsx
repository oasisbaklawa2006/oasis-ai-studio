import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { CatalogueWriteModeBanner } from "@/components/CatalogueWriteModeBanner";
import { submitCatalogueDraft } from "@/features/catalogueDrafts/draftService";
import { draftTableMap } from "@/features/catalogueDrafts/draftTableMap";
import {
  canSubmitDraft,
  canWriteMasterDirectly,
  isCatalogueContributor,
} from "@/shared/auth/centralPermissions";
import type { Role } from "@/lib/permissions";

const groups = ["occasion", "market", "family", "style", "packaging"];

const DIRECT_TAG_ROLES: Role[] = ["owner", "admin", "product_manager", "catalogue_manager"];

type WriteMode = "direct" | "draft" | "readonly";

const Tags = () => {
  const { roles } = useAuth();
  const [tags, setTags] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [group, setGroup] = useState("occasion");
  const [writeMode, setWriteMode] = useState<WriteMode>("readonly");
  const [submitting, setSubmitting] = useState(false);

  const load = () => supabase.from("tags").select("*").order("group_name").then(({ data }) => setTags(data ?? []));

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    (async () => {
      const roleList = roles as Role[];
      const hasLegacyDirect = roleList.some((r) => DIRECT_TAG_ROLES.includes(r));
      if (hasLegacyDirect || (await canWriteMasterDirectly())) {
        setWriteMode("direct");
        return;
      }
      if (await isCatalogueContributor()) {
        const canSubmit = await canSubmitDraft(draftTableMap.tag.permission);
        setWriteMode(canSubmit ? "draft" : "readonly");
        return;
      }
      setWriteMode("readonly");
    })();
  }, [roles]);

  const canMutate = writeMode === "direct" || writeMode === "draft";

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed || submitting || !canMutate) return;

    setSubmitting(true);
    try {
      if (writeMode === "direct") {
        const { error } = await supabase.from("tags").insert({ name: trimmed, group_name: group });
        if (error) {
          toast.error(error.message);
          return;
        }
        setName("");
        toast.success("Tag added.");
        load();
        return;
      }

      const res = await submitCatalogueDraft({
        draftType: "tag",
        operation: "create",
        payload: { scope: "tag_vocabulary", name: trimmed, group_name: group },
        targetRecordId: null,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setName("");
      toast.success(
        "Submitted for approval. Tags shown here are live master tags; yours will appear after a reviewer approves the draft.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const del = async (tag: { id: string; name: string; group_name: string }) => {
    if (submitting || !canMutate) return;

    setSubmitting(true);
    try {
      if (writeMode === "direct") {
        const { error } = await supabase.from("tags").delete().eq("id", tag.id);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Tag removed.");
        load();
        return;
      }

      const res = await submitCatalogueDraft({
        draftType: "tag",
        operation: "delete_request",
        payload: { scope: "tag_vocabulary", name: tag.name, group_name: tag.group_name },
        targetRecordId: tag.id,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(
        "Delete request submitted for approval. This tag stays visible until a reviewer approves the removal.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <CatalogueWriteModeBanner />
      <PageHeader title="Tag Manager" subtitle="Flexible tagging by occasion, market, family, style, packaging." />

      {writeMode === "draft" && (
        <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
          You can submit new tags or delete requests for approval. Only approved changes update the master tag list below.
        </p>
      )}

      <div className="card-elevated p-5 mb-6 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <Label>Tag name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Wedding"
            disabled={!canMutate || submitting}
          />
        </div>
        <div>
          <Label>Group</Label>
          <select
            className="h-10 px-3 rounded-md border bg-background text-sm w-full disabled:opacity-50"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            disabled={!canMutate || submitting}
          >
            {groups.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </div>
        <Button onClick={add} disabled={!canMutate || submitting || !name.trim()}>
          {submitting ? "Submitting…" : writeMode === "draft" ? "Submit for approval" : "Add tag"}
        </Button>
      </div>

      {groups.map((g) => (
        <div key={g} className="mb-6">
          <h3 className="font-display text-xl capitalize mb-2">{g}</h3>
          <div className="flex flex-wrap gap-2">
            {tags
              .filter((t) => t.group_name === g)
              .map((t) => (
                <span key={t.id} className="badge-soft bg-secondary text-secondary-foreground pr-1.5">
                  {t.name}
                  {canMutate && (
                    <button
                      type="button"
                      onClick={() => del(t)}
                      disabled={submitting}
                      className="ml-1 hover:text-destructive disabled:opacity-40"
                      aria-label={`Remove ${t.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
          </div>
        </div>
      ))}
    </>
  );
};

export default Tags;
