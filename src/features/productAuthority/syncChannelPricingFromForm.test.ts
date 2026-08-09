import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Point 27, Finding 2 (recurrence): this legacy compliance-tab pricing sync
// used to upsert product_pricing_rules directly with approval_status:
// "approved" whenever a "direct" writer saved a product - a second instance
// of the same self-approval bypass ChannelPricingRules.tsx was fixed for
// earlier, missed because it lives in a different file. It must now only
// ever submit governed catalogue drafts.
describe("syncChannelPricingFromForm contract", () => {
  const source = readFileSync(join(__dirname, "./syncChannelPricingFromForm.ts"), "utf8");

  it("never writes product_pricing_rules directly", () => {
    expect(source).not.toMatch(
      /\.from\(\s*["']product_pricing_rules["']\s*\)\s*\.\s*(insert|update|upsert|delete)\s*\(/,
    );
  });

  it('never force-approves pricing rows (no approval_status: "approved" write)', () => {
    expect(source).not.toMatch(/approval_status:\s*["']approved["']/);
  });

  it("submits every channel price as a catalogue draft", () => {
    expect(source).toContain("submitCatalogueDraft");
    expect(source).toMatch(/draftType:\s*["']pricing["']/);
  });

  // CodeRabbit-flagged: saving the product again before Central reviews the first pricing
  // draft must not submit a second pending proposal for the same channel.
  it("skips a channel that already has a pending draft for this submitter", () => {
    expect(source).toMatch(/status["']?,?\s*["']pending_approval["']/);
    expect(source).toContain("pendingChannels.has(channel)");
  });
});
