import assert from "node:assert/strict";
import { HookGenerationResult } from "../../lib/schema";
import { HookPlacement } from "../../prompts/hook-generation/user";

const GENERIC_PATTERNS = [
  /\bgrowing company\b/i,
  /\bbased in\b/i,
  /\byour role\b/i,
  /\byour company\b/i,
  /\bwanted to reach out\b/i,
  /\bhope this finds\b/i,
];

export interface HookStoryExpectation {
  placement: HookPlacement;
  requiredTerms?: string[];
  forbiddenTerms?: string[];
  expectNull?: boolean;
  maxWords?: number;
}

export function assertHookMatchesStory(
  result: HookGenerationResult,
  expectation: HookStoryExpectation
): void {
  if (expectation.expectNull) {
    assert.equal(result.hook, null);
    assert.equal(result.confidence, "Low");
    return;
  }

  assert.ok(result.hook, "expected a hook");
  const hook = result.hook.trim();
  const maxWords = expectation.maxWords ?? 25;
  assert.ok(
    hook.split(/\s+/).length <= maxWords,
    `expected hook to be ${maxWords} words or fewer: ${hook}`
  );

  for (const pattern of GENERIC_PATTERNS) {
    assert.equal(pattern.test(hook), false, `generic hook pattern: ${pattern}`);
  }

  for (const term of expectation.requiredTerms ?? []) {
    assert.match(hook, new RegExp(escapeRegExp(term), "i"));
  }

  for (const term of expectation.forbiddenTerms ?? []) {
    assert.doesNotMatch(hook, new RegExp(escapeRegExp(term), "i"));
  }

  if (expectation.placement === "standalone_sentence") {
    assert.match(hook, /^[A-Z]/, "standalone hook should start as a sentence");
    assert.match(hook, /[.!?]$/, "standalone hook should end with punctuation");
  } else {
    assert.doesNotMatch(hook, /[.!?]$/, "inline hook should be a fragment");
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
