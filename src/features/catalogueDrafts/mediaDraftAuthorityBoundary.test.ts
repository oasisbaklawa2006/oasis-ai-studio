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
