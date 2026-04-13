import { describe, expect, it } from "vitest";
import { buildCritiquePrompt } from "../critique-prompt";
import { PRIORS } from "../priors";

describe("buildCritiquePrompt", () => {
  it("returns both a systemPrompt and userMessage", () => {
    const built = buildCritiquePrompt({
      prompt: "write a function",
      taskContext: "parse a CSV",
      priors: PRIORS,
    });
    expect(built.systemPrompt).toBeTruthy();
    expect(built.userMessage).toBeTruthy();
  });

  it("includes every category label in the systemPrompt", () => {
    const built = buildCritiquePrompt({
      prompt: "x",
      taskContext: "y",
      priors: PRIORS,
    });
    for (const cat of [
      "CODING",
      "WRITING",
      "RESEARCH",
      "BUSINESS",
      "CREATIVE",
      "EDUCATIONAL",
    ]) {
      expect(built.systemPrompt).toContain(cat);
    }
  });

  it("embeds the prompt and task context in the userMessage verbatim", () => {
    const built = buildCritiquePrompt({
      prompt: "PROMPT_TEXT_xyz",
      taskContext: "CONTEXT_TEXT_abc",
      priors: PRIORS,
    });
    expect(built.userMessage).toContain("PROMPT_TEXT_xyz");
    expect(built.userMessage).toContain("CONTEXT_TEXT_abc");
  });

  it("does not crash on empty task context", () => {
    const built = buildCritiquePrompt({
      prompt: "x",
      taskContext: "",
      priors: PRIORS,
    });
    expect(built.userMessage).toBeTruthy();
  });
});
