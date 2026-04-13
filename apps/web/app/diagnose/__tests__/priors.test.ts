import { describe, expect, it } from "vitest";
import { PRIORS } from "../priors";

const CATEGORIES = [
  "CODING",
  "WRITING",
  "RESEARCH",
  "BUSINESS",
  "CREATIVE",
  "EDUCATIONAL",
] as const;

describe("priors corpus shape", () => {
  it("has an entry for every category", () => {
    for (const cat of CATEGORIES) {
      expect(PRIORS[cat]).toBeDefined();
    }
  });

  it("every category has a non-empty description and failureModes", () => {
    for (const cat of CATEGORIES) {
      expect(PRIORS[cat].description.length).toBeGreaterThan(0);
      expect(PRIORS[cat].failureModes.length).toBeGreaterThan(0);
      expect(PRIORS[cat].examples.length).toBeGreaterThan(0);
    }
  });

  it("every example has before/after/why populated", () => {
    for (const cat of CATEGORIES) {
      for (const ex of PRIORS[cat].examples) {
        expect(ex.before.length).toBeGreaterThan(0);
        expect(ex.after.length).toBeGreaterThan(0);
        expect(ex.why.length).toBeGreaterThan(0);
      }
    }
  });
});
