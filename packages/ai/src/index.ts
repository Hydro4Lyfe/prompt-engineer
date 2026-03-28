export type { ModelProvider, ModelRequest, ModelResponse } from "./types";
export { ClaudeProvider } from "./providers/claude";
export { safeJsonParse } from "./json-parse";
export { withRetry } from "./retry";

import type { ModelProvider } from "./types";
import { ClaudeProvider } from "./providers/claude";

let provider: ModelProvider | null = null;

export function getModelProvider(): ModelProvider {
  if (!provider) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    provider = new ClaudeProvider(apiKey);
  }
  return provider;
}
