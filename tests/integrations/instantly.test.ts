import assert from "node:assert/strict";
import test from "node:test";

test("createInstantlyLead posts the right internal campaign payload without a real network call", async () => {
  process.env.INSTANTLY_API_KEY = "test-instantly-key";
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(
      JSON.stringify({
        id: "instantly-lead-1",
        email: "alex@example.com",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const { createInstantlyLead } = await import("../../lib/instantly");
    const result = await createInstantlyLead({
      campaign: "campaign-123",
      email: "alex@example.com",
      first_name: "Alex",
      last_name: "Rivera",
      company_name: "Bay State Fabrication",
      website: "https://baystate.example",
      company_domain: "baystate.example",
      custom_variables: {
        title: "COO",
        industry: "Manufacturing",
      },
    });

    assert.equal(result.id, "instantly-lead-1");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.instantly.ai/api/v2/leads");
    assert.equal(calls[0].init.method, "POST");
    assert.equal(
      (calls[0].init.headers as Record<string, string>).Authorization,
      "Bearer test-instantly-key"
    );

    const body = JSON.parse(String(calls[0].init.body));
    assert.deepEqual(body, {
      campaign: "campaign-123",
      email: "alex@example.com",
      first_name: "Alex",
      last_name: "Rivera",
      company_name: "Bay State Fabrication",
      website: "https://baystate.example",
      company_domain: "baystate.example",
      custom_variables: {
        title: "COO",
        industry: "Manufacturing",
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("listInstantlyCampaigns paginates with read-only GET requests", async () => {
  process.env.INSTANTLY_API_KEY = "test-instantly-key";
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const hasCursor = String(url).includes("starting_after=cursor-1");
    return new Response(
      JSON.stringify(
        hasCursor
          ? { items: [{ id: "campaign-2", name: "Second" }] }
          : {
              items: [{ id: "campaign-1", name: "First" }],
              next_starting_after: "cursor-1",
            }
      ),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const { listInstantlyCampaigns } = await import("../../lib/instantly");
    const campaigns = await listInstantlyCampaigns();

    assert.deepEqual(
      campaigns.map((campaign) => campaign.id),
      ["campaign-1", "campaign-2"]
    );
    assert.equal(calls.length, 2);
    assert.ok(calls.every((call) => call.init.method === undefined));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("listInstantlyCampaignAnalytics hits the aggregate analytics endpoint", async () => {
  process.env.INSTANTLY_API_KEY = "test-instantly-key";
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(
      JSON.stringify([
        {
          campaign_id: "campaign-1",
          campaign_name: "First",
          reply_count_unique: 3,
          open_count_unique: 9,
          emails_sent_count: 30,
        },
      ]),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const { listInstantlyCampaignAnalytics } = await import("../../lib/instantly");
    const analytics = await listInstantlyCampaignAnalytics();

    assert.equal(analytics.length, 1);
    assert.equal(analytics[0].campaign_id, "campaign-1");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.instantly.ai/api/v2/campaigns/analytics");
    assert.equal(calls[0].init.method, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("listInstantlyAccounts paginates active sender accounts", async () => {
  process.env.INSTANTLY_API_KEY = "test-instantly-key";
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const hasCursor = String(url).includes("starting_after=cursor-1");
    return new Response(
      JSON.stringify(
        hasCursor
          ? {
              items: [
                { email: "sender2@example.com", status: 1 },
                { email: "", status: 1 },
              ],
            }
          : {
              items: [
                { email: "sender1@example.com", status: 1 },
                { email: "inactive@example.com", status: 0 },
              ],
              next_starting_after: "cursor-1",
            }
      ),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const { listInstantlyAccounts } = await import("../../lib/instantly");
    const accounts = await listInstantlyAccounts({ status: 1 });

    assert.deepEqual(
      accounts.map((account) => account.email),
      ["sender1@example.com", "inactive@example.com", "sender2@example.com", ""]
    );
    assert.equal(calls.length, 2);
    assert.ok(calls[0].url.includes("/accounts?limit=100&status=1"));
    assert.ok(calls.every((call) => call.init.method === undefined));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("createInstantlyCampaign posts the required create payload contract", async () => {
  process.env.INSTANTLY_API_KEY = "test-instantly-key";
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(
      JSON.stringify({
        id: "campaign-123",
        name: "Launch Campaign",
        status: 0,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const { createInstantlyCampaign } = await import("../../lib/instantly");
    const result = await createInstantlyCampaign({
      name: "Launch Campaign",
      custom_variables: { default_hook: "Hook" },
      campaign_schedule: {
        schedules: [
          {
            name: "Weekdays 9-5",
            timing: { from: "09:00", to: "17:00" },
            days: {
              monday: true,
              tuesday: true,
              wednesday: true,
              thursday: true,
              friday: true,
              saturday: false,
              sunday: false,
            },
            timezone: "America/Detroit",
          },
        ],
      },
      email_list: ["sender@example.com"],
      sequences: [
        {
          steps: [
            {
              type: "email",
              delay: 0,
              variants: [{ subject: "Hello", body: "Hi there" }],
            },
          ],
        },
      ],
    });

    assert.equal(result.id, "campaign-123");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.instantly.ai/api/v2/campaigns");
    assert.equal(calls[0].init.method, "POST");

    const body = JSON.parse(String(calls[0].init.body));
    assert.deepEqual(body, {
      name: "Launch Campaign",
      custom_variables: { default_hook: "Hook" },
      campaign_schedule: {
        schedules: [
          {
            name: "Weekdays 9-5",
            timing: { from: "09:00", to: "17:00" },
            days: {
              monday: true,
              tuesday: true,
              wednesday: true,
              thursday: true,
              friday: true,
              saturday: false,
              sunday: false,
            },
            timezone: "America/Detroit",
          },
        ],
      },
      email_list: ["sender@example.com"],
      sequences: [
        {
          steps: [
            {
              type: "email",
              delay: 0,
              variants: [{ subject: "Hello", body: "Hi there" }],
            },
          ],
        },
      ],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
