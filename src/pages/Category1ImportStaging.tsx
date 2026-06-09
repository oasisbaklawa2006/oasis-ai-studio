import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, FileCheck, AlertTriangle, Copy, Send, ExternalLink } from "lucide-react";
import { AuthorityStatusBadges } from "@/components/catalogueAuthority/AuthorityStatusBadges";
import { CATEGORY1_TARGET_FIELDS } from "@/features/category1Import/columnMapping";
import { detectExistingProductDuplicates } from "@/features/category1Import/duplicateDetection";
import { parseCategory1File } from "@/features/category1Import/parseFile";
import { newBatchId, submitCategory1StagingBatch } from "@/features/category1Import/submitStagingBatch";
import type { ParseFileResult, StagedCategory1Row } from "@/features/category1Import/types";

export default function Category1ImportStaging() {
  const [parsed, setParsed] = useState<ParseFileResult | null>(null);
  const [staged, setStaged] = useState<StagedCategory1Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  const mappingPreview = useMemo(() => {
    if (!staged[0]) return [];
    const seen = new Set<string>();
    return staged[0].columnMappings.filter((m) => {
      if (seen.has(m.authorityColumn)) return false;
      seen.add(m.authorityColumn);
      return m.targetField !== "ignored";
    });
  }, [staged]);

  const stats = useMemo(() => {
    const errors = staged.filter((s) => s.issues.some((i) => i.level === "error")).length;
    const warnings = staged.filter((s) => s.issues.some((i) => i.level === "warning")).length;
    const dupes = staged.filter((s) => s.duplicates.length > 0).length;
    const submittable = staged.filter((s) => s.canSubmit).length;
    return { errors, warnings, dupes, submittable, total: staged.length };
  }, [staged]);

  const onFile = async (file: File | null) => {
    if (!file) return;
    setLoading(true);
    setBatchId(null);
    try {
      const text = await file.text();
      const result = parseCategory1File(file, text);
      const withDbDupes = await detectExistingProductDuplicates(result.staged);
      setParsed(result);
      setStaged(withDbDupes);
      const sel: Record<number, boolean> = {};
      for (const row of withDbDupes) {
        sel[row.row.rowIndex] = row.canSubmit;
      }
      setSelected(sel);
      toast.success(`Parsed ${withDbDupes.length} rows — validation preview ready`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse file");
      setParsed(null);
      setStaged([]);
    } finally {
      setLoading(false);
    }
  };

  const submitSelected = async () => {
    if (!parsed) return;
    const rows = staged.filter((s) => selected[s.row.rowIndex] && s.canSubmit);
    if (!rows.length) {
      toast.error("No valid rows selected for draft submission");
      return;
    }

    setSubmitting(true);
    const id = newBatchId();
    try {
      const result = await submitCategory1StagingBatch({
        batchId: id,
        fileName: parsed.fileName,
        rows,
      });
      setBatchId(id);
      toast.success(
        `Submitted ${result.submitted} draft(s) to Approval Inbox` +
          (result.failed.length ? ` · ${result.failed.length} failed` : ""),
      );
      if (result.failed.length) {
        console.error("[Category1Import] failures:", result.failed);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Draft submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Category 1 Import Staging"
        subtitle="File → Validation → Draft → Approval Inbox. No master writes. No auto-publish."
      />

      <div className="mb-4 space-y-2">
        <AuthorityStatusBadges
          show={{
            authority_draft: true,
            not_synced_to_central: true,
            central_live_write_disabled: true,
          }}
        />
        <p className="text-xs text-muted-foreground">
          Category 1 product master only. Channel pricing, tags, and catalogue compositions are out of scope.
        </p>
      </div>

      <div className="card-elevated p-4 mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="file"
            accept=".csv,.json,text/csv,application/json"
            disabled={loading}
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
          {loading && <span className="text-sm text-muted-foreground">Parsing…</span>}
        </div>
        {parsed && (
          <div className="text-sm text-muted-foreground flex flex-wrap gap-3">
            <span>
              <FileCheck className="inline h-3 w-3 mr-1" />
              {parsed.fileName} ({parsed.format.toUpperCase()})
            </span>
            <span>{stats.total} rows</span>
            <span className="text-destructive">{stats.errors} errors</span>
            <span className="text-warning">{stats.warnings} warnings</span>
            <span>{stats.dupes} with duplicate signals</span>
            <span className="text-success">{stats.submittable} submittable</span>
          </div>
        )}
      </div>

      {staged.length > 0 && (
        <Tabs defaultValue="rows" className="space-y-4">
          <TabsList>
            <TabsTrigger value="rows">Rows</TabsTrigger>
            <TabsTrigger value="mapping">Column mapping</TabsTrigger>
            <TabsTrigger value="validation">Validation</TabsTrigger>
            <TabsTrigger value="duplicates">Duplicates</TabsTrigger>
          </TabsList>

          <TabsContent value="mapping">
            <div className="card-elevated p-4 overflow-auto">
              <h3 className="font-medium mb-2">Authority column → Category 1 field</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">File column</th>
                    <th className="py-2 pr-4">Maps to</th>
                    <th className="py-2">Sample</th>
                  </tr>
                </thead>
                <tbody>
                  {mappingPreview.map((m) => (
                    <tr key={m.authorityColumn} className="border-b border-border/40">
                      <td className="py-2 pr-4 font-mono text-xs">{m.authorityColumn}</td>
                      <td className="py-2 pr-4">{String(m.targetField)}</td>
                      <td className="py-2 text-muted-foreground truncate max-w-xs">{m.sampleValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground mt-3">
                Target fields: {CATEGORY1_TARGET_FIELDS.join(", ")}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="validation">
            <div className="card-elevated p-4 space-y-2 max-h-96 overflow-auto">
              {staged.flatMap((s) =>
                s.issues.map((issue, idx) => (
                  <div key={`${s.row.rowIndex}-${idx}`} className="text-sm flex gap-2">
                    <Badge variant={issue.level === "error" ? "destructive" : "outline"}>
                      row {s.row.rowIndex}
                    </Badge>
                    <span>{issue.message}</span>
                  </div>
                )),
              )}
              {!staged.some((s) => s.issues.length) && (
                <p className="text-sm text-muted-foreground">No validation issues.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="duplicates">
            <div className="card-elevated p-4 space-y-2 max-h-96 overflow-auto">
              {staged.flatMap((s) =>
                s.duplicates.map((d, idx) => (
                  <div key={`${s.row.rowIndex}-d-${idx}`} className="text-sm flex gap-2 items-start">
                    <Badge variant="outline">row {s.row.rowIndex}</Badge>
                    <div>
                      <div className="font-medium">{d.kind.replace(/_/g, " ")}</div>
                      <div className="text-muted-foreground">
                        {d.matchedValue}
                        {d.matchedRowIndex != null && ` · matches row ${d.matchedRowIndex}`}
                        {d.existingLabel && ` · existing: ${d.existingLabel}`}
                      </div>
                    </div>
                  </div>
                )),
              )}
              {!staged.some((s) => s.duplicates.length) && (
                <p className="text-sm text-muted-foreground">No duplicates detected.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="rows">
            <div className="card-elevated overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b bg-muted/30">
                    <th className="p-2 w-10" />
                    <th className="p-2">#</th>
                    <th className="p-2">Name</th>
                    <th className="p-2">SKU</th>
                    <th className="p-2">Category</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {staged.map((s) => (
                    <tr key={s.row.rowIndex} className="border-b border-border/40">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={!!selected[s.row.rowIndex]}
                          disabled={!s.canSubmit}
                          onChange={(e) =>
                            setSelected((prev) => ({
                              ...prev,
                              [s.row.rowIndex]: e.target.checked,
                            }))
                          }
                        />
                      </td>
                      <td className="p-2">{s.row.rowIndex}</td>
                      <td className="p-2">{s.row.product_name}</td>
                      <td className="p-2 font-mono text-xs">{s.row.sku ?? "—"}</td>
                      <td className="p-2">{s.row.category ?? "—"}</td>
                      <td className="p-2">
                        {!s.canSubmit ? (
                          <Badge variant="destructive">blocked</Badge>
                        ) : s.issues.some((i) => i.level === "warning") || s.duplicates.length ? (
                          <Badge variant="outline" className="text-warning border-warning/40">
                            review
                          </Badge>
                        ) : (
                          <Badge className="bg-success/10 text-success border-success/20">ok</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {staged.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3 items-center">
          <Button
            onClick={() => void submitSelected()}
            disabled={submitting || !staged.some((s) => selected[s.row.rowIndex] && s.canSubmit)}
          >
            <Send className="h-4 w-4 mr-2" />
            {submitting ? "Submitting drafts…" : "Submit selected as drafts"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const sel: Record<number, boolean> = {};
              for (const row of staged) {
                if (row.canSubmit) sel[row.row.rowIndex] = true;
              }
              setSelected(sel);
            }}
          >
            Select all submittable
          </Button>
          {batchId && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Copy className="h-3 w-3" /> Batch {batchId}
              <Link to="/approvals" className="text-accent inline-flex items-center gap-1">
                Open Approval Inbox <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      )}

      {!staged.length && (
        <div className="card-elevated p-6 text-sm text-muted-foreground flex gap-2">
          <Upload className="h-4 w-4 mt-0.5" />
          <div>
            Upload a Category 1 authority CSV or JSON file. Rows are validated read-only, then
            submitted as <code className="text-xs">catalogue_product_drafts</code> for reviewer
            approval. Products are never published automatically.
          </div>
        </div>
      )}

      {stats.errors > 0 && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm flex gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          Rows with errors cannot be submitted until fixed in the source file and re-uploaded.
        </div>
      )}
    </>
  );
}
