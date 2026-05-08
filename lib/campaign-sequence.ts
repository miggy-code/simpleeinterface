import type { InstantlyCampaignSequence } from "./instantly";

export interface CampaignEditorStep {
  subject: string;
  body: string;
  delayDays?: number;
}

export function buildInstantlySequenceFromEditorSteps(
  steps: CampaignEditorStep[]
): InstantlyCampaignSequence[] {
  return [
    {
      steps: steps.map((step, index) => ({
        type: "email",
        delay: index === 0 ? 0 : Math.max(0, Number(step.delayDays) || 0),
        variants: [
          {
            subject: step.subject,
            body: step.body,
          },
        ],
      })),
    },
  ];
}

export const THROTTL_STARTER_SEQUENCE_DELAYS = [0, 3, 5];
