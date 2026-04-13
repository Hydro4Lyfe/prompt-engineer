import { describe, expect, it, vi } from "vitest";
import type { ModelProvider, ModelRequest, ModelResponse } from "@prompt-engineer/ai";
import { classifyAndSuggest } from "../classify-and-suggest";

function mockProvider(handler: (req: ModelRequest) => Promise<ModelResponse>): ModelProvider {
  return {
    generate: handler,
    stream: async function* () {
      yield "";
    },
  };
}

const happyResponse = JSON.stringify({
  category: "CODING",
  suggestions: [
    { title: "A", rationale: "because", patchedPrompt: "P1" },
    { title: "B", rationale: "because", patchedPrompt: "P2" },
    { title: "C", rationale: "because", patchedPrompt: "P3" },
  ],
});

describe("classifyAndSuggest", () => {
  it("happy path returns ok + category + 3 suggestions", async () => {
    const provider = mockProvider(async () => ({
      content: happyResponse,
      tokensUsed: { input: 10, output: 10, total: 20 },
      model: "test",
    }));
    const result = await classifyAndSuggest({
      prompt: "p",
      taskContext: "c",
      provider,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.category).toBe("CODING");
      expect(result.suggestions).toHaveLength(3);
    }
  });

  it("extracts JSON from fenced code blocks", async () => {
    const provider = mockProvider(async () => ({
      content: "```json\n" + happyResponse + "\n```",
      tokensUsed: { input: 10, output: 10, total: 20 },
      model: "test",
    }));
    const result = await classifyAndSuggest({ prompt: "p", taskContext: "c", provider });
    expect(result.ok).toBe(true);
  });

  it("returns parse_error on unrecoverable garbage", async () => {
    const provider = mockProvider(async () => ({
      content: "not json at all, just prose",
      tokensUsed: { input: 10, output: 10, total: 20 },
      model: "test",
    }));
    const result = await classifyAndSuggest({ prompt: "p", taskContext: "c", provider });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("parse_error");
  });

  it("returns schema_violation on wrong shape", async () => {
    const provider = mockProvider(async () => ({
      content: JSON.stringify({ category: "CODING", suggestions: [{ nope: 1 }] }),
      tokensUsed: { input: 10, output: 10, total: 20 },
      model: "test",
    }));
    const result = await classifyAndSuggest({ prompt: "p", taskContext: "c", provider });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("schema_violation");
  });

  it("falls back to CODING when category is unknown", async () => {
    const provider = mockProvider(async () => ({
      content: JSON.stringify({
        category: "MAGIC",
        suggestions: [{ title: "a", rationale: "b", patchedPrompt: "c" }],
      }),
      tokensUsed: { input: 10, output: 10, total: 20 },
      model: "test",
    }));
    // Silence the expected console.warn
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await classifyAndSuggest({ prompt: "p", taskContext: "c", provider });
    spy.mockRestore();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.category).toBe("CODING");
  });

  it("returns rate_limited on 429", async () => {
    const provider = mockProvider(async () => {
      const err: Error & { status?: number } = new Error("429");
      err.status = 429;
      throw err;
    });
    const result = await classifyAndSuggest({ prompt: "p", taskContext: "c", provider });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("rate_limited");
  });

  it("returns timeout on AbortError", async () => {
    const provider = mockProvider(async () => {
      const err: Error & { name: string } = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });
    const result = await classifyAndSuggest({ prompt: "p", taskContext: "c", provider });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("timeout");
  });
});
