import { describe, it, expect } from "vitest";
import {
  PromptVersion,
  RefineInput,
  RefineResponse,
  RegenerateInput,
} from "../refinement.schema";

describe("RefineInput", () => {
  it("validates valid input", () => {
    const result = RefineInput.safeParse({
      currentPrompt: "Write a poem about cats",
      instruction: "Make it shorter",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty currentPrompt", () => {
    const result = RefineInput.safeParse({
      currentPrompt: "",
      instruction: "Make it shorter",
    });
    expect(result.success).toBe(false);
  });

  it("rejects instruction over 1000 chars", () => {
    const result = RefineInput.safeParse({
      currentPrompt: "Hello",
      instruction: "x".repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});

describe("RefineResponse", () => {
  it("validates valid response", () => {
    const result = RefineResponse.safeParse({
      finalPrompt: "Updated prompt text",
      description: "Made the prompt more concise",
    });
    expect(result.success).toBe(true);
  });
});

describe("PromptVersion", () => {
  it("validates a synthesis version with all fields", () => {
    const result = PromptVersion.safeParse({
      id: "abc123",
      prompt: "The optimized prompt",
      changelog: ["Improved clarity", "Added structure"],
      tips: ["Add an example output"],
      trigger: "synthesis",
      description: "Initial generation",
      createdAt: "2026-03-28T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("validates a tip version without optional fields", () => {
    const result = PromptVersion.safeParse({
      id: "abc124",
      prompt: "Updated prompt with tip",
      trigger: "tip",
      description: "Applied: Add output format example",
      createdAt: "2026-03-28T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("validates a refine version", () => {
    const result = PromptVersion.safeParse({
      id: "abc125",
      prompt: "Refined prompt",
      trigger: "refine",
      description: "Made more concise",
      createdAt: "2026-03-28T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid trigger value", () => {
    const result = PromptVersion.safeParse({
      id: "abc126",
      prompt: "text",
      trigger: "invalid",
      description: "desc",
      createdAt: "2026-03-28T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("RegenerateInput", () => {
  it("validates valid steering inputs", () => {
    const result = RegenerateInput.safeParse({
      steeringInputs: { tone: 80, detailLevel: 30 },
    });
    expect(result.success).toBe(true);
  });

  it("validates with category dials", () => {
    const result = RegenerateInput.safeParse({
      steeringInputs: {
        tone: 50,
        detailLevel: 50,
        categoryDials: { errorHandling: true },
      },
    });
    expect(result.success).toBe(true);
  });
});
