export interface ModelRequest {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "json" | "text";
  signal?: AbortSignal;
  maxRetries?: number;
}

export interface ModelResponse {
  content: string;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  model: string;
  stopReason?: string;
}

export interface ModelProvider {
  generate(request: ModelRequest): Promise<ModelResponse>;
  stream(request: ModelRequest): AsyncIterable<string>;
}
