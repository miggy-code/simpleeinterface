import { detectHookPlacement } from "../hook-generation/user";

export function buildCampaignDefaultHookUserPrompt(input: {
  campaignName?: string;
  targetRole: string;
  targetIndustry?: string;
  painPoints: string;
  offering: string;
  cta: string;
  firstEmailSubject?: string;
  firstEmailBody?: string;
  sequenceEmails?: Array<{ subject?: string; body?: string }>;
}): string {
  const industry = input.targetIndustry?.trim() || "various industries";
  const firstEmailBody = input.firstEmailBody ?? "(missing)";
  const hookPlacement = detectHookPlacement(firstEmailBody);
  const sequenceEmails =
    input.sequenceEmails?.filter(
      (email) => email && (email.subject?.trim() || email.body?.trim())
    ) ?? [];
  const sequenceContext =
    sequenceEmails.length > 0
      ? sequenceEmails
          .map((email, index) => {
            const subject = email.subject?.trim() || "(no subject)";
            const body = email.body?.trim() || "(no body)";
            return `Email ${index + 1}:\nSubject: ${subject}\nBody:\n${body}`;
          })
          .join("\n\n")
      : "(not provided)";
  return [
    `Campaign: ${input.campaignName ?? "(unnamed)"}`,
    `Target role: ${input.targetRole}`,
    `Target industry: ${industry}`,
    `Pain points: ${input.painPoints}`,
    `Offering: ${input.offering}`,
    `CTA: ${input.cta}`,
    "",
    "First email template:",
    `Subject: ${input.firstEmailSubject ?? "(missing)"}`,
    "Body:",
    firstEmailBody,
    "",
    "Current sequence context:",
    sequenceContext,
    "",
    `Hook slot placement: ${
      hookPlacement === "standalone_sentence"
        ? "standalone sentence"
        : "inline fragment"
    }`,
    hookPlacement === "standalone_sentence"
      ? "The default hook must be a complete sentence that reads correctly on its own."
      : "The default hook must be a fragment that fits grammatically inside the surrounding sentence.",
    "",
    "Write a generic default hook for this campaign.",
  ].join("\n");
}
