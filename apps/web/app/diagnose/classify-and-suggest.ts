import type { ModelProvider } from "@prompt-engineer/ai";
import { PromptCategory } from "@prompt-engineer/validators";
import { buildCritiquePrompt } from "./critique-prompt";
import { CritiqueModelResponse, type CritiqueResult } from "./critique.schema";
import { PRIORS } from "./priors";

export interface ClassifyAndSuggestArgs {
  prompt: string;
  taskContext: string;
  provider: ModelProvider;
  signal?: AbortSignal;
}

function extractJson(raw: string): unknown | null {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Try to pull JSON out of fenced blocks or surrounding prose
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1].trim());
      } catch {
        // fall through
      }
    }
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function mapErrorToReason(error: unknown): CritiqueResult & { ok: false } {
  const err = error as { name?: string; status?: number; statusCode?: number };
  if (err?.name === "AbortError") {
    return { ok: false, reason: "timeout" };
  }
  const status = err?.status ?? err?.statusCode;
  if (status === 429) {
    return { ok: false, reason: "rate_limited" };
  }
  return { ok: false, reason: "unknown" };
}

export async function classifyAndSuggest(
  args: ClassifyAndSuggestArgs
): Promise<CritiqueResult> {
  const { prompt, taskContext, provider, signal } = args;
  const built = buildCritiquePrompt({ prompt, taskContext, priors: PRIORS });

  let raw: string;
  try {
    const response = await provider.generate({
      systemPrompt: built.systemPrompt,
      userMessage: built.userMessage,
      maxTokens: 2048,
      temperature: 0.3,
      responseFormat: "json",
      signal,
      maxRetries: 0,
    });
    raw = response.content;
  } catch (error) {
    return mapErrorToReason(error);
  }

  const parsed = extractJson(raw);
  if (parsed === null) {
    console.warn("[diagnose] parse_error", raw.slice(0, 500));
    return { ok: false, reason: "parse_error", rawResponse: raw.slice(0, 2000) };
  }

  const validated = CritiqueModelResponse.safeParse(parsed);
  if (!validated.success) {
    console.warn("[diagnose] schema_violation", validated.error.issues, raw.slice(0, 500));
    return { ok: false, reason: "schema_violation", rawResponse: raw.slice(0, 2000) };
  }

  if (validated.data.suggestions.length === 0) {
    return { ok: false, reason: "empty_suggestions", rawResponse: raw.slice(0, 2000) };
  }

  // Decision 2C: category fallback to CODING if invalid.
  const categoryCheck = PromptCategory.safeParse(validated.data.category);
  const category: PromptCategory = categoryCheck.success ? categoryCheck.data : "CODING";
  if (!categoryCheck.success) {
    console.warn("[diagnose] category_fallback", validated.data.category);
  }

  return {
    ok: true,
    category,
    suggestions: validated.data.suggestions.slice(0, 3),
  };
}
