import type { ModelProvider } from "@prompt-engineer/ai";
import type { CritiqueFailureReason, RunBothResult, RunSideResult } from "./critique.schema";

export interface RunBothArgs {
  originalPrompt: string;
  patchedPrompt: string;
  taskContext: string;
  provider: ModelProvider;
  signal?: AbortSignal;
}

function mapErrorToReason(error: unknown): CritiqueFailureReason {
  const err = error as { name?: string; status?: number; statusCode?: number };
  if (err?.name === "AbortError") return "timeout";
  const status = err?.status ?? err?.statusCode;
  if (status === 429) return "rate_limited";
  return "unknown";
}

async function runOne(
  provider: ModelProvider,
  systemPrompt: string,
  userMessage: string,
  signal?: AbortSignal
): Promise<RunSideResult> {
  try {
    const response = await provider.generate({
      systemPrompt,
      userMessage,
      maxTokens: 4096,
      temperature: 0.7,
      signal,
      maxRetries: 0,
    });
    return {
      ok: true,
      output: response.content,
      truncated: response.stopReason === "max_tokens",
    };
  } catch (error) {
    return { ok: false, reason: mapErrorToReason(error) };
  }
}

export async function runBoth(args: RunBothArgs): Promise<RunBothResult> {
  const { originalPrompt, patchedPrompt, taskContext, provider, signal } = args;

  // Each side is an independent Claude call with the prompt as system message
  // and the task context as the user message — the user's "task" to perform.
  const [original, patched] = await Promise.all([
    runOne(provider, originalPrompt, taskContext, signal),
    runOne(provider, patchedPrompt, taskContext, signal),
  ]);

  return { original, patched };
}
