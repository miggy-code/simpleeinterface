/**
 * POST /api/campaigns/preview
 *
 * Generates a campaign preview (default hook + 3-email sequence) using
 * DeepSeek. **Does not write anything to Instantly** — the operator reviews
 * and edits the preview, then submits POST /api/campaigns to actually
 * create the campaign with the final edited content.
 *
 * Request body:
 *   {
 *     campaignName: string,
 *     targetRole: string,
 *     targetIndustry?: string,
 *     painPoints: string,
 *     offering: string,
 *     cta: string,
 *   }
 *
 * Response:
 *   {
 *     defaultHook: string,
 *     emails: Array<{ subject: string; body: string }>,
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  buildCampaignSequenceUserPrompt,
  buildCampaignSequenceSystemPrompt,
} from "@/lib/prompts";
import { generateCampaignDefaultHook } from "@/lib/campaign-default-hook";
import { ConfigError, toErrorResponse } from "@/lib/http/errors";
import { parseJsonObject, readOptionalString, readString } from "@/lib/http/validation";

export const dynamic = "force-dynamic";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY ?? "missing",
  baseURL: DEEPSEEK_BASE_URL,
});

interface PreviewBody {
  campaignName?: string;
  targetRole?: string;
  targetIndustry?: string;
  painPoints?: string;
  offering?: string;
  cta?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await parseJsonObject(req)) as PreviewBody;
    const campaignName = readString(
      body as Record<string, unknown>,
      "campaignName"
    );
    const targetRole = readString(body as Record<string, unknown>, "targetRole");
    const targetIndustry = readOptionalString(
      body as Record<string, unknown>,
      "targetIndustry"
    );
    const painPoints = readString(body as Record<string, unknown>, "painPoints");
    const offering = readString(body as Record<string, unknown>, "offering");
    const cta = readString(body as Record<string, unknown>, "cta");

    if (!process.env.DEEPSEEK_API_KEY) {
      throw new ConfigError("DEEPSEEK_API_KEY is not set on the server.");
    }

    console.info(
      `[campaigns:preview] generating: name="${campaignName}" role="${targetRole}" industry="${targetIndustry ?? "?"}"`
    );

    // ── 1. Generate email sequence ───────────────────────────────────────────
    const emailRes = await deepseek.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: buildCampaignSequenceSystemPrompt() },
        {
          role: "user",
          content: buildCampaignSequenceUserPrompt({
            targetRole,
            targetIndustry,
            painPoints,
            offering,
            cta,
          }),
        },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    let emails: Array<{ subject: string; body: string }>;
    try {
      const parsed = JSON.parse(emailRes.choices[0]?.message?.content ?? "{}");
      const arr = Array.isArray(parsed) ? parsed : parsed.emails ?? [];
      if (!Array.isArray(arr) || arr.length === 0) {
        throw new Error("AI returned no emails");
      }
      emails = arr;
    } catch (e) {
      return NextResponse.json(
        {
          error: `Failed to parse AI email output: ${
            e instanceof Error ? e.message : String(e)
          }`,
        },
        { status: 500 }
      );
    }

    console.info(
      `[campaigns:preview] sequence generated: tokens=${emailRes.usage?.total_tokens ?? "?"} emails=${emails.length}`
    );

    const firstEmail = emails[0];
    if (!firstEmail?.subject?.trim() || !firstEmail?.body?.trim()) {
      return NextResponse.json(
        { error: "AI returned an invalid first email" },
        { status: 500 }
      );
    }

    // ── 2. Generate default hook with the actual opening email -------------
    const { defaultHook, tokens: hookTokens } = await generateCampaignDefaultHook({
      campaignName,
      targetRole,
      targetIndustry,
      painPoints,
      offering,
      cta,
      firstEmailSubject: firstEmail.subject,
      firstEmailBody: firstEmail.body,
      sequenceEmails: emails,
    });

    console.info(
      `[campaigns:preview] default hook generated: tokens=${hookTokens} text="${defaultHook}"`
    );

    return NextResponse.json({ defaultHook, emails });
  } catch (err) {
    console.error("[campaigns:preview]", err);
    return toErrorResponse(err, "Failed to generate preview");
  }
}
