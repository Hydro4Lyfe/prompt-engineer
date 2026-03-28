const MODEL_GUIDANCE: Record<string, string> = {
  claude: `Format the prompt for Claude (Anthropic). Use XML tags like <context>, <instructions>, <constraints> for structure. Leverage system prompt conventions. Claude responds well to clear role definitions and explicit output format specifications.`,
  "gpt-4": `Format the prompt for GPT-4 (OpenAI). Use markdown formatting with headers and bullet points. Place the most important instructions first. Use explicit instruction hierarchy. GPT-4 responds well to numbered steps and "You MUST" directives.`,
  gemini: `Format the prompt for Gemini (Google). Use clear section headers and explicit output format specifications. Gemini works well with structured instructions and concrete examples.`,
  llama: `Format the prompt for Llama (Meta). Keep instructions direct and explicit. Use simple, clear formatting. Avoid relying on nuanced formatting — be straightforward. Shorter, focused prompts tend to work better.`,
  mistral: `Format the prompt for Mistral. Keep instructions direct and explicit. Use clear structure with simple formatting. Be specific about constraints and output format.`,
  other: `Format the prompt using generic best practices. Use clear structure with headers or separators. Include explicit constraints, output format, and examples where helpful.`,
};

export function buildSynthesisPrompt(targetModel?: string): string {
  const modelKey = targetModel ?? "other";
  const modelGuidance = MODEL_GUIDANCE[modelKey] ?? MODEL_GUIDANCE["other"];

  return `You are an expert prompt engineer. Given a user's original rough prompt and their answers to clarification questions, generate an optimized final prompt.

${modelGuidance}

Structure the final prompt to include (as applicable):
1. Role/persona framing
2. Clear task statement
3. Context and background
4. Specific requirements and constraints
5. Output format specification
6. Tone/style guidance

Also return a "changelog" array of 3-5 strings, each describing a specific improvement you made and why it matters.

Rules:
- The final prompt must be self-contained — usable without this conversation
- Don't pad with unnecessary instructions
- Match prompt complexity to task complexity — simple tasks get simple prompts
- Use the user's terminology
- For skipped questions, apply defaults subtly — don't over-specify
- The prompt should feel like a human expert wrote it, not a template

Return JSON with three fields:
- "finalPrompt": string (the complete optimized prompt)
- "changelog": string[] (3-5 improvement descriptions)
- "tips": string[] (3-5 specific, actionable suggestions for further improving this prompt — things the user could add or adjust to get even better results)

Return ONLY valid JSON. No markdown, no explanation.`;
}
