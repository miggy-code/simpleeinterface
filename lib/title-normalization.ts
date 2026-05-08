import OpenAI from "openai";
import { ConfigError } from "./http/errors";
import { titleNormalizationSystemPrompt } from "../prompts/title-normalization/system";
import {
  buildTitleNormalizationUserPrompt,
  TitleNormalizationInput,
} from "../prompts/title-normalization/user";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

export interface TitleNormalizationResult {
  id: string;
  revisedTitle: string;
}

function getDeepseekClient() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new ConfigError("DEEPSEEK_API_KEY is not set");
  }
  return new OpenAI({
    apiKey,
    baseURL: DEEPSEEK_BASE_URL,
  });
}

function getDeepseekModel(): string {
  return process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
}

function cleanTitle(value: string, fallback: string): string {
  const trimmed = value.trim().replace(/^["']+|["']+$/g, "");
  const collapsed = trimmed.replace(/\s+/g, " ");
  return collapsed || fallback;
}

function parseTitleNormalizationResponse(
  raw: string,
  inputs: TitleNormalizationInput[]
): TitleNormalizationResult[] {
  const byId = new Map(inputs.map((input) => [input.id, input.title]));
  const parsed = JSON.parse(raw) as {
    items?: Array<{ id?: unknown; revisedTitle?: unknown }>;
  };
  const items = Array.isArray(parsed.items) ? parsed.items : [];

  return inputs.map((input) => {
    const match = items.find((item) => item.id === input.id);
    const revisedTitle =
      typeof match?.revisedTitle === "string"
        ? cleanTitle(match.revisedTitle, input.title)
        : input.title;
    return { id: input.id, revisedTitle };
  });
}

export async function reviseTitlesWithAI(
  inputs: TitleNormalizationInput[]
): Promise<TitleNormalizationResult[]> {
  if (inputs.length === 0) return [];

  const client = getDeepseekClient();
  const response = await client.chat.completions.create({
    model: getDeepseekModel(),
    messages: [
      { role: "system", content: titleNormalizationSystemPrompt },
      { role: "user", content: buildTitleNormalizationUserPrompt(inputs) },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content ?? '{"items":[]}';
  return parseTitleNormalizationResponse(raw, inputs);
}

export { parseTitleNormalizationResponse };
