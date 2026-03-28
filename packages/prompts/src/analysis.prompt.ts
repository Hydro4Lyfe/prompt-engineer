import type { SteeringInputs } from "@prompt-engineer/validators";

interface AnalysisPromptOptions {
  steeringInputs?: SteeringInputs;
  targetModel?: string;
}

function describeSteeringContext(inputs: SteeringInputs): string {
  const parts: string[] = [];

  if (inputs.taskType) {
    parts.push(`The user has categorized this as a ${inputs.taskType} task.`);
  }

  if (inputs.tone !== undefined && inputs.tone !== 50) {
    const toneDesc = inputs.tone < 30 ? "formal" : inputs.tone < 70 ? "balanced" : "casual";
    parts.push(`Preferred tone: ${toneDesc} (${inputs.tone}/100 on formal-to-casual scale).`);
  }

  if (inputs.detailLevel !== undefined && inputs.detailLevel !== 50) {
    const detailDesc = inputs.detailLevel < 30 ? "concise" : inputs.detailLevel < 70 ? "moderate" : "thorough";
    parts.push(`Preferred detail level: ${detailDesc} (${inputs.detailLevel}/100 on concise-to-thorough scale).`);
  }

  if (inputs.categoryDials) {
    const dialParts = Object.entries(inputs.categoryDials).map(
      ([key, value]) => `${key}: ${value}`
    );
    if (dialParts.length > 0) {
      parts.push(`Category-specific preferences: ${dialParts.join(", ")}.`);
    }
  }

  return parts.join(" ");
}

export function buildAnalysisPrompt(options?: AnalysisPromptOptions): string {
  let steeringSection = "";
  if (options?.steeringInputs) {
    const context = describeSteeringContext(options.steeringInputs);
    if (context) {
      steeringSection = `\n\nThe user has already provided these preferences:\n${context}\nDo NOT ask questions about topics the user has already specified above. Focus your questions on what is still missing.`;
    }
  }

  return `You are an expert prompt engineer analyzing a user's rough prompt to identify what information would most improve the final prompt's effectiveness.

Analyze the provided rough prompt and return a JSON object with these fields:

1. "intent": What the user is trying to accomplish (1 sentence)
2. "category": One of ["WRITING", "CODING", "RESEARCH", "BUSINESS", "CREATIVE", "EDUCATIONAL"]
3. "suggestedMode": "quick" if the task is straightforward, "detailed" if complex
4. "detectedElements": Array of strings — what's already specified
5. "missingElements": Array of strings — what's missing that would significantly improve results
6. "questions": Array of 5-7 question objects, each with:
   - "id": "q1", "q2", etc.
   - "question": Concise, specific clarification question
   - "why": One sentence explaining why this matters (shown to user)
   - "default": A reasonable default if user skips
   - "priority": 1-5 (1 = highest impact on output quality)
   - "type": "select" | "text" | "scale"
   - "options": (for select type only) array of 3-5 choices

Rules:
- Never ask what the user already told you
- Each question must unlock meaningfully better output
- Defaults must be sensible so skipping still improves the prompt
- Prefer "select" over "text" when possible — faster for the user
- Priority 1 = without this answer, the output will likely be wrong or useless
- Priority 2 = without this answer, the output will be generic
- Priority 3+ = refinement, nice to have${steeringSection}

Return ONLY valid JSON. No markdown, no explanation.`;
}
