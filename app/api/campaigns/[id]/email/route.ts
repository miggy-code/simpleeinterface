/**
 * GET   /api/campaigns/:id/email  — fetch the full sequence steps (raw shape)
 * PATCH /api/campaigns/:id/email  — save a single step's subject/body back to
 *                                    Instantly (called by CampaignEmailEditor)
 * POST  /api/campaigns/:id/email  — replace the full `sequences` array
 *                                    (back-compat with the old editor flow)
 *
 * Used by the Campaign Email Editor (`app/campaigns/editor/page.tsx`) to view
 * and edit the campaign-level email template (all steps).
 *
 * Why both PATCH and POST exist: the React client (`CampaignEmailEditor`)
 * uses PATCH with a step-indexed shape `{ stepIndex, subject, body }`, which
 * is the natural per-step edit. POST is kept for callers that already had the
 * full `sequences` array on hand and want to replace it wholesale.
 *
 * Note: Instantly's API itself only accepts full-sequence PATCH on
 * `PATCH /campaigns/:id`. The PATCH handler here translates the per-step edit
 * into a full-sequence write by GETting the campaign first, mutating the
 * targeted step in place, then PATCHing the merged sequences back.
 */
import { NextRequest, NextResponse } from "next/server";
import { getInstantlyCampaign } from "@/lib/instantly";
import { buildInstantlySequenceFromEditorSteps } from "@/lib/campaign-sequence";

export const dynamic = "force-dynamic";

const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;
const INSTANTLY_BASE = "https://api.instantly.ai/api/v2";

function instantlyHeaders() {
  return {
    Authorization: `Bearer ${INSTANTLY_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const res = await fetch(`${INSTANTLY_BASE}/campaigns/${params.id}`, {
      headers: instantlyHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Instantly API error: ${res.status} ${text}` },
        { status: res.status }
      );
    }

    const campaign = await res.json();

    // Extract the sequences array — Instantly nests steps inside sequences
    const sequences: unknown[] = campaign.sequences || [];
    const steps = sequences.flatMap((seq: unknown) => {
      const s = seq as { steps?: unknown[] };
      return s.steps || [];
    });

    return NextResponse.json({
      campaignId: params.id,
      campaignName: campaign.name,
      steps,
      rawSequences: sequences,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    /**
     * Body: { sequences: <updated sequences array from Instantly campaign> }
     * The client sends back the full sequences array with edits applied.
     */
    const { sequences } = (await req.json()) as { sequences: unknown[] };

    if (!sequences || !Array.isArray(sequences)) {
      return NextResponse.json(
        { error: "sequences array is required" },
        { status: 400 }
      );
    }

    const res = await fetch(`${INSTANTLY_BASE}/campaigns/${params.id}`, {
      method: "PATCH",
      headers: instantlyHeaders(),
      body: JSON.stringify({ sequences }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Instantly API error: ${res.status} ${text}` },
        { status: res.status }
      );
    }

    const updated = await res.json();
    return NextResponse.json({ ok: true, campaign: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

/**
 * PATCH — update a single email step or replace the campaign's full editor
 * sequence.
 *
 * Body: { stepIndex: number, subject: string, body: string }
 *    or { steps: Array<{ subject: string, body: string, delayDays: number }> }
 *
 * Implementation: Instantly's PATCH /campaigns/:id is full-replacement on
 * `sequences`, so we GET the campaign, mutate the targeted step in place, and
 * PATCH the merged sequences back. Any sequences[1+] (which Instantly uses
 * rarely) and any non-edited steps are preserved unchanged.
 */
interface StepPatchBody {
  stepIndex?: unknown;
  subject?: unknown;
  body?: unknown;
  steps?: unknown;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!INSTANTLY_API_KEY) {
    return NextResponse.json(
      { error: "INSTANTLY_API_KEY not set" },
      { status: 500 }
    );
  }

  let parsed: StepPatchBody;
  try {
    parsed = (await req.json()) as StepPatchBody;
  } catch {
    return NextResponse.json(
      { error: "Body must be valid JSON" },
      { status: 400 }
    );
  }

  if (Array.isArray(parsed.steps)) {
    try {
      const steps = parsed.steps.map((step, index) => {
        if (!step || typeof step !== "object") {
          throw new Error(`steps[${index}] must be an object`);
        }
        const value = step as Record<string, unknown>;
        if (typeof value.subject !== "string" || typeof value.body !== "string") {
          throw new Error(`steps[${index}] subject and body must be strings`);
        }
        return {
          subject: value.subject,
          body: value.body,
          delayDays:
            typeof value.delayDays === "number"
              ? value.delayDays
              : typeof value.delay === "number"
              ? value.delay
              : 0,
        };
      });

      if (steps.length === 0) {
        return NextResponse.json(
          { error: "steps must contain at least one email step" },
          { status: 400 }
        );
      }

      const sequences = buildInstantlySequenceFromEditorSteps(steps);
      const res = await fetch(`${INSTANTLY_BASE}/campaigns/${params.id}`, {
        method: "PATCH",
        headers: instantlyHeaders(),
        body: JSON.stringify({ sequences }),
      });

      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json(
          { error: `Instantly API error: ${res.status} ${text}` },
          { status: res.status }
        );
      }

      const updated = await res.json();
      console.info(
        `[campaigns:email:patch] id=${params.id} fullSequenceSteps=${steps.length}`
      );
      return NextResponse.json({
        ok: true,
        steps: steps.length,
        campaign: updated,
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e) },
        { status: 400 }
      );
    }
  }

  const stepIndex = Number(parsed.stepIndex);
  const subject = typeof parsed.subject === "string" ? parsed.subject : null;
  const body = typeof parsed.body === "string" ? parsed.body : null;

  if (!Number.isInteger(stepIndex) || stepIndex < 0) {
    return NextResponse.json(
      { error: "stepIndex must be a non-negative integer" },
      { status: 400 }
    );
  }
  if (subject === null || body === null) {
    return NextResponse.json(
      { error: "subject and body are required strings" },
      { status: 400 }
    );
  }

  try {
    // 1. Fetch current campaign so we have the canonical sequences shape.
    const current = await getInstantlyCampaign(params.id);
    const sequences = (current.sequences ?? []).map((seq) => ({
      ...seq,
      steps: (seq.steps ?? []).map((s) => ({
        ...s,
        variants: (s.variants ?? []).map((v) => ({ ...v })),
      })),
    }));

    if (sequences.length === 0) {
      sequences.push({ steps: [] });
    }
    const firstSeq = sequences[0];
    const steps = firstSeq.steps ?? [];

    // The client's `stepIndex` is an index into the email-only filtered list
    // shown by GET /api/campaigns/:id/steps. Resolve it back to the raw index
    // so we mutate the right step (campaigns may interleave non-email steps).
    const emailRawIndices = steps
      .map((s, i) => (s.type === "email" || !s.type ? i : -1))
      .filter((i) => i !== -1);

    if (stepIndex >= emailRawIndices.length) {
      return NextResponse.json(
        {
          error: `stepIndex ${stepIndex} out of range — campaign has ${emailRawIndices.length} email step(s)`,
        },
        { status: 400 }
      );
    }

    const rawIndex = emailRawIndices[stepIndex];

    // 2. Mutate the targeted step's first variant. Preserve type/delay.
    const target = steps[rawIndex];
    const variants =
      target.variants && target.variants.length > 0
        ? [...target.variants]
        : [{}];
    variants[0] = { ...variants[0], subject, body };
    steps[rawIndex] = { ...target, variants };
    firstSeq.steps = steps;

    // 3. PATCH the full sequences array back to Instantly.
    const res = await fetch(`${INSTANTLY_BASE}/campaigns/${params.id}`, {
      method: "PATCH",
      headers: instantlyHeaders(),
      body: JSON.stringify({ sequences }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Instantly API error: ${res.status} ${text}` },
        { status: res.status }
      );
    }

    const updated = await res.json();
    console.info(
      `[campaigns:email:patch] id=${params.id} stepIndex=${stepIndex} subject="${subject.slice(0, 40)}…"`
    );
    return NextResponse.json({
      ok: true,
      stepIndex,
      campaign: updated,
    });
  } catch (e) {
    console.error("[campaigns:email:patch]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
