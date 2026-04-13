import { describe, expect, it } from "vitest";
import { ClaudeProvider } from "@prompt-engineer/ai";
import { classifyAndSuggest } from "../classify-and-suggest";

/**
 * Golden fixture test — gated behind RUN_EVALS=1 to avoid API cost on every
 * commit. Run manually: `RUN_EVALS=1 ANTHROPIC_API_KEY=... pnpm test`.
 *
 * Each fixture: a mediocre prompt + expected category + a loose shape
 * assertion on the returned suggestions.
 */

const RUN = process.env.RUN_EVALS === "1";

const FIXTURES = [
  {
    name: "coding — no output format",
    prompt: "Write a function that processes users.",
    taskContext:
      "I have an array of user objects with id, email, and lastLoginAt. I want to find users who haven't logged in for 30+ days and return them as structured data.",
    expectedCategory: "CODING",
    // Shape assertion: a CODING critique should collectively mention at least
    // one of: output format, examples, explicit types.
    shapeHint: /output format|example|type|json|schema/i,
  },
  {
    name: "writing — vague tone",
    prompt: "Write something about renewable energy.",
    taskContext: "I need a 500-word blog intro for a climate tech audience.",
    expectedCategory: "WRITING",
    shapeHint: /audience|tone|length|structure|hook|specific/i,
  },
  {
    name: "business — no context",
    prompt: "Draft an email to the team.",
    taskContext:
      "I need to tell my 8-person eng team we're delaying the launch by 2 weeks due to a security finding.",
    expectedCategory: "BUSINESS",
    shapeHint: /audience|tone|context|stakes|specific|detail/i,
  },
];

describe.skipIf(!RUN)("critique golden fixtures (RUN_EVALS=1)", () => {
  it.each(FIXTURES)("$name → category + shape", async (fixture) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY required for fixture tests");
    const provider = new ClaudeProvider(apiKey);

    const result = await classifyAndSuggest({
      prompt: fixture.prompt,
      taskContext: fixture.taskContext,
      provider,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.category).toBe(fixture.expectedCategory);
    const combined = result.suggestions
      .map((s) => `${s.title} ${s.rationale}`)
      .join(" ");
    expect(combined).toMatch(fixture.shapeHint);
  }, 60_000);
});
