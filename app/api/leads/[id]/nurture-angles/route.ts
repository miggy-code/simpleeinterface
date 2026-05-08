/**
 * POST /api/leads/[id]/nurture-angles
 *
 * Uses DeepSeek to generate 3 re-engagement nurture angles for a lead in the
 * Re-engagement Archive. Each angle is a short content/value-add framing
 * that can be used as the subject of a blog post, case study, or newsletter
 * to send during the nurture sequence.
 *
 * Body: { archiveReason?, industry?, title?, companyName?, personalizationInsights? }
 */
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getLead } from "@/lib/airtable";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Lazy-initialize inside the handler so the client is never instantiated
  // at module load time — this prevents Vercel build failures when env vars
  // are not available during static page data collection.
  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com/v1",
  });

  try {
    const lead = await getLead(params.id);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const name =
      lead.name ||
      [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
      "this contact";

    const prompt = `You are a B2B content strategist helping Gabriel Gavrilov at Throttl re-engage cold leads with genuinely valuable, non-salesy content.

# About Throttl
Throttl helps non-technical business owners in manufacturing, distribution, logistics, food production, and industrial services adopt AI practically. The core offer is a FREE 1-hour AI strategy session. These are pragmatic, skeptical owners who are motivated by ROI and time savings — not buzzwords.

# Lead profile
- Name: ${name}
- Title: ${lead.title || "unknown"}
- Company: ${lead.companyName || "unknown"}
- Industry: ${lead.industry || "unknown"}
- Revenue band: ${lead.revenueBand || "unknown"}
- Why they left the sequence: ${lead.archiveReason || "sequence complete"}
- Original personalization hook used: ${lead.personalizationHook || "none"}
- Research insights: ${lead.personalizationInsights || "none available"}

# Your task
Generate exactly 3 distinct re-engagement content angles. Each angle must:
1. Be a specific, concrete content piece that would be genuinely useful to an owner/operator in this industry
2. Connect directly to a real operational challenge in their business (not generic "AI transformation" content)
3. Be non-promotional — no pitch, no CTA to buy. Pure value.
4. Be distinct from the other two angles in format and topic
5. Feel like something a trusted peer would share, not a vendor

# Hard rules
- NEVER use "LLM", "machine learning", "neural network", "digital transformation"
- NEVER suggest generic AI content — it must be specific to their industry and role
- The "hook" sentence must reference something specific about this lead's situation

Return ONLY a valid JSON array with exactly 3 objects. Each object must have:
- "angle": a 6-10 word title for the content piece
- "hook": one sentence explaining why this is relevant to THIS specific lead
- "format": one of "Blog post", "Case study", "Industry insight", "Checklist", "Short video"

Example for a food distribution company:
[
  {
    "angle": "How Regional Food Distributors Are Cutting Route Planning Time in Half",
    "hook": "Given their distribution operation, this directly addresses the routing and scheduling overhead that eats up hours every week.",
    "format": "Case study"
  }
]`;

    const completion = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      max_tokens: 600,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content || "{}";

    // Parse — the model returns either an array directly or wrapped in an object
    let angles: { angle: string; hook: string; format: string }[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        angles = parsed;
      } else {
        // Find the first array value in the object
        const arrayVal = Object.values(parsed).find((v) => Array.isArray(v));
        angles = (arrayVal as typeof angles) || [];
      }
    } catch {
      angles = [];
    }

    return NextResponse.json({ angles: angles.slice(0, 3) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
