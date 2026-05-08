import assert from "node:assert/strict";
import test from "node:test";

test("fixed campaign starter sequence has one send plus two follow-ups", async () => {
  const { FIXED_CAMPAIGN_EMAILS } = await import("../../lib/fixed-campaign");

  assert.equal(FIXED_CAMPAIGN_EMAILS.length, 3);
  assert.match(FIXED_CAMPAIGN_EMAILS[0].subject, /^[A-Z]/);
  assert.match(FIXED_CAMPAIGN_EMAILS[1].subject, /^[A-Z]/);
  assert.match(FIXED_CAMPAIGN_EMAILS[2].subject, /^[A-Z]/);
  assert.ok(FIXED_CAMPAIGN_EMAILS[1].body.split(/\n+/).length >= 2);
  assert.ok(FIXED_CAMPAIGN_EMAILS[2].body.split(/\n+/).length >= 2);
});

test("mergeCampaignAnalytics enriches campaigns and sortCampaigns prefers newest first", async () => {
  const {
    campaignMatchesPreset,
    mergeCampaignAnalytics,
    sortCampaigns,
  } = await import("../../lib/campaigns");

  const merged = mergeCampaignAnalytics(
    [
      {
        id: "campaign-old",
        name: "Old Campaign",
        status: 0,
        timestamp_created: "2025-01-01T10:00:00.000Z",
        timestamp_updated: "2025-01-02T10:00:00.000Z",
        custom_variables: { default_hook: "Use this hook" },
        email_list: ["sales@example.com"],
        campaign_schedule: {
          start_date: "2025-01-01",
          end_date: null,
          schedules: [],
        },
      },
      {
        id: "campaign-new",
        name: "New Campaign",
        status: 1,
        timestamp_created: "2025-05-01T10:00:00.000Z",
        timestamp_updated: "2025-05-02T10:00:00.000Z",
        custom_variables: {},
        email_tag_list: ["tag-1"],
        email_list: ["sales@example.com", "ops@example.com"],
        campaign_schedule: {},
      },
    ],
    [
      {
        campaign_id: "campaign-new",
        campaign_name: "New Campaign",
        contacted_count: 20,
        emails_sent_count: 40,
        open_count_unique: 10,
        reply_count_unique: 2,
        bounced_count: 1,
        total_opportunities: 1,
        total_opportunity_value: 2500,
        total_meeting_booked: 1,
      },
    ]
  );

  assert.equal(merged[0].status, "Draft");
  assert.equal(merged[1].status, "Active");
  assert.equal(merged[1].analytics?.replyRate, 10);
  assert.equal(merged[1].analytics?.openRate, 50);
  assert.equal(merged[1].analytics?.bounceRate, 3);
  assert.equal(campaignMatchesPreset(merged[1], "high-performer"), true);
  assert.equal(campaignMatchesPreset(merged[0], "with-hooks"), true);
  assert.equal(campaignMatchesPreset(merged[1], "tagged"), true);
  assert.deepEqual(
    sortCampaigns(merged, "newest").map((campaign) => campaign.id),
    ["campaign-new", "campaign-old"]
  );
});

test("validateCampaignAssignment requires a real Instantly campaign", async () => {
  const { validateCampaignAssignment } = await import(
    "../../lib/campaign-assignment"
  );

  const validCampaign = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Configured Campaign",
    custom_variables: { template: "throttl-ai-toolkit-v1" },
    sequences: [
      {
        steps: [
          {
            type: "email",
            variants: [
              {
                subject: "practical AI use cases for {{company_name}}",
                body: "Hi {{first_name}},\n\nAI toolkit note for {{company_name}}.",
              },
            ],
          },
        ],
      },
    ],
  };

  const assignment = await validateCampaignAssignment(validCampaign.id, async () => validCampaign);
  assert.deepEqual(assignment, {
    campaignId: validCampaign.id,
    campaignName: "Configured Campaign",
  });

  await assert.rejects(
    () =>
      validateCampaignAssignment(validCampaign.id, async () => ({
        ...validCampaign,
        id: "22222222-2222-4222-8222-222222222222",
      })),
    /mismatched campaign ID/
  );
});
