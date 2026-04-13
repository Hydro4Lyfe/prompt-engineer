import type { PriorsCorpus } from "./priors";

export interface BuildCritiquePromptArgs {
  prompt: string;
  taskContext: string;
  priors: PriorsCorpus;
}

export interface CritiquePrompt {
  systemPrompt: string;
  userMessage: string;
}

const CATEGORY_LIST = [
  "CODING",
  "WRITING",
  "RESEARCH",
  "BUSINESS",
  "CREATIVE",
  "EDUCATIONAL",
] as const;

function renderPriors(priors: PriorsCorpus): string {
  return CATEGORY_LIST.map((cat) => {
    const p = priors[cat];
    const failures = p.failureModes.map((f) => `    - ${f}`).join("\n");
    const examples = p.examples
      .map(
        (ex, i) =>
          `    Example ${i + 1}:\n      BEFORE: ${ex.before}\n      AFTER: ${ex.after}\n      WHY: ${ex.why}`
      )
      .join("\n");
    return `## ${cat}\n  Description: ${p.description}\n  Common failure modes:\n${failures}\n  Worked examples:\n${examples}`;
  }).join("\n\n");
}

export function buildCritiquePrompt(args: BuildCritiquePromptArgs): CritiquePrompt {
  const systemPrompt = `You are a prompt-engineering critique engine. You classify a user's prompt into one of six categories, then select the three highest-impact fixes from that category's known failure modes, and return a complete rewritten prompt for each fix.

The categories and their priors:

${renderPriors(args.priors)}

Your task:
1. Read the user's prompt and the task context.
2. Classify the prompt into exactly one of: CODING, WRITING, RESEARCH, BUSINESS, CREATIVE, EDUCATIONAL.
3. From that category's failure modes, select the 3 highest-impact fixes for this specific prompt. Rank them by how much they would improve the actual model output on the user's task.
4. For each fix, return a complete drop-in rewritten prompt the user can use verbatim. Not a diff. Not instructions. A full replacement string.

Rules:
- Each suggestion's title must be under 120 characters and name the fix concretely (e.g., "Add explicit output format: JSON with named fields").
- Each rationale must be 1-3 sentences explaining why this fix matters for THIS specific prompt on THIS task.
- Each patchedPrompt must be a complete rewrite, not a note or instruction.
- Return ONLY valid JSON matching the schema below. No prose before or after. No markdown fences.

Response JSON schema:
{
  "category": "CODING" | "WRITING" | "RESEARCH" | "BUSINESS" | "CREATIVE" | "EDUCATIONAL",
  "suggestions": [
    { "title": string, "rationale": string, "patchedPrompt": string },
    { "title": string, "rationale": string, "patchedPrompt": string },
    { "title": string, "rationale": string, "patchedPrompt": string }
  ]
}`;

  const userMessage = `PROMPT TO CRITIQUE:
${args.prompt}

TASK CONTEXT (what the user actually wants the prompt to accomplish):
${args.taskContext}`;

  return { systemPrompt, userMessage };
}
