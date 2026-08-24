import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PHASE2A_FIXTURE_CATALOG } from "@/features/productIntelligence/runtime/fixtures/phase2aCatalog";
import {
  buildWhatsAppIntelligenceKnowledge,
  previewApprovedKnowledgePublication,
} from "@/features/productIntelligence/knowledge/knowledgeBundle";
import { runKnowledgeGoldenCases } from "@/features/productIntelligence/knowledge/goldenHarness";

const TABS = ["Knowledge", "Test", "Failures", "Publish"] as const;
type Tab = (typeof TABS)[number];

export default function ProductIntelligenceKnowledgePage() {
  const [tab, setTab] = useState<Tab>("Knowledge");
  const [sourceIds, setSourceIds] = useState("");
  const knowledge = useMemo(
    () =>
      buildWhatsAppIntelligenceKnowledge(
        PHASE2A_FIXTURE_CATALOG,
        sourceIds.split(/[\s,]+/).filter(Boolean),
      ),
    [sourceIds],
  );
  const report = useMemo(() => runKnowledgeGoldenCases(PHASE2A_FIXTURE_CATALOG), []);
  const [publicationJson, setPublicationJson] = useState("Preparing publication preview…");
  const [checksum, setChecksum] = useState("");
  useEffect(() => {
    let cancelled = false;
    void previewApprovedKnowledgePublication(knowledge).then((publication) => {
      if (cancelled) return;
      setChecksum(publication.content_checksum);
      setPublicationJson(JSON.stringify(publication, null, 2));
    });
    return () => {
      cancelled = true;
    };
  }, [knowledge]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="WhatsApp product knowledge"
        subtitle="Author terminology for Core. This is not operational execution and does not include customer history."
      />
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <Button
            key={item}
            type="button"
            size="sm"
            variant={tab === item ? "default" : "outline"}
            onClick={() => setTab(item)}
          >
            {item}
          </Button>
        ))}
      </div>

      {tab === "Knowledge" ? (
        <section className="rounded-md border p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Canonical SKUs, aliases, and family names from productIntelligence. Core remains the only
            runtime authority after an ACTIVE snapshot is selected.
          </p>
          <label className="block text-sm">
            Source catalogue version ids (references only)
            <Textarea
              className="mt-1"
              value={sourceIds}
              onChange={(event) => setSourceIds(event.target.value)}
              placeholder="uuid-1, uuid-2"
            />
          </label>
          <p className="text-sm">SKUs: {Object.keys(knowledge.sku_map).length}</p>
          <p className="text-sm">Aliases: {Object.keys(knowledge.aliases).length}</p>
          <p className="text-sm">Ambiguous names: {knowledge.ambiguous_terms.length}</p>
        </section>
      ) : null}

      {tab === "Test" ? (
        <section className="rounded-md border p-4 space-y-2">
          <p className="text-sm">Golden cases: {report.passed}/{report.total} passed</p>
          <p className="text-xs text-muted-foreground">
            Family-level terms such as “midya” must stay unresolved. This test plane does not create orders.
          </p>
        </section>
      ) : null}

      {tab === "Failures" ? (
        <section className="rounded-md border p-4 space-y-2">
          {report.failed.length === 0 ? (
            <p className="text-sm">No golden failures on the protected fixture corpus.</p>
          ) : (
            report.failed.map((row) => (
              <div key={row.utterance} className="rounded border p-2 text-sm">
                <p className="font-medium">{row.utterance}</p>
                <p>Resolved: {row.resolvedSku ?? "unresolved"}</p>
                <p>{row.reason}</p>
              </div>
            ))
          )}
        </section>
      ) : null}

      {tab === "Publish" ? (
        <section className="rounded-md border p-4 space-y-3">
          <p className="text-sm">
            Lifecycle: APPROVED. Core activation: NOT_EXECUTED.
          </p>
          <p className="font-mono text-xs break-all">checksum {checksum || "computing…"}</p>
          <p className="text-xs text-muted-foreground">
            This preview is the payload Core already consumes after knowledge-snapshot governance.
            Live insert/activate stays service-role in Core and is not executed from this page.
          </p>
          <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-[11px]">
            {publicationJson}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
