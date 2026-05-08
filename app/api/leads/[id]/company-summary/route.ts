/**
 * GET /api/leads/:id/company-summary
 *
 * Fetches and summarizes the company website for a given lead.
 * Scrapes the homepage text and uses DeepSeek to produce a 2-3 sentence
 * summary of what the company does, who they serve, and their apparent size.
 *
 * Returns: { summary, domain, cached }
 */
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getLead } from "@/lib/airtable";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function scrapeHomepage(domain: string): Promise<string> {
  // Normalize domain to a URL
  const url = domain.startsWith("http") ? domain : `https://${domain}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();

    // Strip HTML tags and collapse whitespace to get readable text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000); // Cap at 3000 chars — enough for a summary

    return text;
  } catch {
    return "";
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Lazy-init to prevent build-time failures
  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com/v1",
  });

  try {
    const lead = await getLead(params.id);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const domain = lead.companyDomain;
    if (!domain) {
      return NextResponse.json(
        { summary: null, domain: null, reason: "No company domain on file" },
        { status: 200 }
      );
    }

    const pageText = await scrapeHomepage(domain);

    if (!pageText) {
      return NextResponse.json({
        summary: `Could not fetch ${domain} — the site may block automated requests.`,
        domain,
        cached: false,
      });
    }

    const completion = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            "You are a concise business analyst. Summarize company websites in 2-3 sentences covering: what the company does, who their customers are, and any notable size/positioning signals. Be factual and direct. No fluff.",
        },
        {
          role: "user",
          content: `Company domain: ${domain}\n\nWebsite text:\n${pageText}\n\nWrite a 2-3 sentence summary of this company.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 150,
    });

    const summary =
      completion.choices[0]?.message?.content?.trim() ||
      "Could not generate summary.";

    return NextResponse.json({ summary, domain, cached: false });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
