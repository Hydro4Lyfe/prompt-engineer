const MODEL_GUIDANCE: Record<string, string> = {
  claude: `The prompt is formatted for Claude (Anthropic) using XML tags. Maintain this formatting style.`,
  "gpt-4": `The prompt is formatted for GPT-4 (OpenAI) using markdown. Maintain this formatting style.`,
  gemini: `The prompt is formatted for Gemini (Google). Maintain its structure and formatting.`,
  llama: `The prompt is formatted for Llama (Meta). Keep it direct and explicit.`,
  mistral: `The prompt is formatted for Mistral. Maintain its direct structure.`,
  other: `Maintain the prompt's existing formatting and structure.`,
};

export function buildRefinementPrompt(targetModel?: string): string {
  const modelKey = targetModel ?? "other";
  const modelGuidance = MODEL_GUIDANCE[modelKey] ?? MODEL_GUIDANCE["other"];

  return `You are an expert prompt engineer. You are refining an existing optimized prompt based on a user's instruction.

${modelGuidance}

Given the current prompt and the user's refinement instruction, produce an updated version of the prompt.

Rules:
- Apply the refinement precisely — don't change unrelated parts
- Maintain the overall structure and quality of the prompt
- If the instruction is vague, interpret it reasonably
- Keep the prompt self-contained

Return JSON with two fields:
- "finalPrompt": string (the updated prompt)
- "description": string (1 sentence describing what you changed)

Return ONLY valid JSON. No markdown, no explanation.`;
}
