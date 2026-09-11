import { AlertTriangle, FileArchive, Loader2, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  CATALOGUE_SOURCE_PRODUCT_CREATION_AUTHORITY,
  listCatalogueSourceBatches,
  listCatalogueSourceEntries,
  stageCatalogueSourceBatch,
} from "@/features/catalogueSourceIntake/repository";
import type {
  CatalogueSourceBatchRow,
  CatalogueSourceEntryInput,
  CatalogueSourceEntryRow,
} from "@/features/catalogueSourceIntake/types";
import type { Json } from "@/integrations/supabase/types";

const exampleEntries = JSON.stringify(
  [
    {
      sourceEntryKey: "page-001:item-001",
      sourcePageNumber: 1,
      sourceTitle: "Source catalogue item",
      sourceSku: null,
      sourceSlug: null,
      rawSourceData: { note: "Paste source evidence here" },
      candidateProductData: { note: "Optional normalized review candidate" },
    },
  ],
  null,
  2,
);

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error("Optional text fields must be strings or null.");
  return value;
}

function parseEntries(raw: string): CatalogueSourceEntryInput[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Entries must be valid JSON.");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Entries JSON must be a non-empty array.");
  }
  if (parsed.length > 500) {
    throw new Error("One intake submission is limited to 500 staged entries.");
  }

  return parsed.map((value, index) => {
    if (!isJsonObject(value)) throw new Error(`Entry ${index + 1} must be a JSON object.`);
    if (typeof value.sourceEntryKey !== "string" || !value.sourceEntryKey.trim()) {
      throw new Error(`Entry ${index + 1} requires sourceEntryKey.`);
    }
    const page = value.sourcePageNumber;
    if (page !== undefined && page !== null && (!Number.isInteger(page) || Number(page) <= 0)) {
      throw new Error(`Entry ${index + 1} sourcePageNumber must be a positive integer.`);
    }
    const rawSourceData = value.rawSourceData;
    if (!isJsonObject(rawSourceData)) {
      throw new Error(`Entry ${index + 1} rawSourceData must be a JSON object.`);
    }
    const candidate = value.candidateProductData;
    if (candidate !== undefined && !isJsonObject(candidate)) {
      throw new Error(
        `Entry ${index + 1} candidateProductData must be a JSON object when supplied.`,
      );
    }

    return {
      sourceEntryKey: value.sourceEntryKey,
      ...(page === undefined ? {} : { sourcePageNumber: page as number | null }),
      ...(value.sourceTitle === undefined ? {} : { sourceTitle: optionalText(value.sourceTitle) }),
      ...(value.sourceSku === undefined ? {} : { sourceSku: optionalText(value.sourceSku) }),
      ...(value.sourceSlug === undefined ? {} : { sourceSlug: optionalText(value.sourceSlug) }),
      rawSourceData: rawSourceData as Json,
      ...(candidate === undefined ? {} : { candidateProductData: candidate as Json }),
    };
  });
}

function statusTone(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "FAILED") return "destructive";
  if (status === "READY_FOR_REVIEW" || status === "REVIEWED") return "default";
  if (status === "ARCHIVED") return "outline";
  return "secondary";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function CatalogueSourceIntake() {
  const { user } = useAuth();
  const [batches, setBatches] = useState<CatalogueSourceBatchRow[]>([]);
  const [entries, setEntries] = useState<CatalogueSourceEntryRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [provider, setProvider] = useState("catalogue_upload");
  const [documentName, setDocumentName] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [revision, setRevision] = useState("");
  const [sourceHash, setSourceHash] = useState("");
  const [dedupeKey, setDedupeKey] = useState("");
  const [entriesJson, setEntriesJson] = useState(exampleEntries);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await listCatalogueSourceBatches();
      setBatches(next);
      setSelectedId((current) =>
        current && next.some((batch) => batch.id === current) ? current : (next[0]?.id ?? null),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load catalogue source batches.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedId) {
      setEntries([]);
      return;
    }
    setEntries([]);
    setEntriesLoading(true);
    void listCatalogueSourceEntries(selectedId)
      .then((next) => {
        if (!cancelled) setEntries(next);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setEntries([]);
          toast.error(error instanceof Error ? error.message : "Failed to load staged entries.");
        }
      })
      .finally(() => {
        if (!cancelled) setEntriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selected = useMemo(
    () => batches.find((batch) => batch.id === selectedId) ?? null,
    [batches, selectedId],
  );
  const stagedCount = entries.filter((entry) => entry.status === "STAGED").length;
  const matchedCount = entries.filter((entry) => entry.matched_product_id !== null).length;

  const handleStage = async () => {
    if (!documentName.trim() || !dedupeKey.trim() || !provider.trim()) {
      toast.error("Provider, document name and dedupe key are required.");
      return;
    }
    setSubmitting(true);
    try {
      const parsedEntries = parseEntries(entriesJson);
      const result = await stageCatalogueSourceBatch({
        sourceProvider: provider,
        sourceDocumentName: documentName,
        sourceDocumentId: documentId || null,
        sourceRevision: revision || null,
        sourceHash: sourceHash || null,
        dedupeKey,
        sourceMetadata: {
          intake_surface: "ai_studio_catalogue_source_workspace",
          product_creation_authority: false,
        },
        importedBy: user?.id ?? null,
        entries: parsedEntries,
      });
      toast.success(
        `${result.entriesSubmitted} source entr${result.entriesSubmitted === 1 ? "y" : "ies"} staged for review.`,
      );
      setSelectedId(result.batch.id);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Catalogue source staging failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Catalogue Source Intake"
        subtitle="Stage catalogue documents and candidate rows for governed review. This workspace cannot create products or publish commerce data."
        actions={
          <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        }
      />

      <Card className="mb-6 border-amber-500/40 bg-amber-500/5">
        <CardContent className="flex gap-3 p-4 sm:p-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Product creation authority is disabled.</p>
            <p className="text-muted-foreground">
              Source entries may stay unmatched indefinitely. Staging evidence, names, prices or
              images here does not add a product, approve a price, publish a website item or change
              product master.
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              CATALOGUE_SOURCE_PRODUCT_CREATION_AUTHORITY ={" "}
              {String(CATALOGUE_SOURCE_PRODUCT_CREATION_AUTHORITY)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="review" className="space-y-5">
        <TabsList>
          <TabsTrigger value="review">Review source</TabsTrigger>
          <TabsTrigger value="stage">Stage document</TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Source batches</CardDescription>
                <CardTitle>{batches.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Selected batch entries</CardDescription>
                <CardTitle>{entries.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Matched to existing products</CardDescription>
                <CardTitle>{matchedCount}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="text-lg">Batches</CardTitle>
                <CardDescription>Most recently updated source documents first.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {loading ? (
                  <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading source batches…
                  </div>
                ) : batches.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                    No catalogue source has been staged yet.
                  </div>
                ) : (
                  batches.map((batch) => (
                    <button
                      key={batch.id}
                      type="button"
                      onClick={() => setSelectedId(batch.id)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedId === batch.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 truncate font-medium">
                          {batch.source_document_name}
                        </span>
                        <Badge variant={statusTone(batch.status)}>
                          {batch.status.replaceAll("_", " ")}
                        </Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        <div>{batch.source_provider}</div>
                        <div className="mt-1 truncate font-mono">{batch.dedupe_key}</div>
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">
                      {selected?.source_document_name ?? "Select a source batch"}
                    </CardTitle>
                    <CardDescription>
                      {selected
                        ? `Imported ${formatDate(selected.imported_at)} · ${selected.source_provider}`
                        : "Choose a batch to inspect its staged source evidence."}
                    </CardDescription>
                  </div>
                  {selected && (
                    <Badge variant={statusTone(selected.status)}>
                      {selected.status.replaceAll("_", " ")}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {selected && (
                  <div className="mb-4 grid gap-2 rounded-lg border bg-muted/20 p-3 text-xs sm:grid-cols-2">
                    <div>
                      <span className="text-muted-foreground">Dedupe key:</span>{" "}
                      <span className="font-mono">{selected.dedupe_key}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Revision:</span>{" "}
                      {selected.source_revision ?? "—"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Source ID:</span>{" "}
                      {selected.source_document_id ?? "—"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Source hash:</span>{" "}
                      <span className="font-mono break-all">{selected.source_hash ?? "—"}</span>
                    </div>
                  </div>
                )}

                {entriesLoading ? (
                  <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading staged entries…
                  </div>
                ) : !selected ? null : entries.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                    This source batch has no staged entries.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{stagedCount} staged</Badge>
                      <Badge variant="outline">{matchedCount} matched existing</Badge>
                      <span>No approval or product-creation controls are exposed here.</span>
                    </div>
                    {entries.map((entry) => (
                      <details
                        key={entry.id}
                        className="rounded-lg border bg-background p-3 open:bg-muted/10"
                      >
                        <summary className="cursor-pointer list-none">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {entry.source_title || entry.source_entry_key}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {entry.source_sku ? `SKU ${entry.source_sku} · ` : ""}
                                {entry.source_slug ?? entry.source_entry_key}
                              </div>
                            </div>
                            <Badge variant={entry.status === "IGNORED" ? "outline" : "secondary"}>
                              {entry.status.replaceAll("_", " ")}
                            </Badge>
                          </div>
                        </summary>
                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          <div>
                            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Raw source evidence
                            </p>
                            <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap break-words">
                              {JSON.stringify(entry.raw_source_data, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Normalized candidate — review only
                            </p>
                            <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap break-words">
                              {JSON.stringify(entry.candidate_product_data, null, 2)}
                            </pre>
                          </div>
                        </div>
                        {entry.matched_product_id && (
                          <p className="mt-3 text-xs text-muted-foreground">
                            Matched existing product ID:{" "}
                            <span className="font-mono">{entry.matched_product_id}</span>
                          </p>
                        )}
                      </details>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stage">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Stage catalogue source
              </CardTitle>
              <CardDescription>
                Store source evidence for later review. This does not create, match, approve or
                publish products.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5 text-sm">
                  <label htmlFor="catalogue-source-provider">Source provider *</label>
                  <Input
                    id="catalogue-source-provider"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    placeholder="catalogue_upload"
                  />
                </div>
                <div className="space-y-1.5 text-sm">
                  <label htmlFor="catalogue-source-document-name">Document name *</label>
                  <Input
                    id="catalogue-source-document-name"
                    value={documentName}
                    onChange={(e) => setDocumentName(e.target.value)}
                    placeholder="Oasis catalogue 2026–2027"
                  />
                </div>
                <div className="space-y-1.5 text-sm">
                  <label htmlFor="catalogue-source-document-id">Source document ID</label>
                  <Input
                    id="catalogue-source-document-id"
                    value={documentId}
                    onChange={(e) => setDocumentId(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 text-sm">
                  <label htmlFor="catalogue-source-revision">Revision</label>
                  <Input
                    id="catalogue-source-revision"
                    value={revision}
                    onChange={(e) => setRevision(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 text-sm">
                  <label htmlFor="catalogue-source-hash">Source hash</label>
                  <Input
                    id="catalogue-source-hash"
                    value={sourceHash}
                    onChange={(e) => setSourceHash(e.target.value)}
                    placeholder="Optional SHA-256 or source fingerprint"
                  />
                </div>
                <div className="space-y-1.5 text-sm">
                  <label htmlFor="catalogue-source-dedupe-key">Dedupe key *</label>
                  <Input
                    id="catalogue-source-dedupe-key"
                    value={dedupeKey}
                    onChange={(e) => setDedupeKey(e.target.value)}
                    placeholder="catalogue:2026-2027:rev-1"
                  />
                </div>
              </div>

              <div className="space-y-1.5 text-sm">
                <label htmlFor="catalogue-source-entries-json">Source entries JSON *</label>
                <Textarea
                  id="catalogue-source-entries-json"
                  value={entriesJson}
                  onChange={(e) => setEntriesJson(e.target.value)}
                  className="min-h-[360px] font-mono text-xs"
                  spellCheck={false}
                />
              </div>

              <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
                <p>
                  Candidate prices, names, SKUs, media or descriptions remain source evidence only.
                  They do not become product master or D2C commerce authority through this intake.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => void handleStage()} disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileArchive className="mr-2 h-4 w-4" />
                  )}
                  Stage for review
                </Button>
                <span className="text-xs text-muted-foreground">
                  Replay is idempotent by dedupe key + entry key.
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
