import { z, PromptCategory } from "@prompt-engineer/validators";

export const Suggestion = z.object({
  title: z.string().min(1).max(120),
  rationale: z.string().min(1).max(400),
  patchedPrompt: z.string().min(1),
});
export type Suggestion = z.infer<typeof Suggestion>;

export const CritiqueModelResponse = z.object({
  category: z.string(),
  suggestions: z.array(Suggestion).min(1).max(5),
});
export type CritiqueModelResponse = z.infer<typeof CritiqueModelResponse>;

export type CritiqueFailureReason =
  | "parse_error"
  | "schema_violation"
  | "empty_suggestions"
  | "rate_limited"
  | "timeout"
  | "unauthorized"
  | "unknown";

export type CritiqueResult =
  | {
      ok: true;
      category: PromptCategory;
      suggestions: Suggestion[];
    }
  | {
      ok: false;
      reason: CritiqueFailureReason;
      rawResponse?: string;
    };

export interface RunSideResult {
  ok: boolean;
  output?: string;
  truncated?: boolean;
  reason?: CritiqueFailureReason;
}

export interface RunBothResult {
  original: RunSideResult;
  patched: RunSideResult;
}
