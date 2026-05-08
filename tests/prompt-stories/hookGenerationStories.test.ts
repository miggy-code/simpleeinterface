import assert from "node:assert/strict";
import test from "node:test";
import { buildSystemPrompt, buildUserPrompt, getPromptVersion } from "../../lib/prompts";
import { assertHookMatchesStory } from "../support/hookEvaluation";
import { hookStories } from "../support/hookStories";

test("hook generation system prompt preserves the load-bearing contract", () => {
  const prompt = buildSystemPrompt();

  assert.match(prompt, /specific, verifiable signal/i);
  assert.match(prompt, /return null/i);
  assert.match(prompt, /confidence to Low/i);
  assert.match(prompt, /{{personalization_hook}}/);
  assert.match(prompt, /standalone/i);
  assert.match(prompt, /fragment/i);
  assert.match(getPromptVersion(), /^[0-9a-f]{8}$/);
});

for (const story of hookStories) {
  test(`story prompt renders: ${story.name}`, () => {
    const prompt = buildUserPrompt(story.lead, story.campaign);

    assert.match(prompt, new RegExp(story.campaign.campaignId));
    assert.match(prompt, /Campaign email where {{personalization_hook}} will be inserted/);
    assert.match(prompt, /Personalization Insights:/);

    if (story.expectation.placement === "standalone_sentence") {
      assert.match(prompt, /Hook slot placement: standalone sentence/);
      assert.match(prompt, /complete sentence/);
    } else {
      assert.match(prompt, /Hook slot placement: inline fragment/);
      assert.match(prompt, /fragment that fits grammatically/);
    }

    if (story.expectation.expectNull) {
      assert.match(prompt, /return null with confidence: Low/);
    }
  });

  test(`story acceptance criteria: ${story.name}`, () => {
    assertHookMatchesStory(story.passingExample, story.expectation);
  });
}
