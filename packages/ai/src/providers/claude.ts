import Anthropic from "@anthropic-ai/sdk";
import type { ModelProvider, ModelRequest, ModelResponse } from "../types";
import { withRetry } from "../retry";

export class ClaudeProvider implements ModelProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = "claude-sonnet-4-6") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    return withRetry(
      async () => {
        const response = await this.client.messages.create(
          {
            model: this.model,
            max_tokens: request.maxTokens ?? 2048,
            temperature: request.temperature ?? 0.7,
            system: request.systemPrompt,
            messages: [{ role: "user", content: request.userMessage }],
          },
          request.signal ? { signal: request.signal } : undefined
        );

        const textBlock = response.content.find((b) => b.type === "text");
        return {
          content: textBlock?.text ?? "",
          tokensUsed: {
            input: response.usage.input_tokens,
            output: response.usage.output_tokens,
            total: response.usage.input_tokens + response.usage.output_tokens,
          },
          model: this.model,
          stopReason: response.stop_reason ?? undefined,
        };
      },
      request.maxRetries !== undefined ? { maxRetries: request.maxRetries } : {}
    );
  }

  async *stream(request: ModelRequest): AsyncIterable<string> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: request.maxTokens ?? 2048,
      temperature: request.temperature ?? 0.7,
      system: request.systemPrompt,
      messages: [{ role: "user", content: request.userMessage }],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  }
}
