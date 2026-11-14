import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../../..");
const forbiddenDraftWrites = new Set(["insertProductMediaRow", "persistMediaRow"]);

function parseFile(path: string): ts.SourceFile {
  const source = readFileSync(resolve(ROOT, path), "utf8");
  return ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function forbiddenCallsIn(node: ts.Node, source: ts.SourceFile): string[] {
  const found: string[] = [];
  const visit = (current: ts.Node) => {
    if (ts.isCallExpression(current)) {
      const callee = current.expression.getText(source);
      if (forbiddenDraftWrites.has(callee)) found.push(callee);
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

function draftBranchViolations(source: ts.SourceFile): string[] {
  const problems: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isIfStatement(node) &&
      /writeMode\s*===\s*["']draft["']/.test(node.expression.getText(source))
    ) {
      problems.push(...forbiddenCallsIn(node.thenStatement, source));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return problems;
}

describe("Core #484 — protected media replacement and blocked upload reports", () => {
  const uploader = () =>
    readFileSync(resolve(ROOT, "src/components/ProductMediaUploader.tsx"), "utf8");

  it("does not demote an existing PDF hero before new hero upload and designation succeed", () => {
    const src = uploader();
    const flow = src.slice(
      src.indexOf("const uploadToSlot = async"),
      src.indexOf("const upload = async"),
    );
    const uploaded = flow.indexOf("await uploadFileDirect(files[0], asHero, false)");
    const designated = flow.indexOf("await applyDirectHeroAuthority(url)");
    const demoted = flow.indexOf('.update({ type: "source_pdf_page", status: "reference_only" })');
    expect(uploaded).toBeGreaterThan(-1);
    expect(designated).toBeGreaterThan(uploaded);
    expect(demoted).toBeGreaterThan(designated);
  });

  it("does not reconcile or toast success if all selected direct uploads fail", () => {
    const src = uploader();
    const flow = src.slice(
      src.indexOf("const upload = async"),
      src.indexOf("const setAsHeroDirect = async"),
    );
    const successfulWrite = flow.indexOf("if (url) {");
    const delayedReservation = flow.indexOf(
      "operationId = beginProductMediaOperation(requestProductId)",
    );
    const noSuccess = flow.indexOf("if (uploadedCount === 0 || operationId === null) return;");
    const reconciliation = flow.indexOf(
      "await reconcileProductMediaAuthority(requestProductId, operationId)",
    );
    expect(successfulWrite).toBeGreaterThan(-1);
    expect(delayedReservation).toBeGreaterThan(successfulWrite);
    expect(noSuccess).toBeGreaterThan(delayedReservation);
    expect(reconciliation).toBeGreaterThan(noSuccess);
    expect(flow).not.toContain("const operationId = beginProductMediaOperation(requestProductId)");
    expect(flow).toContain("uploadedCount} file(s) uploaded");
    expect(flow).not.toContain("files.length} file(s) uploaded");
  });
});

describe("Core #484 — stale draft URL completion stays scoped to its product", () => {
  const source = () =>
    readFileSync(resolve(ROOT, "src/components/ProductMediaUploader.tsx"), "utf8");

  it("guards product-specific form and pending notice after draft submission awaits", () => {
    const flow = source().split("const addFromUrl = async")[1] ?? "";
    const submitted = flow.indexOf('const res = await submitDraft("url_import"');
    const guard = flow.indexOf("if (isSupersededByProductSwitch(requestProductId)) return;");
    const reset = flow.indexOf('setUrlInput("");', submitted);
    const notice = flow.indexOf("setPendingNotices((prev) => [", submitted);
    expect(submitted).toBeGreaterThan(-1);
    expect(guard).toBeGreaterThan(submitted);
    expect(reset).toBeGreaterThan(guard);
    expect(notice).toBeGreaterThan(guard);
    expect(flow).toContain(
      "if (!isSupersededByProductSwitch(requestProductId)) setUploading(false)",
    );
  });

  it("resets previous-product form state when the product identity changes", () => {
    const src = source();
    expect(src).toContain('setUrlInput("");');
    expect(src).toContain("setPendingNotices([]);");
    expect(src).toContain("}, [productId]);");
  });
});

describe("Core #484 — contributor media drafts never bypass review", () => {
  it("never writes product_media from the Media Library's draft branches", () => {
    expect(draftBranchViolations(parseFile("src/pages/Media.tsx"))).toEqual([]);
  });

  it("never writes product_media from ProductMediaUploader draft branches", () => {
    expect(draftBranchViolations(parseFile("src/components/ProductMediaUploader.tsx"))).toEqual([]);
  });

  it("keeps the shared draft uploader approval-only, not a live media insertion", () => {
    const source = parseFile("src/components/ProductMediaUploader.tsx");
    const found: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(source) === "uploadFileDraft") {
        if (node.initializer) found.push(...forbiddenCallsIn(node.initializer, source));
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(found).toEqual([]);
    const draftService = readFileSync(
      resolve(ROOT, "src/features/catalogueDrafts/draftService.ts"),
      "utf8",
    );
    expect(draftService).toContain(".from(map.table).insert(insertRow)");
  });
});
