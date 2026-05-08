import assert from "node:assert/strict";
import test from "node:test";
import { FIELD_NAME } from "../../lib/schema";

test("listLeads reads Airtable with auth, sorting, and pagination without a real network call", async () => {
  process.env.AIRTABLE_API_KEY = "test-airtable-key";
  process.env.AIRTABLE_BASE_ID = "app-test";
  process.env.AIRTABLE_LEADS_TABLE_ID = "tbl-leads";

  const calls: Array<{ url: string; init: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const hasOffset = String(url).includes("offset=page-2");
    return new Response(
      JSON.stringify(
        hasOffset
          ? {
              records: [
                {
                  id: "rec-2",
                  createdTime: "2026-05-02T00:00:00.000Z",
                  fields: {
                    [FIELD_NAME.name]: "Second Lead",
                    [FIELD_NAME.email]: "second@example.com",
                  },
                },
              ],
            }
          : {
              records: [
                {
                  id: "rec-1",
                  createdTime: "2026-05-01T00:00:00.000Z",
                  fields: {
                    [FIELD_NAME.name]: "First Lead",
                    [FIELD_NAME.email]: "first@example.com",
                    [FIELD_NAME.personalizationInsights]: "- Opened a new facility.",
                  },
                },
              ],
              offset: "page-2",
            }
      ),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const { listLeads } = await import("../../lib/airtable");
    const leads = await listLeads({
      filterByFormula: `{${FIELD_NAME.pipelineStatus}} = 'Approved'`,
      sort: [{ field: FIELD_NAME.initialOutreachDate, direction: "desc" }],
    });

    assert.deepEqual(
      leads.map((lead) => lead.id),
      ["rec-1", "rec-2"]
    );
    assert.equal(leads[0].personalizationInsights, "- Opened a new facility.");
    assert.equal(calls.length, 2);
    assert.ok(calls[0].url.startsWith("https://api.airtable.com/v0/app-test/tbl-leads?"));
    assert.match(calls[0].url, /filterByFormula=/);
    assert.match(calls[1].url, /offset=page-2/);
    assert.equal(
      (calls[0].init.headers as Record<string, string>).Authorization,
      "Bearer test-airtable-key"
    );
    assert.ok(calls.every((call) => call.init.method === undefined));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("updateLead PATCHes only mapped fields and never sends undefined values", async () => {
  process.env.AIRTABLE_API_KEY = "test-airtable-key";
  process.env.AIRTABLE_BASE_ID = "app-test";
  process.env.AIRTABLE_LEADS_TABLE_ID = "tbl-leads";

  const calls: Array<{ url: string; init: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(
      JSON.stringify({
        id: "rec-1",
        createdTime: "2026-05-01T00:00:00.000Z",
        fields: {
          [FIELD_NAME.personalizationHook]: "I saw the facility expansion.",
          [FIELD_NAME.personalizationConfidence]: "High",
          [FIELD_NAME.personalizationReviewed]: true,
          [FIELD_NAME.personalizationHookSource]: "AI Specific",
          [FIELD_NAME.personalizationAiCandidate]: "",
          [FIELD_NAME.campaignDefaultHookSnapshot]: "I noticed your team is focused on throughput.",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const { updateLead } = await import("../../lib/airtable");
    const lead = await updateLead("rec-1", {
      personalizationHook: "I saw the facility expansion.",
      personalizationConfidence: "High",
      personalizationReviewed: true,
      personalizationHookSource: "AI Specific",
      personalizationAiCandidate: "",
      campaignDefaultHookSnapshot: "I noticed your team is focused on throughput.",
      syncErrors: undefined,
    });

    assert.equal(lead.personalizationConfidence, "High");
    assert.equal(lead.personalizationHookSource, "AI Specific");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.airtable.com/v0/app-test/tbl-leads/rec-1");
    assert.equal(calls[0].init.method, "PATCH");

    const body = JSON.parse(String(calls[0].init.body));
    assert.deepEqual(body, {
      fields: {
        [FIELD_NAME.personalizationHook]: "I saw the facility expansion.",
        [FIELD_NAME.personalizationConfidence]: "High",
        [FIELD_NAME.personalizationReviewed]: true,
        [FIELD_NAME.personalizationHookSource]: "AI Specific",
        [FIELD_NAME.personalizationAiCandidate]: "",
        [FIELD_NAME.campaignDefaultHookSnapshot]: "I noticed your team is focused on throughput.",
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
