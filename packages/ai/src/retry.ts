interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryOn: number[];
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelay: 1000,
  maxDelay: 5000,
  retryOn: [429, 500, 502, 503, 529],
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay, retryOn } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (error?.name === "AbortError") {
        throw error;
      }

      const status = error?.status ?? error?.statusCode;
      const isRetryable = retryOn.includes(status);

      if (attempt === maxRetries || !isRetryable) {
        throw error;
      }

      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 500,
        maxDelay
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}
