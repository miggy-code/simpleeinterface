/**
 * GET  /api/campaigns          — list ALL Instantly campaigns (incl. drafts)
 * POST /api/campaigns          — create a fixed-template internal Throttl
 *                                campaign in Instantly.
 *
 * Source of truth for campaigns: Instantly. This internal app always writes
 * the same sequence body and relies on lead fields/custom variables for merge
 * tags: first_name, company_name, title, and industry.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createInstantlyCampaign,
  getInstantlyCampaign,
  listInstantlyAccounts,
  listInstantlyCampaignAnalytics,
  listInstantlyCampaigns,
  setInstantlyCampaignSequence,
} from "@/lib/instantly";
import { THROTTL_STARTER_SEQUENCE_DELAYS } from "@/lib/campaign-sequence";
import {
  mergeCampaignAnalytics,
  CAMPAIGN_STATUS_LABELS,
} from "@/lib/campaigns";
import { ValidationError, toErrorResponse } from "@/lib/http/errors";
import { parseJsonObject, readString } from "@/lib/http/validation";
import { FIXED_CAMPAIGN_EMAILS } from "@/lib/fixed-campaign";

// ─── GET ─────────────────────────────────────────────────────────────────────
// Returns ALL campaigns (no status filter). Operator activates Drafts in
// Instantly's UI. Mapping the integer status to a readable string keeps the
// frontend free of magic numbers.

export async function GET() {
  try {
    const [campaigns, analytics] = await Promise.all([
      listInstantlyCampaigns(),
      listInstantlyCampaignAnalytics().catch((err) => {
        console.warn("[campaigns:list] analytics fetch failed", err);
        return [];
      }),
    ]);
    const mapped = mergeCampaignAnalytics(campaigns, analytics);
    console.info(`[campaigns:list] returned ${mapped.length} campaigns`);
    return NextResponse.json({ campaigns: mapped });
  } catch (err) {
    console.error("[campaigns:list]", err);
    return NextResponse.json(
      {
        error: `Failed to fetch campaigns: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────
// Creates the fixed campaign in Instantly atomically.
//
// Body:
//   {
//     campaignName: string,
//   }
//
// Response: { campaignId, name, status, emailsAdded }
//
// Failure modes are loud — if Instantly rejects the create, the email step
// PATCH, or the custom_variables PATCH, the response surfaces a 5xx with
// the underlying error text. Operators can grep server logs for `[campaigns:create]`
// to trace the full sequence.

interface CreateBody {
  campaignName?: string;
}

function buildDefaultCampaignSchedule() {
  return {
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
  };
}

async function buildSenderEmailList() {
  const accounts = await listInstantlyAccounts({ status: 1 });
  const emailList = accounts
    .map((account) => account.email?.trim())
    .filter((email): email is string => Boolean(email));

  if (emailList.length === 0) {
    throw new ValidationError(
      "No active Instantly sender accounts were found; cannot create campaign"
    );
  }

  return emailList;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await parseJsonObject(req)) as CreateBody;
    const campaignName = readString(body as Record<string, unknown>, "campaignName");
    const cleanEmails = FIXED_CAMPAIGN_EMAILS.map((e) => ({
      subject: e.subject!.trim(),
      body: e.body!.trim(),
    }));
    const emailList = await buildSenderEmailList();

    if (!cleanEmails.length) {
      throw new ValidationError("Fixed campaign template is missing");
    }

    // ── 1. Create campaign with the required sender pool and schedule ──────
    console.info(
      `[campaigns:create] creating Instantly campaign: name="${campaignName.trim()}"`
    );
    const created = await createInstantlyCampaign({
      name: campaignName.trim(),
      campaign_schedule: buildDefaultCampaignSchedule(),
      email_list: emailList,
      sequences: [
        {
          steps: cleanEmails.map((email, index) => ({
            type: "email",
            delay: THROTTL_STARTER_SEQUENCE_DELAYS[index] ?? 5,
            variants: [{ subject: email.subject, body: email.body }],
          })),
        },
      ],
      custom_variables: { template: "throttl-ai-toolkit-v1" },
    });

    // ── 2. Reconcile the full sequence immediately after create ─────────────
    console.info(
      `[campaigns:create] setting sequence: id=${created.id} steps=${cleanEmails.length}`
    );
    await setInstantlyCampaignSequence(created.id, cleanEmails);

    // ── 3. Verify the fixed sequence landed.
    const verified = await getInstantlyCampaign(created.id);
    const firstVariant = verified.sequences?.[0]?.steps?.[0]?.variants?.[0];
    if (
      firstVariant?.subject !== cleanEmails[0].subject ||
      firstVariant?.body !== cleanEmails[0].body
    ) {
      throw new Error(
        "Instantly campaign was created, but the fixed email sequence did not verify after write"
      );
    }

    console.info(
      `[campaigns:create] success: id=${created.id} status=${
        CAMPAIGN_STATUS_LABELS[created.status] ?? created.status
      }`
    );

    return NextResponse.json({
      success: true,
      campaignId: created.id,
      name: created.name,
      status: CAMPAIGN_STATUS_LABELS[created.status] ?? `Unknown (${created.status})`,
      statusCode: created.status,
      emailsAdded: cleanEmails.length,
    });
  } catch (err) {
    console.error("[campaigns:create]", err);
    return toErrorResponse(err, "Failed to create campaign");
  }
}
