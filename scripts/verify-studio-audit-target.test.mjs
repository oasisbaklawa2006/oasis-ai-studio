import assert from "node:assert/strict";
import { test } from "node:test";
import {
  approvedStudioOrigin,
  canonicalAuditOrigin,
  PRODUCTION_STUDIO_ORIGIN,
  verifyProtectedStudioAudit,
} from "./verify-studio-audit-target.mjs";

const SHA = "5bc36db0a192b1be2dc02693336c2f6a2dc4e26c";
const trusted = {
  AI_STUDIO_URL: PRODUCTION_STUDIO_ORIGIN,
  GITHUB_REF: "refs/heads/main",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_SHA: SHA,
  EXPECTED_DEPLOYMENT_SHA: SHA,
};

test("approved production origin and exact trusted SHA pass", () => {
  assert.deepEqual(verifyProtectedStudioAudit(trusted), {
    target: PRODUCTION_STUDIO_ORIGIN,
    sha: SHA,
  });
});

test("explicitly approved exact preview origin passes", () => {
  const preview = "https://oasis-ai-studio-abc123.vercel.app";
  assert.equal(
    approvedStudioOrigin({
      ...trusted,
      AI_STUDIO_URL: preview,
      AI_STUDIO_AUDIT_ALLOWED_ORIGINS: preview,
    }),
    preview,
  );
});

test("unapproved target, suffix and userinfo tricks fail closed", () => {
  for (const url of [
    "https://attacker.example",
    "https://oasis-ai-studio.vercel.app.attacker.example",
    "https://oasis-ai-studio.vercel.app@attacker.example",
    "https://attacker.example@oasis-ai-studio.vercel.app",
    "https://oasis-ai-studio.vercel.app.evil.vercel.app",
    "http://oasis-ai-studio.vercel.app",
    "https://oasis-ai-studio.vercel.app:444",
    "https://oasis-ai-studio.vercel.app:443",
    "https://oasis-ai-studio.vercel.app/login",
    "https://oasis-ai-studio.vercel.app/?next=evil",
    "https://oasis-ai-studio.vercel.app/#evil",
    "https://oasis-ai-studio.vercel.app\\@attacker.example",
    "https://oasis-ai-studio.vercel.app.",
  ]) {
    assert.throws(() => approvedStudioOrigin({ ...trusted, AI_STUDIO_URL: url }), undefined, url);
  }
});

test("no wildcard, path or userinfo in administrator allowlist", () => {
  for (const extra of [
    "https://*.vercel.app",
    "http://preview.vercel.app",
    "https://user@preview.vercel.app",
    "https://preview.vercel.app/auth",
  ]) {
    assert.throws(
      () =>
        approvedStudioOrigin({
          ...trusted,
          AI_STUDIO_AUDIT_ALLOWED_ORIGINS: extra,
        }),
      undefined,
      extra,
    );
  }
});

test("untrusted branch, event, SHA and missing SHA are blocked", () => {
  for (const change of [
    { GITHUB_REF: "refs/heads/feature/unreviewed" },
    { GITHUB_REF: "refs/pull/293/merge" },
    { GITHUB_EVENT_NAME: "pull_request" },
    { EXPECTED_DEPLOYMENT_SHA: "" },
    { EXPECTED_DEPLOYMENT_SHA: "0".repeat(40) },
    { GITHUB_SHA: "0".repeat(40) },
    { PRODUCT_AUTHORING_SAVE: "1" },
  ]) {
    assert.throws(() => verifyProtectedStudioAudit({ ...trusted, ...change }));
  }
});

test("canonical origin normalization never broadens approval", () => {
  assert.equal(canonicalAuditOrigin(PRODUCTION_STUDIO_ORIGIN + "/"), PRODUCTION_STUDIO_ORIGIN);
  assert.equal(canonicalAuditOrigin(PRODUCTION_STUDIO_ORIGIN), PRODUCTION_STUDIO_ORIGIN);
});
