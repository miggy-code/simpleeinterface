/**
 * GET /api/campaigns/[id]/steps
 *
 * Returns the full email sequence steps for a given Instantly campaign.
 * Used by the Personalization Workbench to render a live, accurate preview
 * of how the personalization_hook will appear in the actual email.
 *
 * Response shape:
 * {
 *   campaignName: string,
 *   customVariables: string[],   // variable names used in this campaign
 *   defaultHook: string | null,   // campaign custom_variables.default_hook
 *   steps: Array<{
 *     stepNumber: number,
 *     delay: number,             // days after previous step
 *     subject: string,
 *     body: string,
 *   }>
 * }
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;
const INSTANTLY_BASE = "https://api.instantly.ai/api/v2";

interface InstantlyVariant {
  subject?: string;
  body?: string;
}

interface InstantlyStep {
  type?: string;
  delay?: number;
  variants?: InstantlyVariant[];
}

interface InstantlySequence {
  steps?: InstantlyStep[];
}

interface InstantlyCampaignFull {
  id: string;
  name: string;
  sequences?: InstantlySequence[];
  custom_variables?: Record<string, unknown>;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!INSTANTLY_API_KEY) {
    return NextResponse.json({ error: "INSTANTLY_API_KEY not set" }, { status: 500 });
  }

  try {
    const res = await fetch(`${INSTANTLY_BASE}/campaigns/${params.id}`, {
      headers: {
        Authorization: `Bearer ${INSTANTLY_API_KEY}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: `Instantly API error: ${err}` },
        { status: res.status }
      );
    }

    const campaign: InstantlyCampaignFull = await res.json();

    // Extract all email steps from the first sequence
    const sequence = campaign.sequences?.[0];
    const rawSteps = sequence?.steps || [];

    const steps = rawSteps
      .filter((s) => s.type === "email" || !s.type) // only email steps
      .map((s, idx) => {
        const variant = s.variants?.[0] || {};
        return {
          stepNumber: idx + 1,
          delay: s.delay ?? 0,
          subject: variant.subject || "",
          body: variant.body || "",
        };
      });

    // Collect all unique {{variable}} names used across all steps
    const variableSet = new Set<string>();
    for (const step of steps) {
      const matches = (step.subject + " " + step.body).matchAll(/\{\{(\w+)\}\}/g);
      for (const m of matches) {
        variableSet.add(m[1]);
      }
    }

    return NextResponse.json({
      campaignName: campaign.name,
      customVariables: Array.from(variableSet),
      defaultHook:
        typeof campaign.custom_variables?.default_hook === "string"
          ? campaign.custom_variables.default_hook
          : null,
      steps,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
