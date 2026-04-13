import { describe, expect, it } from "vitest";
import type { ModelProvider, ModelRequest, ModelResponse } from "@prompt-engineer/ai";
import { runBoth } from "../run-both";

function scripted(handlers: Array<(req: ModelRequest) => Promise<ModelResponse>>): ModelProvider {
  let call = 0;
  return {
    generate: async (req) => {
      const h = handlers[call] ?? handlers[handlers.length - 1];
      call += 1;
      return h(req);
    },
    stream: async function* () {
      yield "";
    },
  };
}

const ok = (content: string, stop = "end_turn"): ModelResponse => ({
  content,
  tokensUsed: { input: 1, output: 1, total: 2 },
  model: "test",
  stopReason: stop,
});

describe("runBoth", () => {
  it("returns both sides on success", async () => {
    const provider = scripted([
      async () => ok("original output"),
      async () => ok("new output"),
    ]);
    const r = await runBoth({
      originalPrompt: "o",
      patchedPrompt: "p",
      taskContext: "t",
      provider,
    });
    expect(r.original.ok).toBe(true);
    expect(r.patched.ok).toBe(true);
    expect(r.original.output).toBe("original output");
    expect(r.patched.output).toBe("new output");
  });

  it("surfaces truncated=true when stopReason is max_tokens", async () => {
    const provider = scripted([
      async () => ok("truncated…", "max_tokens"),
      async () => ok("ok"),
    ]);
    const r = await runBoth({
      originalPrompt: "o",
      patchedPrompt: "p",
      taskContext: "t",
      provider,
    });
    expect(r.original.truncated).toBe(true);
    expect(r.patched.truncated).toBe(false);
  });

  it("one side 429, other side succeeds — sides are independent", async () => {
    const provider = scripted([
      async () => {
        const err: Error & { status?: number } = new Error("429");
        err.status = 429;
        throw err;
      },
      async () => ok("new output"),
    ]);
    const r = await runBoth({
      originalPrompt: "o",
      patchedPrompt: "p",
      taskContext: "t",
      provider,
    });
    expect(r.original.ok).toBe(false);
    expect(r.original.reason).toBe("rate_limited");
    expect(r.patched.ok).toBe(true);
    expect(r.patched.output).toBe("new output");
  });

  it("both sides fail with different reasons", async () => {
    const provider = scripted([
      async () => {
        const err: Error & { name: string } = new Error("aborted");
        err.name = "AbortError";
        throw err;
      },
      async () => {
        throw new Error("boom");
      },
    ]);
    const r = await runBoth({
      originalPrompt: "o",
      patchedPrompt: "p",
      taskContext: "t",
      provider,
    });
    expect(r.original.ok).toBe(false);
    expect(r.original.reason).toBe("timeout");
    expect(r.patched.ok).toBe(false);
    expect(r.patched.reason).toBe("unknown");
  });

  it("requests maxTokens=4096 on each side", async () => {
    const seen: number[] = [];
    const provider: ModelProvider = {
      generate: async (req) => {
        seen.push(req.maxTokens ?? 0);
        return ok("x");
      },
      stream: async function* () {
        yield "";
      },
    };
    await runBoth({
      originalPrompt: "o",
      patchedPrompt: "p",
      taskContext: "t",
      provider,
    });
    expect(seen).toEqual([4096, 4096]);
  });
});
