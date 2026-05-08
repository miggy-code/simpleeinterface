import assert from "node:assert/strict";
import test from "node:test";
import { FIELD_NAME, type Lead } from "../../lib/schema";
import { ValidationError } from "../../lib/http/errors";

function airtableRecord(
  id: string,
  fields: Record<string, unknown>
): { id: string; createdTime: string; fields: Record<string, unknown> } {
  return {
    id,
    createdTime: "2026-05-01T00:00:00.000Z",
    fields,
  };
}

test("resolveLeadPushContext enforces push prerequisites and preserves campaign fallback", async () => {
  const { resolveLeadPushContext, assertBulkPushEligible } = await import(
    "../../lib/services/push-to-campaign"
  );

  const lead: Lead = {
    id: "rec-1",
    email: "lead@example.com",
    firstName: "Alex",
    companyName: "Bay State Fabrication",
    title: "COO",
    industry: "Manufacturing",
    instantlyCampaignId: "camp-1",
    instantlyCampaignName: "Campaign One",
    pipelineStatus: "Approved",
  };

  assert.deepEqual(resolveLeadPushContext(lead), {
    campaignId: "camp-1",
    campaignName: "Campaign One",
  });

  assert.doesNotThrow(() => assertBulkPushEligible(lead));

  assert.throws(
    () => resolveLeadPushContext({ ...lead, email: undefined }),
    ValidationError
  );
  assert.throws(
    () => resolveLeadPushContext({ ...lead, instantlyCampaignId: undefined }),
    ValidationError
  );
  assert.throws(
    () => assertBulkPushEligible({ ...lead, title: undefined }),
    ValidationError
  );
  assert.doesNotThrow(() =>
    assertBulkPushEligible({ ...lead, pipelineStatus: "Researching" })
  );
});

test("campaign sequence builder preserves subject body and delay for every editor step", async () => {
  const { buildInstantlySequenceFromEditorSteps } = await import(
    "../../lib/campaign-sequence"
  );

  const sequences = buildInstantlySequenceFromEditorSteps([
    { subject: "First", body: "Body one", delayDays: 9 },
    { subject: "Second", body: "Body two", delayDays: 3 },
    { subject: "Third", body: "Body three", delayDays: 7 },
  ]);

  assert.deepEqual(sequences, [
    {
      steps: [
        {
          type: "email",
          delay: 0,
          variants: [{ subject: "First", body: "Body one" }],
        },
        {
          type: "email",
          delay: 3,
          variants: [{ subject: "Second", body: "Body two" }],
        },
        {
          type: "email",
          delay: 7,
          variants: [{ subject: "Third", body: "Body three" }],
        },
      ],
    },
  ]);
});

test("DeBounce verification maps Safe to Send and blocked results", async () => {
  process.env.DEBOUNCE_API_KEY = "test-debounce-key";
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (url: string | URL | Request) => {
    calls.push(String(url));
    const isSafe = String(url).includes("safe%40example.com");
    return new Response(
      JSON.stringify({
        success: "1",
        debounce: {
          email: isSafe ? "safe@example.com" : "bad@example.com",
          result: isSafe ? "Safe to Send" : "Invalid",
          reason: isSafe ? "Deliverable" : "Rejected Email",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const { verifyEmailWithDeBounce, isSafeToSend } = await import(
      "../../lib/debounce"
    );
    const safe = await verifyEmailWithDeBounce("safe@example.com");
    const blocked = await verifyEmailWithDeBounce("bad@example.com");

    assert.equal(isSafeToSend("Safe to Send"), true);
    assert.equal(safe.decision, "safe");
    assert.equal(blocked.decision, "blocked");
    assert.ok(calls[0].includes("api=test-debounce-key"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("validation helpers parse JSON objects and enforce string/string[] contracts", async () => {
  const {
    parseJsonObject,
    parseOptionalJsonObject,
    readString,
    readStringArray,
  } = await import("../../lib/http/validation");

  const req = new Request("http://localhost/test", {
    method: "POST",
    body: JSON.stringify({ name: "Throttl", ids: ["a", "b"] }),
    headers: { "content-type": "application/json" },
  });
  const body = await parseJsonObject(req as never);
  assert.equal(readString(body, "name"), "Throttl");
  assert.deepEqual(readStringArray(body, "ids", { minLength: 2 }), ["a", "b"]);

  const noBodyReq = new Request("http://localhost/test", { method: "POST" });
  const optionalBody = await parseOptionalJsonObject(noBodyReq as never);
  assert.deepEqual(optionalBody, {});

  assert.throws(() => readString(body, "missing"), ValidationError);
  assert.throws(
    () => readStringArray({ ids: ["ok", ""] }, "ids"),
    ValidationError
  );
});

test("runEngagementSync aggregates success, skip, and error details", async () => {
  process.env.AIRTABLE_API_KEY = "test-airtable-key";
  process.env.AIRTABLE_BASE_ID = "app-test";
  process.env.AIRTABLE_LEADS_TABLE_ID = "tbl-leads";
  process.env.INSTANTLY_API_KEY = "test-instantly-key";

  const calls: Array<{ url: string; init: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    calls.push({ url: u, init: init ?? {} });

    if (u.includes("/v0/app-test/tbl-leads?") && method === "GET") {
      return new Response(
        JSON.stringify({
          records: [
            airtableRecord("rec-1", {
              [FIELD_NAME.email]: "sync-ok@example.com",
              [FIELD_NAME.instantlyLeadId]: "inst-1",
              [FIELD_NAME.pipelineStatus]: "In Campaign",
            }),
            airtableRecord("rec-2", {
              [FIELD_NAME.email]: "sync-fail@example.com",
              [FIELD_NAME.instantlyLeadId]: "inst-2",
              [FIELD_NAME.pipelineStatus]: "In Campaign",
            }),
            airtableRecord("rec-3", {
              [FIELD_NAME.email]: "skipped@example.com",
              [FIELD_NAME.pipelineStatus]: "In Campaign",
            }),
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (u.endsWith("/api/v2/leads/inst-1") && method === "GET") {
      return new Response(
        JSON.stringify({
          id: "inst-1",
          email_open_count: 2,
          email_reply_count: 1,
          timestamp_last_open: "2026-05-04T00:00:00.000Z",
          timestamp_last_reply: "2026-05-04T01:00:00.000Z",
          esp_code: 0,
          is_unsubscribed: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (u.endsWith("/api/v2/leads/inst-2") && method === "GET") {
      return new Response("Instantly failure", { status: 500 });
    }

    if (
      (u.endsWith("/v0/app-test/tbl-leads/rec-1") ||
        u.endsWith("/v0/app-test/tbl-leads/rec-2")) &&
      method === "PATCH"
    ) {
      return new Response(
        JSON.stringify(
          airtableRecord(
            u.endsWith("/rec-1") ? "rec-1" : "rec-2",
            JSON.parse(String(init?.body)).fields
          )
        ),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unhandled fetch: ${method} ${u}`);
  }) as typeof fetch;

  try {
    const { runEngagementSync } = await import(
      "../../lib/services/engagement-sync"
    );
    const summary = await runEngagementSync({
      batchSize: 2,
      batchDelayMs: 0,
      capErrorDetails: 1,
    });

    assert.equal(summary.total, 3);
    assert.equal(summary.withInstantly, 2);
    assert.equal(summary.synced, 1);
    assert.equal(summary.skipped, 1);
    assert.equal(summary.errors.length, 1);
    assert.equal(summary.cappedErrorDetails.length, 1);
    assert.match(summary.errors[0], /sync-fail@example.com/);

    const patchCalls = calls.filter((c) => c.init.method === "PATCH");
    assert.equal(patchCalls.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("runReengagementJob applies terminal and missing-date rules consistently", async () => {
  process.env.AIRTABLE_API_KEY = "test-airtable-key";
  process.env.AIRTABLE_BASE_ID = "app-test";
  process.env.AIRTABLE_LEADS_TABLE_ID = "tbl-leads";
  process.env.AIRTABLE_ARCHIVE_TABLE_ID = "tbl-archive";

  const calls: Array<{ url: string; init: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    calls.push({ url: u, init: init ?? {} });

    if (u.includes("/v0/app-test/tbl-leads?") && method === "GET") {
      return new Response(
        JSON.stringify({
          records: [
            airtableRecord("rec-win", {
              [FIELD_NAME.email]: "win@example.com",
              [FIELD_NAME.replySentiment]: "Interested",
              [FIELD_NAME.pipelineStatus]: "In Campaign",
            }),
            airtableRecord("rec-bounced", {
              [FIELD_NAME.email]: "bounce@example.com",
              [FIELD_NAME.name]: "Bounced Lead",
              [FIELD_NAME.bounced]: true,
              [FIELD_NAME.pipelineStatus]: "In Campaign",
            }),
            airtableRecord("rec-missing", {
              [FIELD_NAME.email]: "missing@example.com",
              [FIELD_NAME.pipelineStatus]: "In Campaign",
            }),
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (
      u.includes("/v0/app-test/") &&
      !u.includes("/tbl-leads") &&
      method === "POST"
    ) {
      return new Response(
        JSON.stringify(airtableRecord("archive-1", {})),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (u.endsWith("/v0/app-test/tbl-leads/rec-bounced") && method === "DELETE") {
      return new Response(JSON.stringify({ deleted: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (u.endsWith("/v0/app-test/tbl-leads/rec-missing") && method === "PATCH") {
      return new Response(
        JSON.stringify(
          airtableRecord("rec-missing", JSON.parse(String(init?.body)).fields)
        ),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unhandled fetch: ${method} ${u}`);
  }) as typeof fetch;

  try {
    const { runReengagementJob } = await import(
      "../../lib/services/reengagement"
    );
    const summary = await runReengagementJob({
      reengagementDays: 21,
      includeMovedLeads: true,
      annotateLeadErrors: true,
    });

    assert.equal(summary.checked, 3);
    assert.equal(summary.moved, 1);
    assert.equal(summary.errors.length, 0);
    assert.equal(summary.movedLeads.length, 1);
    assert.match(summary.movedLeads[0], /Terminal: Bounced/);

    const archivePosts = calls.filter(
      (c) =>
        c.url.includes("/v0/app-test/") &&
        !c.url.includes("/tbl-leads") &&
        c.init.method === "POST"
    );
    assert.equal(archivePosts.length, 1);
    const missingDatePatch = calls.find(
      (c) =>
        c.url.endsWith("/v0/app-test/tbl-leads/rec-missing") &&
        c.init.method === "PATCH"
    );
    assert.ok(missingDatePatch);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
