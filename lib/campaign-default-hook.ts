import OpenAI from "openai";
import {
  buildCampaignDefaultHookUserPrompt,
  campaignDefaultHookSystemPrompt,
} from "./prompts";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";

let deepseekClient: OpenAI | null = null;

function getDeepseekClient(): OpenAI {
  if (deepseekClient) return deepseekClient;
  deepseekClient = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY ?? "missing",
    baseURL: DEEPSEEK_BASE_URL,
  });
  return deepseekClient;
}

export interface CampaignDefaultHookInput {
  campaignName?: string;
  targetRole: string;
  targetIndustry?: string;
  painPoints: string;
  offering: string;
  cta: string;
  firstEmailSubject: string;
  firstEmailBody: string;
  sequenceEmails?: Array<{ subject?: string; body?: string }>;
}

export async function generateCampaignDefaultHook(
  input: CampaignDefaultHookInput
): Promise<{ defaultHook: string; tokens: string }> {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY is not set on the server.");
  }

  const deepseek = getDeepseekClient();
  const userPrompt = buildCampaignDefaultHookUserPrompt(input);
  let defaultHook = "";
  let tokens = "?";

  for (let attempt = 1; attempt <= 2; attempt++) {
    const hookRes = await deepseek.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: campaignDefaultHookSystemPrompt },
        {
          role: "user",
          content:
            attempt === 1
              ? userPrompt
              : [
                  userPrompt,
                  "",
                  "The previous answer was empty or malformed.",
                  "Return a non-empty JSON object with exactly one key: defaultHook.",
                  "The hook must fit the actual first email opening shown above.",
                ].join("\n"),
        },
      ],
      temperature: attempt === 1 ? 0.2 : 0.1,
      max_tokens: 80,
      response_format: { type: "json_object" },
    });

    tokens = String(hookRes.usage?.total_tokens ?? "?");
    const parsed = JSON.parse(hookRes.choices[0]?.message?.content ?? "{}") as {
      defaultHook?: unknown;
    };
    defaultHook =
      typeof parsed.defaultHook === "string" ? parsed.defaultHook.trim() : "";
    if (defaultHook) break;
  }

  if (!defaultHook) {
    throw new Error("DeepSeek returned an empty default hook");
  }

  return { defaultHook, tokens };
}
