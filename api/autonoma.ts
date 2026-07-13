import { defineFactory } from "@autonoma-ai/sdk";
import { createHandler } from "@autonoma-ai/server-web";
import { createClient } from "@supabase/supabase-js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";

import type { Database } from "../src/integrations/supabase/types";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sharedSecret = process.env.AUTONOMA_SHARED_SECRET;
const signingSecret = process.env.AUTONOMA_SIGNING_SECRET;

function requireServerEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required server env var: ${name}`);
  }
  return value;
}

const adminSupabase = createClient<Database>(
  requireServerEnv("SUPABASE_URL or VITE_SUPABASE_URL", supabaseUrl),
  requireServerEnv("SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

const optionalString = z.string().nullable().optional();
const optionalNumber = z.number().nullable().optional();
const optionalBoolean = z.boolean().nullable().optional();

const productInputSchema = z.object({
  product_name: z.string().min(1),
  short_name: optionalString,
  sku: z.string().min(1),
  category: optionalString,
  subcategory: optionalString,
  product_type: optionalString,
  material_type: optionalString,
  is_active: optionalBoolean.default(true),
  is_catalogue_ready: optionalBoolean.default(false),
  label_status: optionalString,
  media_status: optionalString,
  mrp: optionalNumber,
  b2b_price_inr: optionalNumber,
  b2b_uom: optionalString,
  retail_uom: optionalString,
  gst_rate: optionalNumber,
  hsn_code: optionalString,
  pack_size: optionalString,
  shelf_life_days: optionalNumber,
  storage_instructions: optionalString,
  pdf_storage_condition: optionalString,
  pdf_shelf_life: optionalString,
  pdf_primary_packaging: optionalString,
  pdf_secondary_packaging: optionalString,
  sku_locked: optionalBoolean.default(false),
  sku_version: optionalNumber.default(1),
  bom_required: optionalBoolean.default(false),
  moq_value: optionalNumber,
  moq_uom: optionalString,
  pieces_per_kg: optionalNumber,
  approximate_piece_weight_g: optionalNumber,
  product_class: optionalString,
  main_department: optionalString,
  production_department: optionalString,
});

const productRefSchema = z.object({
  id: z.string(),
  product_name: z.string(),
  sku: z.string(),
  source_collection: z.string().nullable(),
});

const products = defineFactory({
  inputSchema: productInputSchema,
  refSchema: productRefSchema,
  create: async (input, context) => {
    const payload: Database["public"]["Tables"]["products"]["Insert"] = {
      ...input,
      product_name: input.product_name,
      sku: input.sku,
      is_active: input.is_active ?? true,
      is_catalogue_ready: input.is_catalogue_ready ?? false,
      sku_locked: input.sku_locked ?? false,
      sku_version: input.sku_version ?? 1,
      bom_required: input.bom_required ?? false,
      product_class: input.product_class ?? "bulk_loose_product",
      main_department: input.main_department ?? "ready_goods_store",
      source_collection: `autonoma:${context.testRunId}`,
      source_document: "autonoma-environment-factory",
      source_notes: "Created by Autonoma factory for disposable end-to-end testing.",
    };

    const { data, error } = await adminSupabase
      .from("products")
      .insert(payload)
      .select("id, product_name, sku, source_collection")
      .single();

    if (error) throw error;
    return data;
  },
  teardown: async (record) => {
    const { error } = await adminSupabase
      .from("products")
      .delete()
      .eq("id", record.id)
      .like("source_collection", "autonoma:%");

    if (error) throw error;
  },
});

const autonomaHandler = createHandler({
  scopeField: "sourceCollection",
  sharedSecret: requireServerEnv("AUTONOMA_SHARED_SECRET", sharedSecret),
  signingSecret: requireServerEnv("AUTONOMA_SIGNING_SECRET", signingSecret),
  factories: {
    products,
  },
  auth: () => ({
    credentials: {
      email: requireServerEnv("AUTONOMA_TEST_EMAIL", process.env.AUTONOMA_TEST_EMAIL),
      password: requireServerEnv("AUTONOMA_TEST_PASSWORD", process.env.AUTONOMA_TEST_PASSWORD),
    },
  }),
});

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("allow", "POST");
    res.end("Method Not Allowed");
    return;
  }

  try {
    const body = await readBody(req);
    const request = new Request("https://oasis-ai-studio.local/api/autonoma", {
      method: "POST",
      headers: req.headers as Record<string, string>,
      body,
    });
    const response = await autonomaHandler(request);

    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(await response.text());
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Autonoma handler failed" }));
  }
}
