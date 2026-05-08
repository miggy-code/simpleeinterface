import { NextRequest, NextResponse } from "next/server";
import { getLead } from "@/lib/airtable";
import { verifyEmailWithDeBounce } from "@/lib/debounce";
import { pushLeadToInstantly } from "@/lib/outreach";
import { toErrorResponse } from "@/lib/http/errors";
import {
  parseOptionalJsonObject,
  readOptionalString,
} from "@/lib/http/validation";
import { resolveLeadPushContext } from "@/lib/services/push-to-campaign";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await parseOptionalJsonObject(req);
    const campaignId = readOptionalString(body, "campaignId");
    const campaignName = readOptionalString(body, "campaignName");

    const lead = await getLead(id);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    resolveLeadPushContext(lead, { campaignId, campaignName });

    const verification = await verifyEmailWithDeBounce(lead.email ?? "");
    if (verification.decision !== "safe") {
      return NextResponse.json(
        {
          error:
            verification.error ||
            `DeBounce result: ${verification.result || "unknown"}`,
          verification,
        },
        { status: 422 }
      );
    }

    const updatedLead = await pushLeadToInstantly({
      lead,
      campaignId,
      campaignName,
    });

    return NextResponse.json({ success: true, lead: updatedLead, verification });
  } catch (err) {
    console.error("[push]", err);
    return toErrorResponse(
      err,
      "Failed to push lead to Instantly"
    );
  }
}
