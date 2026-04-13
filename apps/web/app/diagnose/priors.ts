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
    description: "TODO: replace with hand-written CODING prior.",
    failureModes: ["TODO"],
    examples: [{ before: "TODO", after: "TODO", why: "TODO" }],
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
