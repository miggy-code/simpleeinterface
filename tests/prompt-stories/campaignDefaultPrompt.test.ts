import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCampaignDefaultHookUserPrompt,
} from "../../prompts/campaign-default/user";
import { campaignDefaultHookSystemPrompt } from "../../prompts/campaign-default/system";

test("campaign default hook prompt stays generic and reusable", () => {
  assert.match(campaignDefaultHookSystemPrompt, /generic default hooks/i);
  assert.match(campaignDefaultHookSystemPrompt, /not mention specific companies/i);
  assert.match(campaignDefaultHookSystemPrompt, /defaultHook/i);
  assert.match(campaignDefaultHookSystemPrompt, /non-empty/i);
});

test("campaign default hook user prompt includes campaign context", () => {
  const prompt = buildCampaignDefaultHookUserPrompt({
    campaignName: "Ops Chat",
    targetRole: "CEO",
    targetIndustry: "Manufacturing",
    painPoints: "workflow inefficiency",
    offering: "Ops automation",
    cta: "Book a call",
    firstEmailSubject: "Quick thought",
    firstEmailBody: "Hi {{first_name}}, {{personalization_hook}}",
    sequenceEmails: [
      {
        subject: "Quick thought",
        body: "Hi {{first_name}}, {{personalization_hook}}",
      },
      {
        subject: "Second touch",
        body: "Following up on the workflow idea.",
      },
    ],
  });

  assert.match(prompt, /Campaign: Ops Chat/);
  assert.match(prompt, /Target role: CEO/);
  assert.match(prompt, /Target industry: Manufacturing/);
  assert.match(prompt, /Pain points: workflow inefficiency/);
  assert.match(prompt, /Offering: Ops automation/);
  assert.match(prompt, /CTA: Book a call/);
  assert.match(prompt, /First email template:/);
  assert.match(prompt, /Subject: Quick thought/);
  assert.match(prompt, /Hi \{\{first_name\}\}, \{\{personalization_hook\}\}/);
  assert.match(prompt, /Current sequence context:/);
  assert.match(prompt, /Email 2:/);
  assert.match(prompt, /Following up on the workflow idea\./);
  assert.match(prompt, /Hook slot placement: inline fragment/);
  assert.match(prompt, /fragment that fits grammatically/);
});

test("campaign default hook user prompt detects standalone placement", () => {
  const prompt = buildCampaignDefaultHookUserPrompt({
    campaignName: "Ops Chat",
    targetRole: "CEO",
    targetIndustry: "Manufacturing",
    painPoints: "workflow inefficiency",
    offering: "Ops automation",
    cta: "Book a call",
    firstEmailSubject: "Quick thought",
    firstEmailBody: "Hi {{first_name}},\n\n{{personalization_hook}}\n\nWorth a chat?",
  });

  assert.match(prompt, /Hook slot placement: standalone sentence/);
  assert.match(prompt, /complete sentence/);
});
