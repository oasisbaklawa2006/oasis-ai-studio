import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { runAllKnowledgeGoldenCases } from "@/features/productIntelligence/knowledge/goldenHarness";
import {
  buildKnowledgePublicationCandidate,
  buildWhatsAppIntelligenceKnowledge,
  knowledgeContentChecksum,
  type WhatsAppIntelligenceKnowledge,
} from "@/features/productIntelligence/knowledge/knowledgeBundle";
import {
  catalogModeLabel,
  type KnowledgeCatalogMode,
  loadKnowledgeCatalog,
} from "@/features/productIntelligence/knowledge/knowledgeCatalogSource";
import {
  analyzeKnowledgeFailures,
  suggestedActionLabel,
} from "@/features/productIntelligence/knowledge/knowledgeFailureAnalysis";
import {
  KNOWLEDGE_WORKBENCH_EXAMPLES,
  resolveKnowledgeWorkbench,
} from "@/features/productIntelligence/knowledge/knowledgeResolverWorkbench";
import type { RuntimeCatalog } from "@/features/productIntelligence/runtime/types";

const TABS = ["Knowledge", "Test", "Failures", "Publish"] as const;
type Tab = (typeof TABS)[number];

export default function ProductIntelligenceKnowledgePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("Knowledge");
  const [catalogMode, setCatalogMode] = useState<KnowledgeCatalogMode>("live");
  const [catalog, setCatalog] = useState<RuntimeCatalog | null>(null);
  const [catalogLabel, setCatalogLabel] = useState("Loading catalogue…");
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [sourceIds, setSourceIds] = useState("");
  const [testInput, setTestInput] = useState("pista bulbul");
  const [publicationJson, setPublicationJson] = useState("Preparing publication candidate…");
  const [checksum, setChecksum] = useState("");

  useEffect(() => {
    let cancelled = false;
    setCatalog(null);
    setChecksum("");
    setPublicationJson("Preparing publication candidate…");
    setCatalogError(null);
    setCatalogLabel(catalogModeLabel(catalogMode));
    void loadKnowledgeCatalog(catalogMode)
      .then((loaded) => {
        if (cancelled) return;
        setCatalog(loaded.catalog);
        setCatalogLabel(loaded.label);
      })
      .catch((error) => {
        if (cancelled) return;
        setCatalog(null);
        setCatalogError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [catalogMode]);

  const isFixture = catalogMode !== "live";
  const knowledge: WhatsAppIntelligenceKnowledge | null = useMemo(() => {
    if (!catalog) return null;
    return buildWhatsAppIntelligenceKnowledge(catalog, sourceIds.split(/[\s,]+/).filter(Boolean));
  }, [catalog, sourceIds]);

  const goldenReports = useMemo(() => runAllKnowledgeGoldenCases(), []);
  const failureInsights = useMemo(
    () =>
      analyzeKnowledgeFailures([
        ...goldenReports.phase2a.failed,
        ...goldenReports.production.failed,
      ]),
    [goldenReports],
  );

  useEffect(() => {
    if (!knowledge || !catalog) return;
    const modeForCandidate = catalogMode;
    let cancelled = false;
    void (async () => {
      const checksumValue = await knowledgeContentChecksum(knowledge);
      const candidate = await buildKnowledgePublicationCandidate({
        knowledge,
        preparedBy: user?.email ?? null,
        sourceSummary: {
          mode: modeForCandidate === "live" ? "live_catalogue" : modeForCandidate,
          product_count: catalog.products.length,
          alias_count: catalog.aliases.length,
          ambiguous_term_count: knowledge.ambiguous_terms.length,
        },
        goldenSummary: {
          phase2a_passed: goldenReports.phase2a.passed,
          phase2a_total: goldenReports.phase2a.total,
          production_passed: goldenReports.production.passed,
          production_total: goldenReports.production.total,
        },
      });
      if (cancelled || modeForCandidate !== catalogMode) return;
      setChecksum(checksumValue);
      setPublicationJson(JSON.stringify(candidate, null, 2));
    })();
    return () => {
      cancelled = true;
    };
  }, [catalog, catalogMode, goldenReports, knowledge, user?.email]);

  const workbench = useMemo(() => {
    if (!catalog || !knowledge || !testInput.trim()) return null;
    return resolveKnowledgeWorkbench(testInput, catalog, checksum || "pending");
  }, [catalog, checksum, knowledge, testInput]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="WhatsApp product knowledge"
        subtitle="Knowledge and learning plane only. Author terminology for Core consumption — not order processing, not activation."
      />

      <section className="rounded-md border p-4 space-y-3">
        <p className="text-sm font-medium">Knowledge source</p>
        <div className="flex flex-wrap gap-2">
          {(["live", "phase2a_fixture", "production_fixture"] as const).map((mode) => (
            <Button
              key={mode}
              type="button"
              size="sm"
              variant={catalogMode === mode ? "default" : "outline"}
              onClick={() => {
                setCatalogMode(mode);
              }}
            >
              {mode === "live"
                ? "Live catalogue"
                : mode === "phase2a_fixture"
                  ? "Phase 2A fixture"
                  : "Production fixture"}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{catalogLabel}</p>
        {isFixture ? (
          <p className="text-xs text-amber-800">
            Test fixture corpus — cannot become a live publication candidate without switching to
            the live canonical source.
          </p>
        ) : (
          <p className="text-xs text-emerald-800">
            Live/canonical knowledge source — read-only product master and approved aliases.
          </p>
        )}
        {catalogError ? <p className="text-sm text-destructive">{catalogError}</p> : null}
      </section>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <Button
            key={item}
            type="button"
            size="sm"
            variant={tab === item ? "default" : "outline"}
            onClick={() => {
              setTab(item);
            }}
          >
            {item}
          </Button>
        ))}
      </div>

      {tab === "Knowledge" && knowledge ? (
        <section className="rounded-md border p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Canonical SKUs, aliases, packaging references, and explicit ambiguity markers. Core
            remains the only runtime activation authority.
          </p>
          <label className="block text-sm" htmlFor="wa-knowledge-source-ids">
            Source catalogue version ids (references only)
            <Textarea
              id="wa-knowledge-source-ids"
              className="mt-1"
              value={sourceIds}
              onChange={(event) => {
                setSourceIds(event.target.value);
              }}
              placeholder="uuid-1, uuid-2"
            />
          </label>
          <p className="text-sm">SKUs: {Object.keys(knowledge.sku_map).length}</p>
          <p className="text-sm">Aliases: {Object.keys(knowledge.aliases).length}</p>
          <p className="text-sm">Ambiguous terms: {knowledge.ambiguous_terms.length}</p>
          <p className="text-sm">Packaging references: {Object.keys(knowledge.packaging).length}</p>
        </section>
      ) : null}

      {tab === "Test" && catalog && knowledge ? (
        <section className="rounded-md border p-4 space-y-4">
          <label className="block text-sm" htmlFor="wa-knowledge-test-input">
            Product phrase
            <Input
              id="wa-knowledge-test-input"
              className="mt-1"
              value={testInput}
              onChange={(event) => {
                setTestInput(event.target.value);
              }}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {KNOWLEDGE_WORKBENCH_EXAMPLES.map((example) => (
              <Button
                key={example}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setTestInput(example);
                }}
              >
                {example}
              </Button>
            ))}
          </div>
          {workbench ? (
            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              <p>
                <span className="font-medium">Input:</span> {workbench.input}
              </p>
              <p>
                <span className="font-medium">Normalized input:</span> {workbench.normalizedInput}
              </p>
              <p>
                <span className="font-medium">Resolution status:</span> {workbench.resolutionStatus}
              </p>
              <p>
                <span className="font-medium">Resolved SKU:</span> {workbench.resolvedSku ?? "none"}
              </p>
              <p>
                <span className="font-medium">Match method:</span> {workbench.matchMethod}
              </p>
              <p>
                <span className="font-medium">Knowledge checksum:</span>{" "}
                {workbench.knowledgeChecksum}
              </p>
              <p className="sm:col-span-2">
                <span className="font-medium">Why it matched:</span> {workbench.whyMatched}
              </p>
              {workbench.whyFailed ? (
                <p className="sm:col-span-2">
                  <span className="font-medium">Why it failed / needs clarification:</span>{" "}
                  {workbench.whyFailed}
                </p>
              ) : null}
              {workbench.packagingContext ? (
                <p>
                  <span className="font-medium">Packaging context:</span>{" "}
                  {workbench.packagingContext}
                </p>
              ) : null}
              {workbench.familyContext ? (
                <p>
                  <span className="font-medium">Family context:</span> {workbench.familyContext}
                </p>
              ) : null}
              <div className="sm:col-span-2">
                <p className="font-medium">Candidates</p>
                {workbench.candidates.length === 0 ? (
                  <p className="text-muted-foreground">No candidates</p>
                ) : (
                  <ul className="list-disc pl-5">
                    {workbench.candidates.map((candidate) => (
                      <li key={`${candidate.sku}-${candidate.matchedTerm}`}>
                        {candidate.sku} — {candidate.name} ({candidate.matchSource},{" "}
                        {(candidate.confidence * 100).toFixed(1)}%)
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Read-only resolver workbench. No orders, WhatsApp mutation, or customer history.
          </p>
        </section>
      ) : null}

      {tab === "Failures" ? (
        <section className="rounded-md border p-4 space-y-3">
          <p className="text-sm">
            Phase 2A golden: {goldenReports.phase2a.passed}/{goldenReports.phase2a.total} passed ·
            Production-shaped: {goldenReports.production.passed}/{goldenReports.production.total}{" "}
            passed
          </p>
          {failureInsights.length === 0 ? (
            <p className="text-sm">No golden failures on protected corpora.</p>
          ) : (
            failureInsights.map((row) => (
              <div key={row.utterance} className="rounded border p-3 text-sm space-y-1">
                <p className="font-medium">{row.utterance}</p>
                <p>Expected: {row.expectedOutcome}</p>
                <p>Actual: {row.actualOutcome}</p>
                <p>Category: {row.failureCategory}</p>
                {row.ambiguityReason ? <p>Ambiguity: {row.ambiguityReason}</p> : null}
                <p>Suggested action: {suggestedActionLabel(row.suggestedAction)}</p>
              </div>
            ))
          )}
        </section>
      ) : null}

      {tab === "Publish" && knowledge ? (
        <section className="rounded-md border p-4 space-y-3">
          <p className="text-sm font-medium">Prepared for governed Core publication</p>
          <ul className="text-sm list-disc pl-5 space-y-1">
            <li>Candidate status: PUBLICATION_CANDIDATE (DRAFT only)</li>
            <li>Core review: NOT EXECUTED</li>
            <li>Core approval: NOT EXECUTED</li>
            <li>Core activation: NOT EXECUTED</li>
            <li>Not reviewed · Not approved · Not active</li>
          </ul>
          {isFixture ? (
            <p className="text-xs text-amber-800">
              Fixture source selected — switch to live catalogue before preparing a real handoff
              candidate.
            </p>
          ) : null}
          <p className="font-mono text-xs break-all">checksum {checksum || "computing…"}</p>
          <p className="text-xs text-muted-foreground">
            AI Studio prepares deterministic knowledge only. Core owns review, approval,
            publication, activation, and single ACTIVE snapshot selection. No service_role browser
            path and no direct Core lifecycle mutation from this page.
          </p>
          <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-[11px]">
            {publicationJson}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
