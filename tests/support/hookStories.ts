import { CampaignHookContext, HookGenerationResult, Lead } from "../../lib/schema";
import { HookStoryExpectation } from "./hookEvaluation";

export interface HookStory {
  name: string;
  lead: Lead;
  campaign: CampaignHookContext;
  expectation: HookStoryExpectation;
  passingExample: HookGenerationResult;
}

export const hookStories: HookStory[] = [
  {
    name: "standalone slot needs a complete sentence using a facility expansion signal",
    lead: {
      id: "rec-story-standalone",
      companyName: "Bay State Fabrication",
      firstName: "Alex",
      title: "President",
      industry: "Manufacturing",
      city: "Worcester",
      state: "MA",
      personalizationInsights:
        "- Announced a 20,000 sq ft Worcester facility expansion in March 2026.\n- Added a second laser cutting line after the expansion.",
    },
    campaign: {
      campaignId: "cmp-standalone",
      campaignName: "Ops AI Chat",
      defaultHook: "I noticed your team is focused on operational throughput.",
      steps: [
        {
          stepNumber: 1,
          subject: "quick thought for {{company_name}}",
          body: "Hi {{first_name}},\n\n{{personalization_hook}}\n\nWorth a quick chat?",
        },
      ],
    },
    expectation: {
      placement: "standalone_sentence",
      requiredTerms: ["Worcester", "facility expansion"],
      forbiddenTerms: ["growing company"],
    },
    passingExample: {
      hook: "I saw Bay State Fabrication announced its Worcester facility expansion in March.",
      confidence: "High",
      reasoning: "The expansion is a specific, verifiable operations signal.",
    },
  },
  {
    name: "inline slot needs a fragment that fits inside the surrounding sentence",
    lead: {
      id: "rec-story-inline",
      companyName: "Northline Cold Storage",
      firstName: "Jordan",
      title: "COO",
      industry: "Logistics",
      personalizationInsights:
        "- Earned SQF certification for its Nashua cold-storage site in April 2026.\n- Hiring two warehouse supervisors for second-shift coverage.",
    },
    campaign: {
      campaignId: "cmp-inline",
      campaignName: "Warehouse Workflow",
      steps: [
        {
          stepNumber: 1,
          subject: "Nashua ops",
          body: "Hi {{first_name}}, I {{personalization_hook}} and had a practical idea for {{company_name}}.",
        },
      ],
    },
    expectation: {
      placement: "inline_fragment",
      requiredTerms: ["SQF", "Nashua"],
      forbiddenTerms: ["I saw"],
    },
    passingExample: {
      hook: "noticed Northline earned SQF certification for its Nashua cold-storage site",
      confidence: "High",
      reasoning: "The certification is concrete and fits the inline slot.",
    },
  },
  {
    name: "no specific signal should force null and Low confidence",
    lead: {
      id: "rec-story-null",
      companyName: "Acme Distribution",
      firstName: "Sam",
      title: "CEO",
      industry: "Distribution",
      city: "Austin",
      state: "TX",
      personalizationInsights: "",
    },
    campaign: {
      campaignId: "cmp-null",
      campaignName: "Generic First",
      defaultHook: "I noticed your team is focused on improving day-to-day operations.",
      steps: [
        {
          stepNumber: 1,
          subject: "operations",
          body: "Hi {{first_name}},\n\n{{personalization_hook}}\n\nOpen to compare notes?",
        },
      ],
    },
    expectation: {
      placement: "standalone_sentence",
      expectNull: true,
    },
    passingExample: {
      hook: null,
      confidence: "Low",
      reasoning: "No specific signal was provided.",
    },
  },
];
