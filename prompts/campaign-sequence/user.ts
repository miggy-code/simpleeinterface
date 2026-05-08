export interface CampaignSequenceInput {
  targetRole: string;
  targetIndustry?: string;
  painPoints: string;
  offering: string;
  cta: string;
}

/**
 * Builds the user prompt for generating a campaign email sequence.
 */
export function buildCampaignSequenceUserPrompt(input: CampaignSequenceInput): string {
  const { targetRole, targetIndustry, painPoints, offering, cta } = input;
  const industryText = targetIndustry ? ` in ${targetIndustry}` : "";

  return [
    `Target audience: ${targetRole}s${industryText}`,
    `Pain points: ${painPoints}`,
    `Our offering: ${offering}`,
    `CTA: ${cta}`,
  ].join("\n");
}
