import { NextRequest, NextResponse } from "next/server";
import { generateCampaignDefaultHook } from "@/lib/campaign-default-hook";
import { ValidationError, toErrorResponse } from "@/lib/http/errors";
import {
  parseJsonObject,
  readOptionalString,
  readString,
} from "@/lib/http/validation";

export const dynamic = "force-dynamic";

interface DefaultHookPreviewBody {
  campaignName?: string;
  targetRole?: string;
  targetIndustry?: string;
  painPoints?: string;
  offering?: string;
  cta?: string;
  firstEmailSubject?: string;
  firstEmailBody?: string;
  sequenceEmails?: Array<{ subject?: string; body?: string }>;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await parseJsonObject(req)) as DefaultHookPreviewBody;
    const campaignName = readString(
      body as Record<string, unknown>,
      "campaignName"
    );
    const targetRole =
      readOptionalString(body as Record<string, unknown>, "targetRole") ??
      "the prospect";
    const targetIndustry = readOptionalString(
      body as Record<string, unknown>,
      "targetIndustry"
    );
    const painPoints =
      readOptionalString(body as Record<string, unknown>, "painPoints") ??
      "the operational problem implied by the first campaign email";
    const offering =
      readOptionalString(body as Record<string, unknown>, "offering") ??
      "the offer described in the first campaign email";
    const cta =
      readOptionalString(body as Record<string, unknown>, "cta") ??
      "the call to action in the first campaign email";
    const firstEmailSubject = readString(
      body as Record<string, unknown>,
      "firstEmailSubject"
    );
    const firstEmailBody = readString(
      body as Record<string, unknown>,
      "firstEmailBody"
    );
    const sequenceEmails = Array.isArray(
      (body as Record<string, unknown>).sequenceEmails
    )
      ? ((body as Record<string, unknown>).sequenceEmails as Array<{
          subject?: string;
          body?: string;
        }>)
      : undefined;

    if (!`${firstEmailSubject}\n${firstEmailBody}`.includes("{{personalization_hook}}")) {
      throw new ValidationError(
        "The first email must contain {{personalization_hook}} before a default hook can be generated."
      );
    }

    const { defaultHook } = await generateCampaignDefaultHook({
      campaignName: campaignName.trim(),
      targetRole: targetRole.trim(),
      targetIndustry,
      painPoints: painPoints.trim(),
      offering: offering.trim(),
      cta: cta.trim(),
      firstEmailSubject: firstEmailSubject.trim(),
      firstEmailBody: firstEmailBody.trim(),
      sequenceEmails,
    });

    return NextResponse.json({ defaultHook });
  } catch (err) {
    console.error("[campaigns:default-hook:preview]", err);
    return toErrorResponse(err, "Failed to generate default hook");
  }
}
