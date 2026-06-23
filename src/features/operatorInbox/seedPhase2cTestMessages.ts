import { PRODUCTION_SNAPSHOT_CATALOG } from "@/features/productIntelligence/runtime/fixtures/productionSnapshotCatalog";
import type { RuntimeCatalog } from "@/features/productIntelligence/runtime";
import { createInMemoryIngestStore, ingestInboundMessage } from "./ingestInboundMessage";
import { resolveInboundMessage } from "./resolveInboundMessage";
import type { IngestInboundResult } from "./whatsappInboundTypes";

const TEST_SEED_PREFIX = "phase2c-test-seed-";

export const PHASE2C_TEST_SEED_MESSAGES = [
  { key: "pista-bulbul", body: "pista bulbul", sender_name: "Test Aisha" },
  { key: "midya", body: "midya", sender_name: "Test Rahul" },
  { key: "6pc-midya", body: "6 pc midya", sender_name: "Test Rahul" },
  { key: "kaju-tart", body: "kaju tart", sender_name: "Test Priya" },
  { key: "greeting", body: "Assalamualaikum", sender_name: "Test Omar" },
] as const;

export function isPhase2cTestSeedEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_ENABLE_PHASE2C_TEST_SEED === "true";
}

/** In-memory seeder for unit tests. */
export async function seedPhase2cTestMessagesInMemory(options?: {
  catalogLoader?: () => Promise<RuntimeCatalog>;
}): Promise<IngestInboundResult[]> {
  const catalogLoader = options?.catalogLoader ?? (async () => PRODUCTION_SNAPSHOT_CATALOG);
  const store = createInMemoryIngestStore();
  const results: IngestInboundResult[] = [];

  for (const item of PHASE2C_TEST_SEED_MESSAGES) {
    const result = await ingestInboundMessage(
      {
        provider_message_id: `${TEST_SEED_PREFIX}${item.key}`,
        sender_phone: "+919000000001",
        sender_name: item.sender_name,
        message_body: item.body,
        raw_payload: { seed: "phase2c-test-only", non_production: true },
      },
      {
        resolve: (text) => resolveInboundMessage(text, catalogLoader),
        rpc: store.deps.rpc,
      },
    );
    results.push(result);
  }

  return results;
}

/** Dev/test seeder that writes to Supabase when RPC is available. */
export async function seedPhase2cTestMessagesToDatabase(options?: {
  catalogLoader?: () => Promise<RuntimeCatalog>;
}): Promise<IngestInboundResult[]> {
  if (!isPhase2cTestSeedEnabled()) {
    throw new Error("Phase 2C test seeder is disabled outside development/test environments");
  }

  const catalogLoader = options?.catalogLoader ?? (async () => PRODUCTION_SNAPSHOT_CATALOG);
  const results: IngestInboundResult[] = [];

  for (const item of PHASE2C_TEST_SEED_MESSAGES) {
    const result = await ingestInboundMessage(
      {
        provider_message_id: `${TEST_SEED_PREFIX}${item.key}`,
        sender_phone: "+919000000001",
        sender_name: item.sender_name,
        message_body: item.body,
        raw_payload: { seed: "phase2c-test-only", non_production: true },
      },
      {
        resolve: (text) => resolveInboundMessage(text, catalogLoader),
      },
    );
    results.push(result);
  }

  return results;
}
