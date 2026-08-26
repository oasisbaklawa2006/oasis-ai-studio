import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { runAllKnowledgeGoldenCases } from "@/features/productIntelligence/knowledge/goldenHarness";
import {
  buildKnowledgePublicationCandidate,
  buildWhatsAppIntelligenceKnowledge,
  type KnowledgeCandidateStatus,
  type KnowledgeHandoffEligibility,
  knowledgeContentChecksum,
  type WhatsAppIntelligenceKnowledge,
  type WhatsAppKnowledgePublicationCandidate,
} from "@/features/productIntelligence/knowledge/knowledgeBundle";
import {
  catalogModeLabel,
  type KnowledgeCatalogLoadResult,
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
import {
  evaluateHandoffSubmission,
  publicationUiLabel,
  submissionStateShouldReset,
} from "@/features/productIntelligence/knowledge/publishSubmissionState";
import {
  buildKnowledgeSubmissionIdempotencyKey,
  type CoreKnowledgeSnapshotRow,
  classifyKnowledgeSubmissionError,
  type KnowledgeSubmissionError,
  submitKnowledgeDraftToCore,
} from "@/features/productIntelligence/knowledge/submitKnowledgeDraft";
import type { RuntimeCatalog } from "@/features/productIntelligence/runtime/types";

const TABS = ["Knowledge", "Test", "Failures", "Publish"] as const;
type Tab = (typeof TABS)[number];

function candidateSemantics(
  isFixture: boolean,
  handoffReady: boolean,
): {
  candidateStatus: KnowledgeCandidateStatus;
  handoffEligibility: KnowledgeHandoffEligibility;
} {
  if (isFixture) {
    return {
      candidateStatus: "TEST_CANDIDATE",
      handoffEligibility: "NOT_HANDOFF_ELIGIBLE",
    };
  }
  return {
    candidateStatus: "PUBLICATION_CANDIDATE",
    handoffEligibility: handoffReady ? "HANDOFF_READY" : "NOT_HANDOFF_READY",
  };
}

export default function ProductIntelligenceKnowledgePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("Knowledge");
  const [catalogMode, setCatalogMode] = useState<KnowledgeCatalogMode>("live");
  const [catalogLoad, setCatalogLoad] = useState<KnowledgeCatalogLoadResult | null>(null);
  const [catalogLabel, setCatalogLabel] = useState("Loading catalogue…");
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [testInput, setTestInput] = useState("pista bulbul");
  const [publicationJson, setPublicationJson] = useState("Preparing publication candidate…");
  const [checksum, setChecksum] = useState("");
  const [publicationCandidate, setPublicationCandidate] =
    useState<WhatsAppKnowledgePublicationCandidate | null>(null);
  const [coreSnapshot, setCoreSnapshot] = useState<CoreKnowledgeSnapshotRow | null>(null);
  const [submittedChecksum, setSubmittedChecksum] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionFailed, setSubmissionFailed] = useState(false);
  const [submissionError, setSubmissionError] = useState<KnowledgeSubmissionError | null>(null);
  const priorHandoffIdentityRef = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogLoad(null);
    setChecksum("");
    setPublicationJson("Preparing publication candidate…");
    setCatalogError(null);
    setCatalogLabel(catalogModeLabel(catalogMode));
    void loadKnowledgeCatalog(catalogMode)
      .then((loaded) => {
        if (controller.signal.aborted) return;
        setCatalogLoad(loaded);
        setCatalogLabel(loaded.label);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setCatalogLoad(null);
        setCatalogError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      controller.abort();
    };
  }, [catalogMode]);

  const catalog: RuntimeCatalog | null = catalogLoad?.catalog ?? null;
  const isFixture = catalogMode !== "live";
  const knowledge: WhatsAppIntelligenceKnowledge | null = useMemo(() => {
    if (!catalog || !catalogLoad) return null;
    return buildWhatsAppIntelligenceKnowledge(
      catalog,
      catalogLoad.provenance.sourceCatalogueVersionIds,
    );
  }, [catalog, catalogLoad]);

  const goldenReports = useMemo(() => runAllKnowledgeGoldenCases(), []);
  const failureInsights = useMemo(
    () =>
      analyzeKnowledgeFailures([
        ...goldenReports.phase2a.failed,
        ...goldenReports.production.failed,
      ]),
    [goldenReports],
  );

  const publicationInput = useMemo(() => {
    if (!knowledge || !catalog || !catalogLoad) return null;
    const semantics = candidateSemantics(isFixture, catalogLoad.provenance.handoffReady);
    return {
      knowledge,
      preparedBy: user?.email ?? null,
      candidateStatus: semantics.candidateStatus,
      handoffEligibility: semantics.handoffEligibility,
      provenanceReason: catalogLoad.provenance.provenanceReason,
      sourceSummary: {
        mode: catalogMode === "live" ? ("live_catalogue" as const) : catalogMode,
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
    };
  }, [catalog, catalogLoad, catalogMode, goldenReports, isFixture, knowledge, user?.email]);

  useEffect(() => {
    if (!publicationInput) return;
    const controller = new AbortController();
    void (async () => {
      const checksumValue = await knowledgeContentChecksum(publicationInput.knowledge);
      const candidate = await buildKnowledgePublicationCandidate(publicationInput);
      if (controller.signal.aborted) return;
      setChecksum(checksumValue);
      setPublicationCandidate(candidate);
      setPublicationJson(JSON.stringify(candidate, null, 2));
      const nextHandoffIdentity = buildKnowledgeSubmissionIdempotencyKey(candidate);
      if (
        submissionStateShouldReset({
          priorHandoffIdentity: priorHandoffIdentityRef.current,
          nextHandoffIdentity,
          submittedChecksum,
          candidateChecksum: candidate.content_checksum,
        })
      ) {
        setCoreSnapshot(null);
        setSubmittedChecksum(null);
        setSubmissionFailed(false);
        setSubmissionError(null);
      }
      priorHandoffIdentityRef.current = nextHandoffIdentity;
    })();
    return () => {
      controller.abort();
    };
  }, [publicationInput, submittedChecksum]);

  const derivedIdempotencyKey = useMemo(
    () =>
      publicationCandidate ? buildKnowledgeSubmissionIdempotencyKey(publicationCandidate) : null,
    [publicationCandidate],
  );

  const handoffEvaluation = useMemo(
    () =>
      evaluateHandoffSubmission({
        candidate: publicationCandidate,
        isFixture,
        goldenSummary: publicationCandidate?.golden_test_summary ?? null,
        currentChecksum: checksum || null,
        submittedChecksum,
        isSubmitting,
        submissionFailed,
      }),
    [checksum, isFixture, isSubmitting, publicationCandidate, submissionFailed, submittedChecksum],
  );

  async function handleSubmitToCore(): Promise<void> {
    if (!publicationCandidate || !handoffEvaluation.canSubmit) return;
    const idempotencyKey = buildKnowledgeSubmissionIdempotencyKey(publicationCandidate);
    setIsSubmitting(true);
    setSubmissionFailed(false);
    setSubmissionError(null);
    try {
      const result = await submitKnowledgeDraftToCore(publicationCandidate, { idempotencyKey });
      setCoreSnapshot(result.snapshot);
      setSubmittedChecksum(publicationCandidate.content_checksum);
      setSubmissionFailed(false);
      setSubmissionError(null);
    } catch (error) {
      const classified =
        typeof error === "object" &&
        error !== null &&
        "classified" in error &&
        (error as { classified?: KnowledgeSubmissionError }).classified
          ? (error as { classified: KnowledgeSubmissionError }).classified
          : classifyKnowledgeSubmissionError({
              message: error instanceof Error ? error.message : String(error),
            });
      setSubmissionFailed(true);
      setSubmissionError(classified);
    } finally {
      setIsSubmitting(false);
    }
  }

  const workbench = useMemo(() => {
    if (!catalog || !knowledge || !testInput.trim()) return null;
    return resolveKnowledgeWorkbench(testInput, catalog, checksum || "pending");
  }, [catalog, checksum, knowledge, testInput]);

  const handoffEligibility = catalogLoad
    ? candidateSemantics(isFixture, catalogLoad.provenance.handoffReady).handoffEligibility
    : null;

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
            Test fixture corpus — TEST_CANDIDATE only. NOT HANDOFF ELIGIBLE. Cannot become a live
            Core handoff candidate.
          </p>
        ) : (
          <p className="text-xs text-emerald-800">
            Live/canonical knowledge source — read-only product master and approved aliases.
          </p>
        )}
        {catalogLoad && !isFixture ? (
          <p className="text-xs text-muted-foreground">
            Alias queries: {catalogLoad.aliasQueryCount} bulk read
            {catalogLoad.aliasQueryCount === 1 ? "" : "s"} · Catalogue version provenance:{" "}
            {catalogLoad.provenance.provenanceReason}
          </p>
        ) : null}
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

      {tab === "Knowledge" && knowledge && catalogLoad ? (
        <section className="rounded-md border p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Canonical SKUs, aliases, packaging references, and explicit ambiguity markers. Core
            remains the only runtime activation authority.
          </p>
          <p className="text-sm">
            Derived catalogue version ids:{" "}
            {knowledge.source_catalogue_version_ids.length
              ? knowledge.source_catalogue_version_ids.join(", ")
              : "none (not handoff ready until immutable catalogue_versions link every active product)"}
          </p>
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

      {tab === "Publish" && knowledge && catalogLoad ? (
        <section className="rounded-md border p-4 space-y-3">
          <p className="text-sm font-medium">Prepared for governed Core publication</p>
          <div className="rounded border border-dashed p-3 space-y-2">
            <p className="text-sm font-medium">{publicationUiLabel(handoffEvaluation.uiState)}</p>
            {handoffEvaluation.blockMessage ? (
              <p className="text-sm text-amber-800">{handoffEvaluation.blockMessage}</p>
            ) : null}
            {submissionError ? (
              <p className="text-sm text-destructive">
                {submissionError.code.replaceAll("_", " ")}: {submissionError.message}
              </p>
            ) : null}
            {coreSnapshot ? (
              <div className="text-sm space-y-1">
                <p>
                  Core snapshot id: <span className="font-mono text-xs">{coreSnapshot.id}</span>
                </p>
                <p>Core lifecycle: {coreSnapshot.lifecycle}</p>
                <p>Core review required before approval or activation.</p>
              </div>
            ) : null}
            <Button
              type="button"
              disabled={!handoffEvaluation.canSubmit || isSubmitting || !user}
              onClick={() => {
                void handleSubmitToCore();
              }}
            >
              {isSubmitting ? "Submitting to Core…" : "Submit to Core as Draft"}
            </Button>
            {!user ? (
              <p className="text-xs text-muted-foreground">
                Authenticated team-member session required for governed Core submission.
              </p>
            ) : null}
          </div>
          <ul className="text-sm list-disc pl-5 space-y-1">
            <li>
              Candidate status:{" "}
              {isFixture
                ? "TEST_CANDIDATE (DRAFT semantics only)"
                : "PUBLICATION_CANDIDATE (DRAFT)"}
            </li>
            <li>
              Handoff eligibility:{" "}
              {handoffEligibility === "HANDOFF_READY"
                ? "HANDOFF READY"
                : handoffEligibility === "NOT_HANDOFF_ELIGIBLE"
                  ? "NOT HANDOFF ELIGIBLE (fixture)"
                  : "NOT HANDOFF READY (missing derived catalogue version provenance)"}
            </li>
            <li>Core review: {coreSnapshot ? "PENDING IN CORE" : "NOT EXECUTED"}</li>
            <li>Core approval: NOT EXECUTED</li>
            <li>Core activation: NOT EXECUTED</li>
            <li>Not reviewed · Not approved · Not active</li>
          </ul>
          {derivedIdempotencyKey ? (
            <p className="font-mono text-xs break-all">idempotency {derivedIdempotencyKey}</p>
          ) : null}
          {isFixture ? (
            <p className="text-xs text-amber-800">
              Fixture source — regression/test candidate only. No live Core handoff.
            </p>
          ) : null}
          <p className="font-mono text-xs break-all">checksum {checksum || "computing…"}</p>
          <p className="text-xs text-muted-foreground">
            AI Studio prepares deterministic knowledge and may submit a governed Core DRAFT only.
            Core owns review, approval, publication, activation, and single ACTIVE snapshot
            selection. No service_role browser path and no direct Core lifecycle mutation from this
            page.
          </p>
          <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-[11px]">
            {publicationJson}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
