/**
 * Compatibility facade for AI prompt builders.
 *
 * Prompt content lives in `prompts/` so it can be reviewed and changed without
 * digging through integration code. Keep imports against this module stable.
 */

import { CampaignHookContext, Lead } from "./schema";
import { hookGenerationSystemPrompt } from "../prompts/hook-generation/system";
import { buildHookGenerationUserPrompt } from "../prompts/hook-generation/user";
import { campaignDefaultHookSystemPrompt } from "../prompts/campaign-default/system";
import { buildCampaignDefaultHookUserPrompt } from "../prompts/campaign-default/user";
import { campaignSequenceSystemPrompt } from "../prompts/campaign-sequence/system";
import {
  buildCampaignSequenceUserPrompt as buildCampaignSequenceUserPromptInternal,
  CampaignSequenceInput,
} from "../prompts/campaign-sequence/user";

export function buildSystemPrompt(): string {
  return hookGenerationSystemPrompt;
}

export function buildUserPrompt(
  lead: Lead,
  campaignContext: CampaignHookContext
): string {
  return buildHookGenerationUserPrompt(lead, campaignContext);
}

export function buildCampaignSequenceSystemPrompt(): string {
  return campaignSequenceSystemPrompt;
}

export function buildCampaignSequenceUserPrompt(
  input: CampaignSequenceInput
): string {
  return buildCampaignSequenceUserPromptInternal(input);
}

export { campaignDefaultHookSystemPrompt, buildCampaignDefaultHookUserPrompt };

/**
 * Stable hash of the system prompt for cache keys and version tracking.
 */
export function getPromptVersion(): string {
  const text = buildSystemPrompt();
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
