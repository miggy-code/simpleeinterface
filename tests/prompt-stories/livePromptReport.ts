import { loadEnvConfig } from "@next/env";
import { buildUserPrompt } from "../../lib/prompts";
import { hookStories } from "../support/hookStories";

loadEnvConfig(process.cwd());

function renderTemplate(
  template: string,
  replacements: Record<string, string>
): string {
  return template.replace(/{{\s*([^}]+?)\s*}}/g, (_, key: string) => {
    return replacements[key] ?? `{{${key}}}`;
  });
}

function renderEmail(storyIndex: number, hook: string): string {
  const story = hookStories[storyIndex];
  const firstStep = story.campaign.steps[0];
  const replacements = {
    first_name: story.lead.firstName ?? "there",
    company_name: story.lead.companyName ?? "your company",
    personalization_hook: hook,
  };
  const subject = firstStep
    ? renderTemplate(firstStep.subject, replacements)
    : "(no subject)";
  const body = firstStep ? renderTemplate(firstStep.body, replacements) : "";

  return [
    `Subject: ${subject}`,
    "Body:",
    body,
  ].join("\n");
}

function renderInsights(insights: string | undefined): string {
  const lines = (insights ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return "  - (none)";
  return lines.map((line) => `  - ${line.replace(/^-+\s*/, "")}`).join("\n");
}

function renderTemplateBlock(
  label: string,
  text: string | undefined
): string {
  return [label, "```", text ?? "(missing)", "```"].join("\n");
}

async function renderStory(index: number): Promise<string> {
  const story = hookStories[index];
  const { generateHook } = await import("../../lib/ai");
  const llmResult = await generateHook(story.lead, story.campaign);
  const hook = llmResult.hook ?? story.campaign.defaultHook ?? "[no hook]";
  const renderedEmail = renderEmail(index, hook);
  const firstStep = story.campaign.steps[0];
  const prompt = buildUserPrompt(story.lead, story.campaign);

  return [
    `# ${story.name}`,
    `Campaign: ${story.campaign.campaignName ?? story.campaign.campaignId}`,
    `Lead: ${[story.lead.firstName, story.lead.companyName].filter(Boolean).join(" ")}`,
    "",
    "Insights:",
    renderInsights(story.lead.personalizationInsights),
    "",
    renderTemplateBlock(
      "Campaign template:",
      firstStep
        ? `${firstStep.subject}\n\n${firstStep.body}`
        : "(no campaign email step found)"
    ),
    "",
    `Model hook: ${llmResult.hook ?? "null"}`,
    `Model confidence: ${llmResult.confidence}`,
    `Model reasoning: ${llmResult.reasoning ?? "(none)"}`,
    "",
    "Rendered email with hook inserted:",
    "```",
    renderedEmail,
    "```",
    "",
    `Fallback used: ${llmResult.hook ? "no" : "yes"}`,
    "",
    ...(process.env.VERBOSE_PROMPT === "1"
      ? [
          "",
          "Prompt excerpt:",
          "```",
          prompt,
          "```",
        ]
      : []),
  ].join("\n");
}

async function main(): Promise<void> {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY is required for the live prompt report");
  }

  const sections: string[] = [];
  for (let i = 0; i < hookStories.length; i++) {
    sections.push(await renderStory(i));
  }
  console.log(sections.join("\n\n---\n\n"));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
