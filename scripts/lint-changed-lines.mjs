#!/usr/bin/env node
/**
 * Lints only the files changed against a base ref, and fails only on
 * genuinely NEW ESLint errors — never on pre-existing debt in a file that
 * merely happened to be touched.
 *
 * "New" is measured per (file, rule) error *count*, not by line number: this
 * file is linted at the base ref's content and at HEAD's content, and only
 * an increase in a given rule's error count for that file counts as new.
 * Line-number-based diffing was tried first and rejected — an edit on the
 * same line as a pre-existing violation (e.g. changing an argument next to
 * an existing `as any` cast) makes git treat the whole line as "added" even
 * though the violating token itself pre-dates this change; count-based
 * comparison does not have that false-positive. This mirrors the same
 * before/after `git stash` comparison method used to manually verify no new
 * lint findings throughout this repository's validation history.
 *
 * Every ESLint finding in a changed file is still printed for visibility;
 * pre-existing findings are reported but never block.
 *
 * Usage: node scripts/lint-changed-lines.mjs <base-ref>
 */
import { execFileSync } from "node:child_process";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 1024 * 1024 * 64 });
}

function tryGitShow(ref, file) {
  try {
    // stdio: pipe for stderr too — a missing path at `ref` is an expected,
    // routine case (a newly-added file), not something that should print a
    // "fatal:" line into CI logs on every ordinary new-file addition.
    return execFileSync("git", ["show", `${ref}:${file}`], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 64,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return null; // file did not exist at ref (newly added file)
  }
}

function lintContent(content, filePath) {
  if (content === null) return [];
  try {
    const out = execFileSync("npx", ["eslint", "--format", "json", "--stdin", "--stdin-filename", filePath], {
      input: content,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 64,
    });
    return JSON.parse(out || "[]");
  } catch (err) {
    return JSON.parse(err.stdout || "[]");
  }
}

/** Map<ruleId, count> — errors only (severity 2), matching eslint's own exit-code semantics. */
function errorCountsByRule(eslintResults) {
  const counts = new Map();
  for (const fileResult of eslintResults) {
    for (const msg of fileResult.messages) {
      if (msg.severity !== 2) continue;
      const key = msg.ruleId || "(no-rule)";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

const base = process.argv[2];
if (!base) {
  console.error("usage: lint-changed-lines.mjs <base-ref>");
  process.exit(2);
}

const changedFiles = git(["diff", "--name-only", "--diff-filter=ACMR", base, "HEAD", "--", "*.ts", "*.tsx"])
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

if (changedFiles.length === 0) {
  console.log("No changed .ts/.tsx files in this range — nothing to lint.");
  process.exit(0);
}

console.log(`Changed .ts/.tsx file(s) (${changedFiles.length}):`);
for (const f of changedFiles) console.log(`  ${f}`);
console.log("");

let anyNew = false;

for (const file of changedFiles) {
  const oldContent = tryGitShow(base, file);
  const newContent = tryGitShow("HEAD", file);
  if (newContent === null) continue; // deleted in this diff relative to HEAD — nothing to lint

  const oldCounts = errorCountsByRule(lintContent(oldContent, file));
  const newResults = lintContent(newContent, file);
  const newCounts = errorCountsByRule(newResults);

  const totalNew = newResults.reduce((n, r) => n + r.messages.filter((m) => m.severity === 2).length, 0);
  console.log(`${file}: ${totalNew} ESLint error(s) at HEAD`);

  const rules = new Set([...oldCounts.keys(), ...newCounts.keys()]);
  for (const rule of rules) {
    const before = oldCounts.get(rule) ?? 0;
    const after = newCounts.get(rule) ?? 0;
    const delta = after - before;
    if (delta > 0) {
      anyNew = true;
      console.log(`  [NEW] ${rule}: ${before} -> ${after} (+${delta})`);
    } else if (after > 0) {
      console.log(`  [pre-existing, not blocking] ${rule}: ${after} (was ${before} before this change)`);
    }
  }

  for (const fileResult of newResults) {
    for (const msg of fileResult.messages) {
      if (msg.severity !== 2) continue;
      console.log(`    ${file}:${msg.line}:${msg.column}  ${msg.message}  (${msg.ruleId})`);
    }
  }
}

console.log("");
if (anyNew) {
  console.log("Blocking — this change increases the ESLint error count for at least one rule in a changed file.");
  process.exit(1);
}

console.log("No rule's ESLint error count increased in any changed file. Pre-existing findings (if any) are reported above but do not block.");
process.exit(0);
