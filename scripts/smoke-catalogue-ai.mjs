const baseUrl = process.env.SMOKE_SUPABASE_URL ?? "https://tcxvcatsqqertcnycuop.supabase.co";
const endpoint = `${baseUrl.replace(/\/$/, "")}/functions/v1/catalogue-ai-copy`;
const origin = process.env.SMOKE_ALLOWED_ORIGIN;
const accessToken = process.env.SMOKE_ACCESS_TOKEN;
const publishableKey = process.env.SMOKE_PUBLISHABLE_KEY;
const nonStaffToken = process.env.SMOKE_NON_STAFF_ACCESS_TOKEN;
const expectedAiStatus = Number(process.env.SMOKE_EXPECT_AI_STATUS ?? "503");

const results = [];

function record(name, passed, detail) {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}: ${detail}`);
}

async function call({ method = "POST", requestOrigin, token, key, body } = {}) {
  const headers = {};
  if (requestOrigin) headers.Origin = requestOrigin;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (key) headers.apikey = key;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(endpoint, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "error",
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    // Status and headers remain sufficient for negative checks.
  }
  return { response, payload };
}

function expectStatus(name, actual, expected) {
  record(name, actual === expected, `HTTP ${actual}; expected ${expected}`);
}

const noAuth = await call({ method: "GET" });
expectStatus("missing JWT is rejected", noAuth.response.status, 401);

const badAuth = await call({
  requestOrigin: "https://example.invalid",
  token: "invalid-token",
  key: "invalid-key",
  body: { productName: "Smoke Test" },
});
expectStatus("invalid JWT is rejected", badAuth.response.status, 401);

if (!origin || !accessToken || !publishableKey) {
  console.log(
    "SKIP authenticated checks: set SMOKE_ALLOWED_ORIGIN, SMOKE_ACCESS_TOKEN and SMOKE_PUBLISHABLE_KEY.",
  );
} else {
  const preflight = await call({
    method: "OPTIONS",
    requestOrigin: origin,
  });
  expectStatus("approved-origin preflight", preflight.response.status, 204);

  const wrongOrigin = await call({
    requestOrigin: "https://example.invalid",
    token: accessToken,
    key: publishableKey,
    body: { productName: "Smoke Test" },
  });
  expectStatus("unapproved origin is rejected", wrongOrigin.response.status, 403);

  const wrongMethod = await call({
    method: "GET",
    requestOrigin: origin,
    token: accessToken,
    key: publishableKey,
  });
  expectStatus("unsupported method is rejected", wrongMethod.response.status, 405);

  const invalidBody = await call({
    requestOrigin: origin,
    token: accessToken,
    key: publishableKey,
    body: { productName: " " },
  });
  expectStatus("invalid request body is rejected", invalidBody.response.status, 400);

  if (nonStaffToken) {
    const nonStaff = await call({
      requestOrigin: origin,
      token: nonStaffToken,
      key: publishableKey,
      body: { productName: "Smoke Test" },
    });
    expectStatus("non-staff user is rejected", nonStaff.response.status, 401);
  } else {
    console.log("SKIP non-staff check: set SMOKE_NON_STAFF_ACCESS_TOKEN.");
  }

  const generation = await call({
    requestOrigin: origin,
    token: accessToken,
    key: publishableKey,
    body: {
      productName: "Date Truffles",
      category: "Confectionery",
      packSize: "500 g",
      tone: "premium",
    },
  });
  expectStatus("governed generation state", generation.response.status, expectedAiStatus);

  if (generation.response.status === 200) {
    const required = [
      "catalogue_title",
      "short_description",
      "long_description",
      "b2b_sales_copy",
      "export_catalogue_copy",
      "whatsapp_product_message",
      "hindi_description",
      "storage_shelf_life_copy",
    ];
    const fields =
      generation.payload?.content && typeof generation.payload.content === "object"
        ? Object.keys(generation.payload.content).sort()
        : [];
    const exactFields = JSON.stringify(fields) === JSON.stringify([...required].sort());
    record("strict eight-field output", exactFields, `${fields.length} fields returned`);
    record(
      "human review marker",
      generation.payload?.human_review_required === true,
      `human_review_required=${String(generation.payload?.human_review_required)}`,
    );
    const fallback = generation.payload?.content?.storage_shelf_life_copy;
    record(
      "missing storage facts stay unclaimed",
      fallback === "Storage and shelf-life details require operator confirmation.",
      "required confirmation wording returned",
    );
  }
}

const failed = results.filter((result) => !result.passed);
console.log(`\n${results.length - failed.length}/${results.length} executed checks passed.`);
if (failed.length) process.exitCode = 1;
