import type { PromptCategory } from "@prompt-engineer/validators";

/**
 * PRIORS CORPUS — THE IP OF THE PROTOTYPE.
 *
 * This file is hand-written from founder judgment. Do NOT generate with an LLM.
 * ~200 lines total when complete. The critique engine is only as good as this file.
 *
 * Each entry has:
 *   - description: one-paragraph description of what makes a good prompt in this category
 *   - failureModes: 5-8 common failure modes as short bullet strings
 *   - examples: 2-3 before/after mini-examples showing the failure → fix transformation
 */

export interface CategoryExample {
  before: string;
  after: string;
  why: string;
}

export interface CategoryPrior {
  description: string;
  failureModes: string[];
  examples: CategoryExample[];
}

export type PriorsCorpus = Record<PromptCategory, CategoryPrior>;

// TODO(matchy): write this corpus by hand. The stubs below are placeholders so
// the TypeScript compiler is happy while the surrounding infrastructure is built.
// Replace every description/failureMode/example with real content before any silent watch.
export const PRIORS: PriorsCorpus = {
  CODING: {
    description:
      "A good coding prompt gives the model enough structure to produce correct, maintainable, and context-aware code. It states the goal, the language and stack, the runtime constraints, the expected inputs and outputs, and any important style or architectural rules. Strong coding prompts also define what success looks like: whether the user wants a quick patch, a production-ready implementation, a refactor, tests, performance improvements, or an explanation of tradeoffs.",

    failureModes: [
      "The prompt asks for code without naming the language, framework, or runtime environment.",
      "It describes the feature vaguely and leaves key behavior undefined, forcing the model to guess.",
      "It omits input/output shape, making the generated code incompatible with the surrounding system.",
      "It does not say whether the user wants a minimal example, a prototype, or production-ready code.",
      "It ignores constraints such as performance, security, error handling, or backward compatibility.",
      "It fails to mention existing architecture, so the answer may conflict with current patterns or dependencies.",
      "It asks for a fix without including the failing code, error message, or observed behavior.",
      "It requests a refactor but gives no quality target, such as readability, modularity, typing, or testability.",
      "It mixes multiple goals together, such as debugging, redesigning, documenting, and optimizing, without priority order.",
      "It does not specify whether explanation, comments, tests, or step-by-step reasoning are desired alongside the code.",
    ],

    examples: [
      {
        before: "Write me a login system.",
        after:
          "Build a production-ready login flow for a Next.js App Router application using TypeScript and PostgreSQL. Use email/password authentication with hashed passwords, secure session cookies, server-side validation, and rate limiting on login attempts. Return the code for the API route, validation schema, database access layer, and a simple login form. Include basic error handling and explain any security decisions.",
        why:
          "The improved prompt defines the stack, the authentication method, the security requirements, the output scope, and the expected implementation quality.",
      },
      {
        before: "Fix my function.",
        after:
          "Debug and fix this TypeScript function. The current bug is that it returns duplicate users when multiple roles are attached. Keep the function signature the same, preserve O(n) or O(n log n) performance, and explain the root cause before showing the corrected version.\n\nCode:\n```ts\nfunction getActiveUsers(records: { id: string; active: boolean; roles: string[] }[]) {\n  return records\n    .filter((r) => r.active)\n    .flatMap((r) => r.roles.map(() => ({ id: r.id })));\n}\n```",
        why:
          "The revised prompt provides the actual code, the observed bug, compatibility constraints, and the format of the desired response.",
      },
      {
        before: "Make this code better.",
        after:
          "Refactor the following Node.js service for readability and maintainability without changing behavior. Keep it in plain TypeScript, do not introduce new dependencies, and preserve the public method names. Focus on separation of concerns, error handling, and smaller helper functions. After the refactor, summarize the main improvements in 5-7 sentences.\n\n[code here]",
        why:
          "The stronger prompt turns a vague request into a bounded refactor task with explicit constraints and clear evaluation criteria.",
      },
    ],
  },
  WRITING: {
    description: "TODO: replace with hand-written WRITING prior.",
    failureModes: ["TODO"],
    examples: [{ before: "TODO", after: "TODO", why: "TODO" }],
  },
  RESEARCH: {
    description: "TODO: replace with hand-written RESEARCH prior.",
    failureModes: ["TODO"],
    examples: [{ before: "TODO", after: "TODO", why: "TODO" }],
  },
  BUSINESS: {
    description: "TODO: replace with hand-written BUSINESS prior.",
    failureModes: ["TODO"],
    examples: [{ before: "TODO", after: "TODO", why: "TODO" }],
  },
  CREATIVE: {
    description: "TODO: replace with hand-written CREATIVE prior.",
    failureModes: ["TODO"],
    examples: [{ before: "TODO", after: "TODO", why: "TODO" }],
  },
  EDUCATIONAL: {
    description: "TODO: replace with hand-written EDUCATIONAL prior.",
    failureModes: ["TODO"],
    examples: [{ before: "TODO", after: "TODO", why: "TODO" }],
  },
};
