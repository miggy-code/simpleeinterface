/**
 * POST /api/leads/:id/revert-hook
 *
 * Replaces a lead's `personalizationHook` with the campaign's default hook
 * (read from Instantly: `campaign.custom_variables.default_hook`) and
 * resets confidence to Low + reviewed = true.
 *
 * Body: { campaignId?: string }  — optional override; falls back to
 * `lead.instantlyCampaignId`.
 */

import { NextRequest, NextResponse } from "next/server";
import { getLead, updateLead } from "@/lib/airtable";
import { getCampaignDefaultHook } from "@/lib/personalize";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const campaignIdOverride: string | undefined = body.campaignId;

    const lead = await getLead(id);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const effectiveCampaignId = campaignIdOverride || lead.instantlyCampaignId;
    if (!effectiveCampaignId) {
      return NextResponse.json(
        { error: "No campaign associated with this lead" },
        { status: 400 }
      );
    }

    const defaultHook = await getCampaignDefaultHook(effectiveCampaignId);
    if (!defaultHook) {
      return NextResponse.json(
        {
          error:
            "Instantly campaign has no `custom_variables.default_hook` to revert to. Set one via the campaign wizard or Instantly UI.",
        },
        { status: 400 }
      );
    }

    const updated = await updateLead(id, {
      personalizationHook: defaultHook,
      personalizationConfidence: "Low",
      personalizationReviewed: true,
      personalizationHookSource: "Reverted Default",
      campaignDefaultHookSnapshot: defaultHook,
    });

    console.info(
      `[revert-hook] reverted lead=${id} campaign=${effectiveCampaignId} ` +
        `hook="${defaultHook.slice(0, 60)}${defaultHook.length > 60 ? "…" : ""}"`
    );

    return NextResponse.json({ success: true, lead: updated });
  } catch (err) {
    console.error("[revert-hook]", err);
    return NextResponse.json(
      {
        error: `Internal server error: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}
