import { CampaignHookContext, Lead } from "../../lib/schema";

export type HookPlacement = "standalone_sentence" | "inline_fragment";

export function detectHookPlacement(body: string): HookPlacement {
  const paragraphs = body.replace(/\r\n/g, "\n").split(/\n\s*\n/);

  for (const paragraph of paragraphs) {
    if (!paragraph.includes("{{personalization_hook}}")) continue;

    const trimmed = paragraph.trim();
    const withoutTag = trimmed.replace("{{personalization_hook}}", "").trim();

    if (!withoutTag || /^[,.;:!?—–-]+$/.test(withoutTag)) {
      return "standalone_sentence";
    }

    return "inline_fragment";
  }

  return "standalone_sentence";
}

/**
 * User prompt for a specific lead and campaign.
 *
 * The canonical signal source is `lead.personalizationInsights`, populated by
 * the upstream sourcing workflow as specific, verifiable factoids.
 */
export function buildHookGenerationUserPrompt(
  lead: Lead,
  campaignContext: CampaignHookContext
): string {
  const parts: string[] = [];

  const firstStep = campaignContext.steps[0];
  const hookPlacement: HookPlacement = firstStep
    ? detectHookPlacement(firstStep.body)
    : "standalone_sentence";
  parts.push(`Campaign: ${campaignContext.campaignName ?? campaignContext.campaignId}`);
  parts.push(`Campaign ID: ${campaignContext.campaignId}`);
  parts.push("");
  parts.push("Campaign email where {{personalization_hook}} will be inserted:");
  if (firstStep) {
    parts.push(`Subject: ${firstStep.subject || "(no subject)"}`);
    parts.push("Body:");
    parts.push(firstStep.body || "(empty body)");
  } else {
    parts.push("(No email steps found. Return null with confidence: Low.)");
  }
  parts.push("");
  parts.push(
    `Hook slot placement: ${
      hookPlacement === "standalone_sentence"
        ? "standalone sentence"
        : "inline fragment"
    }`
  );
  if (hookPlacement === "standalone_sentence") {
    parts.push(
      "The replacement must be a complete sentence that reads correctly on its own. Start with a clear subject and end with punctuation."
    );
  } else {
    parts.push(
      "The replacement must be a fragment that fits grammatically inside the surrounding sentence."
    );
  }
  if (campaignContext.defaultHook) {
    parts.push("");
    parts.push(`Campaign default hook: ${campaignContext.defaultHook}`);
  }
  parts.push("");
  parts.push(`Company: ${lead.companyName ?? "Unknown"}`);
  if (lead.title) parts.push(`Title: ${lead.title}`);
  if (lead.industry) parts.push(`Industry: ${lead.industry}`);
  const location = [lead.city, lead.state].filter(Boolean).join(", ");
  if (location) parts.push(`Location: ${location}`);

  parts.push("");

  const insights = lead.personalizationInsights?.trim();
  if (insights) {
    parts.push("Personalization Insights:");
    parts.push(insights);
  } else {
    parts.push("Personalization Insights: none");
    parts.push(
      "(Per rule 3, return null with confidence: Low when no specific signal exists.)"
    );
  }

  parts.push("");
  parts.push(
    "Write only the replacement for {{personalization_hook}}, following the rules in the system prompt."
  );

  return parts.join("\n");
}
