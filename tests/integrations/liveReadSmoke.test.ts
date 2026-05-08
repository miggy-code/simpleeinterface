import assert from "node:assert/strict";
import test from "node:test";

const runLiveReadSmoke = process.env.RUN_LIVE_READ_SMOKE === "1";

test(
  "live read-only Airtable and Instantly smoke test",
  {
    skip: runLiveReadSmoke
      ? false
      : "set RUN_LIVE_READ_SMOKE=1 to verify live read-only integrations",
  },
  async () => {
    assert.ok(
      process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PAT,
      "AIRTABLE_API_KEY or AIRTABLE_PAT is required"
    );
    assert.ok(process.env.INSTANTLY_API_KEY, "INSTANTLY_API_KEY is required");

    const [{ listLeads }, { listInstantlyCampaigns }] = await Promise.all([
      import("../../lib/airtable"),
      import("../../lib/instantly"),
    ]);

    const [leads, campaigns] = await Promise.all([
      listLeads({ maxRecords: 1 }),
      listInstantlyCampaigns(),
    ]);

    assert.ok(Array.isArray(leads));
    assert.ok(Array.isArray(campaigns));
  }
);
