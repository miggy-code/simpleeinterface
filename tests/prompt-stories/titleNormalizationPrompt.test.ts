import assert from "node:assert/strict";
import test from "node:test";
import { titleNormalizationSystemPrompt } from "../../prompts/title-normalization/system";
import { buildTitleNormalizationUserPrompt } from "../../prompts/title-normalization/user";

test("title normalization system prompt keeps the precedence rules explicit", () => {
  assert.match(titleNormalizationSystemPrompt, /Chief Executive Officer -> CEO/);
  assert.match(titleNormalizationSystemPrompt, /Founder\/Owner -> Founder/);
  assert.match(titleNormalizationSystemPrompt, /CEO > Founder > Owner > President/);
  assert.match(titleNormalizationSystemPrompt, /keep only the single most important title/i);
  assert.match(titleNormalizationSystemPrompt, /Return only the revised title text/i);
});

test("title normalization user prompt requires exact id keyed JSON output", () => {
  const prompt = buildTitleNormalizationUserPrompt([
    { id: "rec-1", title: "Chief Executive Officer" },
    { id: "rec-2", title: "Founder/Owner" },
  ]);

  assert.match(prompt, /Return ONLY valid JSON/);
  assert.match(prompt, /"items"/);
  assert.match(prompt, /"revisedTitle"/);
  assert.match(prompt, /id: rec-1/);
  assert.match(prompt, /title: Chief Executive Officer/);
  assert.match(prompt, /Include every input id exactly once/);
});
