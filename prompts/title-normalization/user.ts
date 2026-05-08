export interface TitleNormalizationInput {
  id: string;
  title: string;
}

export function buildTitleNormalizationUserPrompt(
  inputs: TitleNormalizationInput[]
): string {
  return `Revise every title below.

Return ONLY valid JSON in this exact shape:
{
  "items": [
    { "id": "lead-id", "revisedTitle": "clean title" }
  ]
}

Rules:
- Include every input id exactly once.
- revisedTitle must be a plain string.
- Do not omit unchanged titles; repeat the cleaned title.
- Do not add any keys besides id and revisedTitle.

Inputs:
${inputs.map((item) => `- id: ${item.id}\n  title: ${item.title}`).join("\n")}`;
}
