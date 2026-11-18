import { isIP } from "node:net";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PRODUCTION_STUDIO_ORIGIN = "https://oasis-ai-studio.vercel.app";

export function canonicalAuditOrigin(input) {
  if (typeof input !== "string" || !input.trim() || input.includes("\\")) {
    throw new Error("Audit URL must be a nonempty HTTPS origin without backslashes");
  }
  const value = input.trim();
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid audit URL");
  }
  if (
    url.protocol !== "https:" ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.port ||
    !/^[a-z0-9.-]+$/i.test(url.hostname) ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !/^https:\/\/[a-z0-9.-]+\/?$/i.test(value)
  ) {
    throw new Error("Audit URL must be an HTTPS origin without credentials, port, path or query");
  }
  if (
    url.hostname.endsWith(".") ||
    url.hostname === "localhost" ||
    url.hostname.endsWith(".local") ||
    isIP(url.hostname) !== 0
  ) {
    throw new Error("Unapproved audit hostname");
  }
  return url.origin;
}

export function approvedStudioOrigin(env = process.env) {
  const target = canonicalAuditOrigin(env.AI_STUDIO_URL || PRODUCTION_STUDIO_ORIGIN);
  const configured = (env.AI_STUDIO_AUDIT_ALLOWED_ORIGINS || "")
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (configured.length > 20) throw new Error("Too many approved audit origins");
  const approved = new Set([PRODUCTION_STUDIO_ORIGIN, ...configured.map(canonicalAuditOrigin)]);
  if (!approved.has(target)) throw new Error("Studio audit target is not explicitly approved");
  return target;
}

export function verifyProtectedStudioAudit(env = process.env) {
  const target = approvedStudioOrigin(env);
  if (env.PRODUCT_AUTHORING_SAVE && env.PRODUCT_AUTHORING_SAVE !== "0") {
    throw new Error("Protected audit must be read-only");
  }
  if (env.GITHUB_REF !== "refs/heads/main") {
    throw new Error("Protected audit must run from the reviewed main branch");
  }
  if (!["push", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME)) {
    throw new Error("Protected audit requires an authorized push or manual dispatch");
  }
  const sha = env.EXPECTED_DEPLOYMENT_SHA || "";
  if (!/^[0-9a-f]{40}$/i.test(sha) || sha !== env.GITHUB_SHA) {
    throw new Error("Protected audit requires an exact main deployment SHA");
  }
  return { target, sha };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    verifyProtectedStudioAudit();
    console.log("Approved Studio origin, main ref and exact deployment SHA verified");
  } catch {
    console.error("BLOCKED: unapproved Studio audit target, ref or deployment identity");
    process.exitCode = 1;
  }
}
