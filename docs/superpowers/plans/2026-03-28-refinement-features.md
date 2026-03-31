# Refinement Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add post-generation refinement capabilities (pro tips, steering dials, free-text refinement, version history) to Screen 3.

**Architecture:** Backend-first — schema, validators, prompts, and services built before UI. A new `RefinementService` handles AI-powered refinements. Version history is stored as a JSON array on the session. Client-side tip applications are instant (no API call) with lazy persistence via PATCH. Steering dial regeneration uses the existing state machine (COMPLETED -> GENERATING -> COMPLETED).

**Tech Stack:** Prisma, Zod, Next.js 16 App Router, Anthropic Claude, React 19, Tailwind CSS, Radix UI primitives

**Spec:** `docs/superpowers/specs/2026-03-28-refinement-features-design.md`

---

## File Structure

### New Files

```
vitest.config.ts                                          — Root vitest configuration
packages/validators/src/refinement.schema.ts              — PromptVersion, RefineInput, RefineResponse, RegenerateInput
packages/validators/src/__tests__/refinement.schema.test.ts — Validator tests
packages/prompts/src/refinement.prompt.ts                 — Refinement system prompt template
packages/services/src/refinement.service.ts               — Free-text refine + steering regenerate
packages/services/src/__tests__/refinement.service.test.ts — Service tests with mocks
apps/web/app/api/sessions/[id]/refine/route.ts            — POST refine endpoint
apps/web/app/api/sessions/[id]/regenerate/route.ts        — POST regenerate endpoint
apps/web/app/api/sessions/[id]/versions/route.ts          — PATCH versions endpoint
apps/web/lib/category-best-practices.ts                   — Static best practices config per category
apps/web/components/version-history.tsx                    — Version indicator + dropdown list
apps/web/components/pro-tips.tsx                           — AI tips + category tips as clickable chips
apps/web/components/refine-input.tsx                       — Free-text refinement textarea + button
apps/web/components/refinement-panel.tsx                   — Container for tips, dials, and refine input
```

### Modified Files

```
packages/db/prisma/schema.prisma              — Add versions Json? to PromptSession
packages/validators/src/session.schema.ts     — Add tips to SynthesisResponse, extend SessionResponse
packages/validators/src/index.ts              — Export refinement schemas
packages/prompts/src/synthesis.prompt.ts      — Update return format to include tips
packages/prompts/src/index.ts                 — Export refinement prompt
packages/services/src/synthesis.service.ts    — Parse tips, create initial version entry
packages/services/src/session.service.ts      — Add updateData() method
packages/services/src/index.ts                — Export RefinementService
apps/web/components/prompt-result.tsx         — Add version indicator, render refinement panel
apps/web/lib/hooks/use-session-flow.ts        — Version tracking, refine/regenerate/tip actions
apps/web/app/page.tsx                         — Pass new props from hook to PromptResult
```

---

### Task 1: Test Infrastructure

**Files:**
- Create: `vitest.config.ts`
- Modify: root `package.json`

- [ ] **Step 1: Install vitest**

```bash
pnpm add -D -w vitest
```

- [ ] **Step 2: Create root vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Add test scripts to root package.json**

Add to `"scripts"` in root `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify vitest runs**

Run: `pnpm test`
Expected: 0 tests found, exits cleanly with no errors

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json pnpm-lock.yaml
git commit -m "chore: add vitest test infrastructure"
```

---

### Task 2: Database Schema

**Files:**
- Modify: `packages/db/prisma/schema.prisma:71` (after `changelog Json?`)

- [ ] **Step 1: Add versions field to PromptSession**

In `packages/db/prisma/schema.prisma`, add after line 71 (`changelog Json?`):

```prisma
  versions        Json?
```

- [ ] **Step 2: Generate Prisma migration**

Run: `pnpm db:migrate --name add_versions_field`
Expected: Migration created successfully

- [ ] **Step 3: Regenerate Prisma client**

Run: `pnpm db:generate`
Expected: Prisma client generated successfully

- [ ] **Step 4: Verify build**

Run: `pnpm build --filter=@prompt-engineer/db`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/
git commit -m "feat: add versions JSON field to PromptSession schema"
```

---

### Task 3: Validator Schemas

**Files:**
- Create: `packages/validators/src/refinement.schema.ts`
- Create: `packages/validators/src/__tests__/refinement.schema.test.ts`
- Modify: `packages/validators/src/session.schema.ts:49-58` (SynthesisResponse)
- Modify: `packages/validators/src/session.schema.ts:60-76` (SessionResponse)
- Modify: `packages/validators/src/index.ts`

- [ ] **Step 1: Write failing tests for refinement schemas**

Create `packages/validators/src/__tests__/refinement.schema.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — cannot resolve `../refinement.schema`

- [ ] **Step 3: Create refinement schema file**

Create `packages/validators/src/refinement.schema.ts`:

```typescript
import { z } from "zod";
import { SteeringInputs } from "./steering.schema";

export const PromptVersion = z.object({
  id: z.string(),
  prompt: z.string(),
  changelog: z.array(z.string()).optional(),
  tips: z.array(z.string()).optional(),
  trigger: z.enum(["synthesis", "tip", "refine", "regenerate"]),
  description: z.string(),
  createdAt: z.string(),
});
export type PromptVersion = z.infer<typeof PromptVersion>;

export const RefineInput = z.object({
  currentPrompt: z.string().min(1).max(10000),
  instruction: z.string().min(1).max(1000),
});
export type RefineInput = z.infer<typeof RefineInput>;

export const RefineResponse = z.object({
  finalPrompt: z.string(),
  description: z.string(),
});
export type RefineResponse = z.infer<typeof RefineResponse>;

export const RegenerateInput = z.object({
  steeringInputs: SteeringInputs,
});
export type RegenerateInput = z.infer<typeof RegenerateInput>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: All 10 tests PASS

- [ ] **Step 5: Update SynthesisResponse with optional tips**

In `packages/validators/src/session.schema.ts`, replace the `SynthesisResponse` definition (lines 49-58):

```typescript
export const SynthesisResponse = z.object({
  finalPrompt: z.string(),
  changelog: z.array(z.string()),
  tips: z.array(z.string()).optional(),
  metadata: z.object({
    category: PromptCategory,
    tokensUsed: z.number(),
    modelUsed: z.string(),
  }),
});
export type SynthesisResponse = z.infer<typeof SynthesisResponse>;
```

- [ ] **Step 6: Extend SessionResponse with new fields**

In `packages/validators/src/session.schema.ts`, replace the `SessionResponse` definition (lines 60-76). Add `versions`, `steeringInputs`, `targetModel`, and `modelUsed` fields:

```typescript
export const SessionResponse = z.object({
  id: z.string(),
  rawPrompt: z.string().nullable(),
  mode: PromptMode,
  status: SessionStatus,
  category: PromptCategory.nullable(),
  intent: z.string().nullable(),
  detectedElements: z.array(z.string()).nullable(),
  questions: z.array(ClarificationQuestion).nullable(),
  answers: z.record(z.string(), z.string().nullable()).nullable(),
  finalPrompt: z.string().nullable(),
  changelog: z.array(z.string()).nullable(),
  tokensUsed: z.number().nullable(),
  modelUsed: z.string().nullable(),
  versions: z.array(z.any()).nullable(),
  steeringInputs: z.any().nullable(),
  targetModel: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SessionResponse = z.infer<typeof SessionResponse>;
```

Note: `versions` and `steeringInputs` use `z.any()` here because they're JSON columns from Prisma. The client-side code uses the typed `PromptVersion` schema for runtime validation where needed.

- [ ] **Step 7: Export refinement schemas from index**

In `packages/validators/src/index.ts`, add:

```typescript
export * from "./refinement.schema";
```

- [ ] **Step 8: Verify build**

Run: `pnpm build --filter=@prompt-engineer/validators`
Expected: Build succeeds

- [ ] **Step 9: Commit**

```bash
git add packages/validators/
git commit -m "feat: add refinement validator schemas and extend SynthesisResponse with tips"
```

---

### Task 4: Prompt Templates

**Files:**
- Modify: `packages/prompts/src/synthesis.prompt.ts:36-40`
- Create: `packages/prompts/src/refinement.prompt.ts`
- Modify: `packages/prompts/src/index.ts`

- [ ] **Step 1: Update synthesis prompt return format**

In `packages/prompts/src/synthesis.prompt.ts`, replace lines 36-40 (the return format instruction):

```typescript
Return JSON with three fields:
- "finalPrompt": string (the complete optimized prompt)
- "changelog": string[] (3-5 improvement descriptions)
- "tips": string[] (3-5 specific, actionable suggestions for further improving this prompt — things the user could add or adjust to get even better results)

Return ONLY valid JSON. No markdown, no explanation.`;
```

- [ ] **Step 2: Create refinement prompt template**

Create `packages/prompts/src/refinement.prompt.ts`:

```typescript
const MODEL_GUIDANCE: Record<string, string> = {
  claude: `The prompt is formatted for Claude (Anthropic) using XML tags. Maintain this formatting style.`,
  "gpt-4": `The prompt is formatted for GPT-4 (OpenAI) using markdown. Maintain this formatting style.`,
  gemini: `The prompt is formatted for Gemini (Google). Maintain its structure and formatting.`,
  llama: `The prompt is formatted for Llama (Meta). Keep it direct and explicit.`,
  mistral: `The prompt is formatted for Mistral. Maintain its direct structure.`,
  other: `Maintain the prompt's existing formatting and structure.`,
};

export function buildRefinementPrompt(targetModel?: string): string {
  const modelKey = targetModel ?? "other";
  const modelGuidance = MODEL_GUIDANCE[modelKey] ?? MODEL_GUIDANCE["other"];

  return `You are an expert prompt engineer. You are refining an existing optimized prompt based on a user's instruction.

${modelGuidance}

Given the current prompt and the user's refinement instruction, produce an updated version of the prompt.

Rules:
- Apply the refinement precisely — don't change unrelated parts
- Maintain the overall structure and quality of the prompt
- If the instruction is vague, interpret it reasonably
- Keep the prompt self-contained

Return JSON with two fields:
- "finalPrompt": string (the updated prompt)
- "description": string (1 sentence describing what you changed)

Return ONLY valid JSON. No markdown, no explanation.`;
}
```

- [ ] **Step 3: Export refinement prompt from index**

In `packages/prompts/src/index.ts`, add:

```typescript
export { buildRefinementPrompt } from "./refinement.prompt";
```

- [ ] **Step 4: Verify build**

Run: `pnpm build --filter=@prompt-engineer/prompts`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add packages/prompts/
git commit -m "feat: add refinement prompt template, update synthesis to return tips"
```

---

### Task 5: SynthesisService Update

**Files:**
- Modify: `packages/services/src/synthesis.service.ts:75-78` (safeJsonParse type)
- Modify: `packages/services/src/synthesis.service.ts:84-92` (response building)
- Modify: `packages/services/src/synthesis.service.ts:94-100` (persist with version)
- Modify: `packages/services/src/synthesis.service.ts:161-165` (regenerate parse)
- Modify: `packages/services/src/synthesis.service.ts:167-175` (regenerate response)

- [ ] **Step 1: Update safeJsonParse type in synthesize() to include tips**

In `packages/services/src/synthesis.service.ts`, replace the safeJsonParse call (lines 75-78):

```typescript
      const result = safeJsonParse<{
        finalPrompt: string;
        changelog: string[];
        tips?: string[];
      }>(response.content);
```

- [ ] **Step 2: Thread tips into SynthesisResponse**

Replace the response building block (lines 84-92):

```typescript
      const synthesisResponse: SynthesisResponse = {
        finalPrompt: result.finalPrompt,
        changelog: result.changelog,
        tips: result.tips,
        metadata: {
          category: session.category!,
          tokensUsed: response.tokensUsed.total,
          modelUsed: response.model,
        },
      };
```

- [ ] **Step 3: Create initial version entry on persist**

Replace the persist block (lines 94-100):

```typescript
      const initialVersion = {
        id: crypto.randomUUID(),
        prompt: result.finalPrompt,
        changelog: result.changelog,
        tips: result.tips,
        trigger: "synthesis" as const,
        description: "Initial generation",
        createdAt: new Date().toISOString(),
      };

      await this.sessions.transitionTo(sessionId, "COMPLETED", {
        finalPrompt: result.finalPrompt,
        changelog: result.changelog,
        versions: [initialVersion],
        tokensUsed: response.tokensUsed.total,
        modelUsed: response.model,
      });
```

- [ ] **Step 4: Update regenerate method safeJsonParse type**

In the `regenerate` method, replace the safeJsonParse call (lines 161-165):

```typescript
    const result = safeJsonParse<{
      finalPrompt: string;
      changelog: string[];
      tips?: string[];
    }>(response.content);
```

- [ ] **Step 5: Thread tips into regenerate response**

Replace the regenerate response building (lines 167-175):

```typescript
    const synthesisResponse: SynthesisResponse = {
      finalPrompt: result.finalPrompt,
      changelog: result.changelog,
      tips: result.tips,
      metadata: {
        category: session.category!,
        tokensUsed: response.tokensUsed.total,
        modelUsed: response.model,
      },
    };
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `pnpm build --filter=@prompt-engineer/services`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add packages/services/src/synthesis.service.ts
git commit -m "feat: thread tips through synthesis, create initial version entry"
```

---

### Task 6: RefinementService

**Files:**
- Create: `packages/services/src/__tests__/refinement.service.test.ts`
- Modify: `packages/services/src/session.service.ts` (add updateData method)
- Create: `packages/services/src/refinement.service.ts`
- Modify: `packages/services/src/index.ts`

- [ ] **Step 1: Write failing tests for RefinementService**

Create `packages/services/src/__tests__/refinement.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RefinementService } from "../refinement.service";
import type { SessionService } from "../session.service";

vi.mock("@prompt-engineer/ai", () => ({
  getModelProvider: vi.fn(),
  safeJsonParse: vi.fn(),
}));

vi.mock("@prompt-engineer/prompts", () => ({
  buildRefinementPrompt: vi.fn(() => "refinement system prompt"),
  buildSynthesisPrompt: vi.fn(() => "synthesis system prompt"),
}));

vi.mock("@prompt-engineer/db", () => ({
  prisma: {
    promptSession: {
      update: vi.fn(),
    },
  },
}));

import { getModelProvider, safeJsonParse } from "@prompt-engineer/ai";

describe("RefinementService", () => {
  let service: RefinementService;
  let mockSessions: {
    getById: ReturnType<typeof vi.fn>;
    transitionTo: ReturnType<typeof vi.fn>;
    updateData: ReturnType<typeof vi.fn>;
  };
  let mockProvider: { generate: ReturnType<typeof vi.fn> };

  const completedSession = {
    id: "session-1",
    status: "COMPLETED",
    rawPrompt: "Write a poem about cats",
    targetModel: "claude",
    questions: [
      { id: "q1", question: "What tone?", why: "tone matters", default: "playful", priority: 1, type: "text" },
    ],
    answers: { q1: "formal" },
    versions: [],
    category: "CREATIVE",
    steeringInputs: { tone: 50, detailLevel: 50 },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSessions = {
      getById: vi.fn().mockResolvedValue({ ...completedSession }),
      transitionTo: vi.fn().mockResolvedValue({}),
      updateData: vi.fn().mockResolvedValue({}),
    };

    mockProvider = {
      generate: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          finalPrompt: "Refined prompt text",
          description: "Made the prompt more concise",
        }),
        tokensUsed: { input: 100, output: 50, total: 150 },
        model: "claude-sonnet-4-6",
      }),
    };

    (getModelProvider as ReturnType<typeof vi.fn>).mockReturnValue(mockProvider);
    (safeJsonParse as ReturnType<typeof vi.fn>).mockImplementation(
      (raw: string) => {
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      }
    );

    service = new RefinementService(mockSessions as unknown as SessionService);
  });

  describe("refine", () => {
    it("calls Claude with current prompt and instruction", async () => {
      const result = await service.refine(
        "session-1",
        "current prompt text",
        "make it shorter"
      );

      expect(mockProvider.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          userMessage: expect.stringContaining("current prompt text"),
        })
      );
      expect(mockProvider.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          userMessage: expect.stringContaining("make it shorter"),
        })
      );
      expect(result.finalPrompt).toBe("Refined prompt text");
      expect(result.description).toBe("Made the prompt more concise");
    });

    it("persists new version and updated finalPrompt", async () => {
      await service.refine("session-1", "current prompt", "instruction");

      expect(mockSessions.updateData).toHaveBeenCalledWith(
        "session-1",
        expect.objectContaining({
          finalPrompt: "Refined prompt text",
          versions: expect.arrayContaining([
            expect.objectContaining({
              trigger: "refine",
              prompt: "Refined prompt text",
              description: "Made the prompt more concise",
            }),
          ]),
        })
      );
    });

    it("throws if session is not COMPLETED", async () => {
      mockSessions.getById.mockResolvedValue({
        ...completedSession,
        status: "GENERATING",
      });

      await expect(
        service.refine("session-1", "prompt", "instruction")
      ).rejects.toThrow();
    });

    it("does NOT change session status", async () => {
      await service.refine("session-1", "prompt", "instruction");

      expect(mockSessions.transitionTo).not.toHaveBeenCalled();
    });
  });

  describe("regenerate", () => {
    beforeEach(() => {
      mockProvider.generate.mockResolvedValue({
        content: JSON.stringify({
          finalPrompt: "Regenerated prompt",
          changelog: ["Changed tone"],
          tips: ["Add examples"],
        }),
        tokensUsed: { input: 200, output: 100, total: 300 },
        model: "claude-sonnet-4-6",
      });
    });

    it("transitions through GENERATING state", async () => {
      await service.regenerate("session-1", { tone: 80, detailLevel: 30 });

      expect(mockSessions.transitionTo).toHaveBeenCalledWith(
        "session-1",
        "GENERATING"
      );
      expect(mockSessions.transitionTo).toHaveBeenCalledWith(
        "session-1",
        "COMPLETED",
        expect.objectContaining({ finalPrompt: "Regenerated prompt" })
      );
    });

    it("includes steering context in the user message", async () => {
      await service.regenerate("session-1", { tone: 80, detailLevel: 30 });

      expect(mockProvider.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          userMessage: expect.stringContaining("Tone: 80/100"),
        })
      );
    });

    it("returns SynthesisResponse with tips", async () => {
      const result = await service.regenerate("session-1", {
        tone: 80,
        detailLevel: 30,
      });

      expect(result.finalPrompt).toBe("Regenerated prompt");
      expect(result.changelog).toEqual(["Changed tone"]);
      expect(result.tips).toEqual(["Add examples"]);
    });

    it("appends version to existing versions array", async () => {
      mockSessions.getById.mockResolvedValue({
        ...completedSession,
        versions: [
          {
            id: "v1",
            prompt: "original",
            trigger: "synthesis",
            description: "Initial",
            createdAt: "2026-03-28T00:00:00.000Z",
          },
        ],
      });

      await service.regenerate("session-1", { tone: 80, detailLevel: 30 });

      const persistedVersions =
        mockSessions.transitionTo.mock.calls[1][2].versions;
      expect(persistedVersions).toHaveLength(2);
      expect(persistedVersions[1].trigger).toBe("regenerate");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — cannot resolve `../refinement.service`

- [ ] **Step 3: Add updateData method to SessionService**

In `packages/services/src/session.service.ts`, add this method after the `delete` method (after line 117):

```typescript
  async updateData(id: string, data: Record<string, unknown>) {
    const session = await prisma.promptSession.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!session) throw new ServiceError("SESSION_NOT_FOUND", 404);
    return prisma.promptSession.update({
      where: { id },
      data,
    });
  }
```

- [ ] **Step 4: Create RefinementService**

Create `packages/services/src/refinement.service.ts`:

```typescript
import { getModelProvider, safeJsonParse } from "@prompt-engineer/ai";
import {
  buildRefinementPrompt,
  buildSynthesisPrompt,
} from "@prompt-engineer/prompts";
import type {
  RefineResponse,
  SynthesisResponse,
  PromptVersion,
  SteeringInputs,
  ClarificationQuestion,
} from "@prompt-engineer/validators";
import { SessionService } from "./session.service";
import { ServiceError } from "./errors";

export class RefinementService {
  constructor(private sessions: SessionService) {}

  async refine(
    sessionId: string,
    currentPrompt: string,
    instruction: string,
    userId?: string
  ): Promise<RefineResponse> {
    const session = await this.sessions.getById(sessionId, userId);
    if (session.status !== "COMPLETED") {
      throw new ServiceError("SESSION_NOT_COMPLETED", 409);
    }

    const targetModel = session.targetModel as string | undefined;
    const provider = getModelProvider();
    const response = await provider.generate({
      systemPrompt: buildRefinementPrompt(targetModel),
      userMessage: `Current prompt:\n"${currentPrompt}"\n\nRefinement instruction:\n"${instruction}"`,
      temperature: 0.6,
      maxTokens: 3000,
      responseFormat: "json",
    });

    const result = safeJsonParse<{ finalPrompt: string; description: string }>(
      response.content
    );
    if (!result) {
      throw new ServiceError("MODEL_INVALID_RESPONSE", 500);
    }

    const versions = ((session.versions as PromptVersion[]) ?? []).slice();
    const newVersion: PromptVersion = {
      id: crypto.randomUUID(),
      prompt: result.finalPrompt,
      trigger: "refine",
      description: result.description,
      createdAt: new Date().toISOString(),
    };
    versions.push(newVersion);

    await this.sessions.updateData(sessionId, {
      finalPrompt: result.finalPrompt,
      versions,
    });

    return {
      finalPrompt: result.finalPrompt,
      description: result.description,
    };
  }

  async regenerate(
    sessionId: string,
    steeringInputs: SteeringInputs,
    userId?: string
  ): Promise<SynthesisResponse> {
    const session = await this.sessions.getById(sessionId, userId);
    if (session.status !== "COMPLETED") {
      throw new ServiceError("SESSION_NOT_COMPLETED", 409);
    }

    const targetModel = session.targetModel as string | undefined;
    const questions = (session.questions as ClarificationQuestion[]) ?? [];
    const answers =
      (session.answers as Record<string, string | null>) ?? {};

    await this.sessions.transitionTo(sessionId, "GENERATING");

    try {
      const qaContext = questions
        .map((q) => {
          const answer = answers[q.id];
          const effective = answer ?? `${q.default} (default)`;
          return `Q: ${q.question}\nA: ${effective}`;
        })
        .join("\n\n");

      const steeringContext = buildSteeringContext(steeringInputs);

      const userMessage = [
        `Original rough prompt:\n"${session.rawPrompt}"`,
        qaContext ? `\nClarification Q&A:\n${qaContext}` : "",
        steeringContext
          ? `\nSteering preferences:\n${steeringContext}`
          : "",
        `\nGenerate the optimized prompt.`,
      ]
        .filter(Boolean)
        .join("\n");

      const provider = getModelProvider();
      const response = await provider.generate({
        systemPrompt: buildSynthesisPrompt(targetModel),
        userMessage,
        temperature: 0.6,
        maxTokens: 3000,
        responseFormat: "json",
      });

      const result = safeJsonParse<{
        finalPrompt: string;
        changelog: string[];
        tips?: string[];
      }>(response.content);
      if (!result) {
        throw new ServiceError("MODEL_INVALID_RESPONSE", 500);
      }

      const synthesisResponse: SynthesisResponse = {
        finalPrompt: result.finalPrompt,
        changelog: result.changelog,
        tips: result.tips,
        metadata: {
          category: session.category!,
          tokensUsed: response.tokensUsed.total,
          modelUsed: response.model,
        },
      };

      const versions = ((session.versions as PromptVersion[]) ?? []).slice();
      const newVersion: PromptVersion = {
        id: crypto.randomUUID(),
        prompt: result.finalPrompt,
        changelog: result.changelog,
        tips: result.tips,
        trigger: "regenerate",
        description: "Regenerated with adjusted steering",
        createdAt: new Date().toISOString(),
      };
      versions.push(newVersion);

      await this.sessions.transitionTo(sessionId, "COMPLETED", {
        finalPrompt: result.finalPrompt,
        changelog: result.changelog,
        steeringInputs,
        versions,
        tokensUsed: response.tokensUsed.total,
        modelUsed: response.model,
      });

      return synthesisResponse;
    } catch (error) {
      await this.sessions.transitionTo(sessionId, "FAILED").catch(() => {});
      throw error;
    }
  }
}

function buildSteeringContext(inputs: SteeringInputs): string {
  const lines: string[] = [];

  const toneLabel =
    inputs.tone < 40 ? "formal" : inputs.tone > 60 ? "casual" : "neutral";
  lines.push(`- Tone: ${inputs.tone}/100 (${toneLabel})`);

  const detailLabel =
    inputs.detailLevel < 40
      ? "concise"
      : inputs.detailLevel > 60
        ? "thorough"
        : "moderate";
  lines.push(`- Detail Level: ${inputs.detailLevel}/100 (${detailLabel})`);

  if (inputs.categoryDials) {
    for (const [key, value] of Object.entries(inputs.categoryDials)) {
      lines.push(`- ${key}: ${value}`);
    }
  }

  return lines.join("\n");
}
```

- [ ] **Step 5: Export RefinementService from index**

In `packages/services/src/index.ts`, add:

```typescript
export { RefinementService } from "./refinement.service";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test`
Expected: All tests PASS (both validator and service tests)

- [ ] **Step 7: Verify build**

Run: `pnpm build --filter=@prompt-engineer/services`
Expected: Build succeeds

- [ ] **Step 8: Commit**

```bash
git add packages/services/ packages/validators/src/__tests__/
git commit -m "feat: add RefinementService with refine and regenerate methods"
```

---

### Task 7: API Routes

**Files:**
- Create: `apps/web/app/api/sessions/[id]/refine/route.ts`
- Create: `apps/web/app/api/sessions/[id]/regenerate/route.ts`
- Create: `apps/web/app/api/sessions/[id]/versions/route.ts`

Reference the existing pattern in `apps/web/app/api/sessions/[id]/answers/route.ts` for error handling and service instantiation.

- [ ] **Step 1: Create refine route**

Create `apps/web/app/api/sessions/[id]/refine/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  SessionService,
  RefinementService,
} from "@prompt-engineer/services";
import { RefineInput } from "@prompt-engineer/validators";

const sessionService = new SessionService();
const refinementService = new RefinementService(sessionService);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = RefineInput.parse(body);

    const result = await refinementService.refine(
      id,
      parsed.currentPrompt,
      parsed.instruction
    );

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message ?? "Refinement failed" },
      { status: error.status ?? 500 }
    );
  }
}
```

- [ ] **Step 2: Create regenerate route**

Create `apps/web/app/api/sessions/[id]/regenerate/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  SessionService,
  RefinementService,
} from "@prompt-engineer/services";
import { RegenerateInput } from "@prompt-engineer/validators";

const sessionService = new SessionService();
const refinementService = new RefinementService(sessionService);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = RegenerateInput.parse(body);

    const result = await refinementService.regenerate(
      id,
      parsed.steeringInputs
    );

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message ?? "Regeneration failed" },
      { status: error.status ?? 500 }
    );
  }
}
```

- [ ] **Step 3: Create versions PATCH route**

Create `apps/web/app/api/sessions/[id]/versions/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SessionService } from "@prompt-engineer/services";
import { PromptVersion } from "@prompt-engineer/validators";

const sessionService = new SessionService();

const PatchVersionsInput = z.object({
  versions: z.array(PromptVersion),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = PatchVersionsInput.parse(body);

    // Verify ownership before updating
    const anonymousId =
      new URL(req.url).searchParams.get("anonymousId") ?? undefined;
    await sessionService.getById(id, undefined, anonymousId);

    const lastVersion = parsed.versions[parsed.versions.length - 1];

    await sessionService.updateData(id, {
      versions: parsed.versions,
      ...(lastVersion && { finalPrompt: lastVersion.prompt }),
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message ?? "Update failed" },
      { status: error.status ?? 500 }
    );
  }
}
```

- [ ] **Step 4: Verify the dev server starts cleanly**

Run: `pnpm dev` (then Ctrl+C after confirming no errors)
Expected: No import or compilation errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/sessions/\[id\]/refine/ apps/web/app/api/sessions/\[id\]/regenerate/ apps/web/app/api/sessions/\[id\]/versions/
git commit -m "feat: add refine, regenerate, and versions API routes"
```

---

### Task 8: Category Best Practices Config

**Files:**
- Create: `apps/web/lib/category-best-practices.ts`

- [ ] **Step 1: Create the config file**

Create `apps/web/lib/category-best-practices.ts`:

```typescript
import type { PromptCategory } from "@prompt-engineer/validators";

export const CATEGORY_BEST_PRACTICES: Record<PromptCategory, string[]> = {
  CODING: [
    "Include error handling expectations",
    "Specify testing requirements",
    "Define the target runtime environment",
  ],
  WRITING: [
    "Specify the target audience explicitly",
    "Include a style reference or example",
    "Define the desired format (bullet points, paragraphs, etc.)",
  ],
  RESEARCH: [
    "Specify preferred source types (academic, industry, etc.)",
    "Define the expected depth of analysis",
    "Request citations or references",
  ],
  BUSINESS: [
    "Include specific metrics or KPIs to reference",
    "Specify the decision-maker audience",
    "Define the expected deliverable format",
  ],
  CREATIVE: [
    "Include mood or atmosphere references",
    "Specify any content boundaries or constraints",
    "Define the intended medium or platform",
  ],
  EDUCATIONAL: [
    "Specify prerequisite knowledge assumptions",
    "Include assessment or practice opportunities",
    "Define the learning objectives clearly",
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/category-best-practices.ts
git commit -m "feat: add category best practices config"
```

---

### Task 9: Version History Component

**Files:**
- Create: `apps/web/components/version-history.tsx`

- [ ] **Step 1: Create the version history component**

Create `apps/web/components/version-history.tsx`:

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import type { PromptVersion } from "@prompt-engineer/validators";
import { ChevronDown, Sparkles, MessageSquare, RefreshCw, Lightbulb } from "lucide-react";

interface VersionHistoryProps {
  versions: PromptVersion[];
  activeIndex: number;
  onNavigate: (index: number) => void;
}

const TRIGGER_ICONS: Record<string, typeof Sparkles> = {
  synthesis: Sparkles,
  tip: Lightbulb,
  refine: MessageSquare,
  regenerate: RefreshCw,
};

export function VersionHistory({
  versions,
  activeIndex,
  onNavigate,
}: VersionHistoryProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  if (versions.length <= 1) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
      >
        <span>
          v{activeIndex + 1} of {versions.length}
        </span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-1 w-72 rounded-lg border border-zinc-200 bg-white shadow-lg">
          <div className="px-3 py-2 border-b border-zinc-100">
            <span className="text-xs font-medium text-zinc-500">
              Version History
            </span>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {versions.map((version, i) => {
              const Icon = TRIGGER_ICONS[version.trigger] ?? Sparkles;
              const isActive = i === activeIndex;
              return (
                <button
                  key={version.id}
                  onClick={() => {
                    onNavigate(i);
                    setOpen(false);
                  }}
                  className={`flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">v{i + 1}</span>
                      <span className="text-xs text-zinc-400">
                        {version.trigger}
                      </span>
                    </div>
                    <p className="truncate text-xs text-zinc-500">
                      {version.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/version-history.tsx
git commit -m "feat: add version history component"
```

---

### Task 10: Pro Tips Component

**Files:**
- Create: `apps/web/components/pro-tips.tsx`

- [ ] **Step 1: Create the pro tips component**

Create `apps/web/components/pro-tips.tsx`:

```tsx
"use client";

import type { PromptCategory } from "@prompt-engineer/validators";
import { Check, Lightbulb, BookOpen } from "lucide-react";
import { CATEGORY_BEST_PRACTICES } from "@/lib/category-best-practices";

interface ProTipsProps {
  aiTips: string[];
  category: PromptCategory | null;
  appliedTips: string[];
  onApplyTip: (tip: string) => void;
}

export function ProTips({
  aiTips,
  category,
  appliedTips,
  onApplyTip,
}: ProTipsProps) {
  const categoryTips = category ? CATEGORY_BEST_PRACTICES[category] ?? [] : [];
  const hasAiTips = aiTips.length > 0;
  const hasCategoryTips = categoryTips.length > 0;

  if (!hasAiTips && !hasCategoryTips) return null;

  return (
    <div className="flex flex-col gap-4">
      {hasAiTips && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
            <Lightbulb className="h-3.5 w-3.5" />
            <span>AI Suggestions</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {aiTips.map((tip) => (
              <TipChip
                key={tip}
                tip={tip}
                applied={appliedTips.includes(tip)}
                onApply={() => onApplyTip(tip)}
              />
            ))}
          </div>
        </div>
      )}

      {hasCategoryTips && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Best Practices</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {categoryTips.map((tip) => (
              <TipChip
                key={tip}
                tip={tip}
                applied={appliedTips.includes(tip)}
                onApply={() => onApplyTip(tip)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TipChip({
  tip,
  applied,
  onApply,
}: {
  tip: string;
  applied: boolean;
  onApply: () => void;
}) {
  return (
    <button
      onClick={onApply}
      disabled={applied}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
        applied
          ? "border-zinc-200 bg-zinc-50 text-zinc-400 cursor-default"
          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
      }`}
    >
      {applied && <Check className="h-3 w-3" />}
      <span>{tip}</span>
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/pro-tips.tsx
git commit -m "feat: add pro tips component with AI and category chips"
```

---

### Task 11: Refine Input Component

**Files:**
- Create: `apps/web/components/refine-input.tsx`

- [ ] **Step 1: Create the refine input component**

Create `apps/web/components/refine-input.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface RefineInputProps {
  onRefine: (instruction: string) => Promise<void>;
  isRefining: boolean;
}

export function RefineInput({ onRefine, isRefining }: RefineInputProps) {
  const [instruction, setInstruction] = useState("");

  const handleSubmit = async () => {
    if (!instruction.trim() || isRefining) return;
    await onRefine(instruction.trim());
    setInstruction("");
  };

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="Describe how you'd like to refine this prompt..."
        className="min-h-[80px] text-sm resize-none"
        disabled={isRefining}
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!instruction.trim() || isRefining}
        >
          {isRefining ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Refining...
            </>
          ) : (
            "Refine"
          )}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/refine-input.tsx
git commit -m "feat: add free-text refine input component"
```

---

### Task 12: Refinement Panel Container

**Files:**
- Create: `apps/web/components/refinement-panel.tsx`

- [ ] **Step 1: Create the refinement panel component**

This component orchestrates the pro tips, steering dials, refine input, and refresh button.

Create `apps/web/components/refinement-panel.tsx`:

```tsx
"use client";

import { useState } from "react";
import type {
  PromptCategory,
  SteeringInputs,
} from "@prompt-engineer/validators";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, RefreshCw, Loader2 } from "lucide-react";
import { ProTips } from "./pro-tips";
import { SteeringDials } from "./steering-dials";
import { RefineInput } from "./refine-input";

interface RefinementPanelProps {
  // Tips
  aiTips: string[];
  category: PromptCategory | null;
  appliedTips: string[];
  onApplyTip: (tip: string) => void;
  // Steering
  steeringInputs: SteeringInputs;
  onSteeringInputsChange: (inputs: SteeringInputs) => void;
  steeringDirty: boolean;
  onRegenerateWithSteering: () => void;
  // Refine
  onRefine: (instruction: string) => Promise<void>;
  isRefining: boolean;
}

export function RefinementPanel({
  aiTips,
  category,
  appliedTips,
  onApplyTip,
  steeringInputs,
  onSteeringInputsChange,
  steeringDirty,
  onRegenerateWithSteering,
  onRefine,
  isRefining,
}: RefinementPanelProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-lg border border-zinc-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
      >
        <span>Refine Your Prompt</span>
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-zinc-100 px-4 py-4 flex flex-col gap-6">
          {/* Pro Tips */}
          <ProTips
            aiTips={aiTips}
            category={category}
            appliedTips={appliedTips}
            onApplyTip={onApplyTip}
          />

          {/* Steering Dials */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-medium text-zinc-500">
              Steering Dials
            </span>
            <SteeringDials
              steeringInputs={steeringInputs}
              onChange={onSteeringInputsChange}
            />
            {steeringDirty && (
              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  onClick={onRegenerateWithSteering}
                  disabled={isRefining}
                >
                  {isRefining ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-1.5 h-4 w-4" />
                      Refresh Prompt
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Free-text Refine */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-zinc-500">
              Custom Refinement
            </span>
            <RefineInput onRefine={onRefine} isRefining={isRefining} />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/refinement-panel.tsx
git commit -m "feat: add refinement panel container component"
```

---

### Task 13: Hook — Version & Refinement State

**Files:**
- Modify: `apps/web/lib/hooks/use-session-flow.ts`

This is the largest single change. The hook gains version tracking, tip application, refine action, regenerate-with-steering action, version navigation, and updated loadSession logic.

- [ ] **Step 1: Add new imports and types**

At the top of `apps/web/lib/hooks/use-session-flow.ts`, add the `PromptVersion` import:

```typescript
import type {
  AnalysisResponse,
  SynthesisResponse,
  SteeringInputs,
  TargetModel,
  PromptMode,
  ClarificationQuestion,
  PromptVersion,
} from "@prompt-engineer/validators";
```

- [ ] **Step 2: Extend FlowState interface**

Replace the `FlowState` interface (lines 13-33) with:

```typescript
interface FlowState {
  step: FlowStep;
  sessionId: string | null;
  isLoading: boolean;
  isRefining: boolean;
  error: string | null;

  // Screen 1 inputs
  rawPrompt: string;
  targetModel: TargetModel;
  steeringInputs: SteeringInputs;
  mode: PromptMode;

  // Screen 2 data
  analysisResult: AnalysisResponse | null;
  answers: Record<string, string | null>;

  // Screen 3 data
  synthesisResult: SynthesisResponse | null;

  // Version tracking
  versions: PromptVersion[];
  activeVersionIndex: number;
  appliedTips: string[];
  originalSteeringInputs: SteeringInputs;
}
```

- [ ] **Step 3: Update initialState**

Replace `initialState` (lines 35-52) with:

```typescript
const initialState: FlowState = {
  step: "input",
  sessionId: null,
  isLoading: false,
  isRefining: false,
  error: null,
  rawPrompt: "",
  targetModel: "claude",
  steeringInputs: initialSteeringInputs,
  mode: "quick",
  analysisResult: null,
  answers: {},
  synthesisResult: null,
  versions: [],
  activeVersionIndex: 0,
  appliedTips: [],
  originalSteeringInputs: initialSteeringInputs,
};
```

- [ ] **Step 4: Update submitAnswers to create initial version**

Replace the `submitAnswers` callback (lines 135-165) with:

```typescript
  const submitAnswers = useCallback(async () => {
    if (!state.sessionId) return;

    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const res = await fetch(`/api/sessions/${state.sessionId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: state.answers }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Synthesis failed");
      }
      const synthesisResult: SynthesisResponse = await res.json();

      // Note: The server also creates an initial version in SynthesisService.
      // This client-side version mirrors it for immediate local state. Subsequent
      // operations (tip apply, refine, regenerate) overwrite the server's versions
      // array, so the two stay in sync.
      const initialVersion: PromptVersion = {
        id: crypto.randomUUID(),
        prompt: synthesisResult.finalPrompt,
        changelog: synthesisResult.changelog,
        tips: synthesisResult.tips,
        trigger: "synthesis",
        description: "Initial generation",
        createdAt: new Date().toISOString(),
      };

      setState((s) => ({
        ...s,
        synthesisResult,
        versions: [initialVersion],
        activeVersionIndex: 0,
        appliedTips: [],
        originalSteeringInputs: { ...s.steeringInputs },
        step: "result",
        isLoading: false,
      }));
    } catch (error: any) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: error.message ?? "Something went wrong",
      }));
    }
  }, [state.sessionId, state.answers]);
```

- [ ] **Step 5: Add applyTip action**

Add after the `submitAnswers` callback:

```typescript
  const applyTip = useCallback(
    (tipText: string) => {
      setState((s) => {
        const currentPrompt =
          s.versions[s.activeVersionIndex]?.prompt ??
          s.synthesisResult?.finalPrompt ??
          "";
        const updatedPrompt = `${currentPrompt}\n\nAdditional constraint: ${tipText}`;

        const newVersion: PromptVersion = {
          id: crypto.randomUUID(),
          prompt: updatedPrompt,
          trigger: "tip",
          description: `Applied: ${tipText}`,
          createdAt: new Date().toISOString(),
        };

        const newVersions = [...s.versions, newVersion];
        const newIndex = newVersions.length - 1;

        // Fire-and-forget PATCH to persist versions (pass anonymousId for auth)
        if (s.sessionId) {
          const qs = anonymousId ? `?anonymousId=${anonymousId}` : "";
          fetch(`/api/sessions/${s.sessionId}/versions${qs}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ versions: newVersions }),
          }).catch(() => {});
        }

        return {
          ...s,
          versions: newVersions,
          activeVersionIndex: newIndex,
          appliedTips: [...s.appliedTips, tipText],
        };
      });
    },
    [anonymousId]
  );
```

- [ ] **Step 6: Add refine action**

Add after `applyTip`:

```typescript
  const refine = useCallback(
    async (instruction: string) => {
      if (!state.sessionId) return;

      const currentPrompt =
        state.versions[state.activeVersionIndex]?.prompt ??
        state.synthesisResult?.finalPrompt ??
        "";

      setState((s) => ({ ...s, isRefining: true, error: null }));

      try {
        const res = await fetch(
          `/api/sessions/${state.sessionId}/refine`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentPrompt, instruction }),
          }
        );
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Refinement failed");
        }
        const result = await res.json();

        const newVersion: PromptVersion = {
          id: crypto.randomUUID(),
          prompt: result.finalPrompt,
          trigger: "refine",
          description: result.description,
          createdAt: new Date().toISOString(),
        };

        setState((s) => ({
          ...s,
          versions: [...s.versions, newVersion],
          activeVersionIndex: s.versions.length, // index of the newly appended version
          isRefining: false,
        }));
      } catch (error: any) {
        setState((s) => ({
          ...s,
          isRefining: false,
          error: error.message ?? "Refinement failed",
        }));
      }
    },
    [state.sessionId, state.versions, state.activeVersionIndex, state.synthesisResult]
  );
```

- [ ] **Step 7: Add regenerateWithSteering action**

Add after `refine`:

```typescript
  const regenerateWithSteering = useCallback(async () => {
    if (!state.sessionId) return;

    setState((s) => ({ ...s, isRefining: true, error: null }));

    try {
      const res = await fetch(
        `/api/sessions/${state.sessionId}/regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ steeringInputs: state.steeringInputs }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Regeneration failed");
      }
      const synthesisResult: SynthesisResponse = await res.json();

      const newVersion: PromptVersion = {
        id: crypto.randomUUID(),
        prompt: synthesisResult.finalPrompt,
        changelog: synthesisResult.changelog,
        tips: synthesisResult.tips,
        trigger: "regenerate",
        description: "Regenerated with adjusted steering",
        createdAt: new Date().toISOString(),
      };

      setState((s) => ({
        ...s,
        synthesisResult,
        versions: [...s.versions, newVersion],
        activeVersionIndex: s.versions.length,
        appliedTips: [],
        originalSteeringInputs: { ...s.steeringInputs },
        isRefining: false,
      }));
    } catch (error: any) {
      setState((s) => ({
        ...s,
        isRefining: false,
        error: error.message ?? "Regeneration failed",
      }));
    }
  }, [state.sessionId, state.steeringInputs]);
```

- [ ] **Step 8: Add navigateToVersion action**

Add after `regenerateWithSteering`:

```typescript
  const navigateToVersion = useCallback((index: number) => {
    setState((s) => ({
      ...s,
      activeVersionIndex: Math.max(0, Math.min(index, s.versions.length - 1)),
    }));
  }, []);
```

- [ ] **Step 9: Update loadSession to restore versions and steering**

Replace the `loadSession` callback (lines 179-226) with:

```typescript
  const loadSession = useCallback(
    async (sessionId: string) => {
      if (!anonymousId) return;

      setState((s) => ({ ...s, isLoading: true, error: null }));

      try {
        const res = await fetch(
          `/api/sessions/${sessionId}?anonymousId=${anonymousId}`
        );
        if (!res.ok) throw new Error("Failed to load session");
        const session = await res.json();

        if (session.status === "COMPLETED" && session.finalPrompt) {
          const versions: PromptVersion[] = session.versions ?? [];
          const restoredSteering: SteeringInputs = session.steeringInputs ?? {
            tone: 50,
            detailLevel: 50,
          };
          const restoredTargetModel: TargetModel =
            session.targetModel ?? "claude";

          // Derive applied tips from version history
          const appliedTips = versions
            .filter((v: PromptVersion) => v.trigger === "tip")
            .map((v: PromptVersion) => v.description.replace("Applied: ", ""));

          setState((s) => ({
            ...s,
            sessionId,
            rawPrompt: session.rawPrompt ?? "",
            targetModel: restoredTargetModel,
            steeringInputs: restoredSteering,
            originalSteeringInputs: restoredSteering,
            synthesisResult: {
              finalPrompt: session.finalPrompt,
              changelog: session.changelog ?? [],
              tips: versions.length > 0 ? versions[0].tips : undefined,
              metadata: {
                category: session.category ?? "WRITING",
                tokensUsed: session.tokensUsed ?? 0,
                modelUsed: session.modelUsed ?? "",
              },
            },
            analysisResult: session.questions
              ? {
                  intent: session.intent ?? "",
                  category: session.category ?? "WRITING",
                  suggestedMode:
                    session.mode === "DETAILED" ? "detailed" : "quick",
                  detectedElements: session.detectedElements ?? [],
                  missingElements: [],
                  questions: session.questions,
                }
              : null,
            versions,
            activeVersionIndex: Math.max(0, versions.length - 1),
            appliedTips,
            step: "result",
            isLoading: false,
          }));
        }
      } catch (error: any) {
        setState((s) => ({
          ...s,
          isLoading: false,
          error: error.message ?? "Failed to load session",
        }));
      }
    },
    [anonymousId]
  );
```

- [ ] **Step 10: Update the return object**

Replace the return statement (lines 228-241) with:

```typescript
  // Derive current tips from the most recent version that has them
  const currentTips = (() => {
    for (let i = state.versions.length - 1; i >= 0; i--) {
      if (state.versions[i].tips?.length) return state.versions[i].tips!;
    }
    return state.synthesisResult?.tips ?? [];
  })();

  const steeringDirty =
    JSON.stringify(state.steeringInputs) !==
    JSON.stringify(state.originalSteeringInputs);

  return {
    ...state,
    currentTips,
    steeringDirty,
    setRawPrompt,
    setTargetModel,
    setSteeringInputs,
    setMode,
    analyze,
    setAnswer,
    submitAnswers,
    goBack,
    startOver,
    loadSession,
    applyTip,
    refine,
    regenerateWithSteering,
    navigateToVersion,
  };
```

- [ ] **Step 11: Verify TypeScript compiles**

Run: `pnpm build --filter=web`
Expected: Build succeeds (may have unused-variable warnings, which is fine at this stage)

- [ ] **Step 12: Commit**

```bash
git add apps/web/lib/hooks/use-session-flow.ts
git commit -m "feat: extend session flow hook with version tracking and refinement actions"
```

---

### Task 14: Integration — Wire Components Together

**Files:**
- Modify: `apps/web/components/prompt-result.tsx`
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Rewrite prompt-result.tsx with version support and refinement panel**

Replace the entire contents of `apps/web/components/prompt-result.tsx` with:

```tsx
"use client";

import { useState, useEffect } from "react";
import type {
  SynthesisResponse,
  PromptVersion,
  PromptCategory,
  SteeringInputs,
} from "@prompt-engineer/validators";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ContextBar } from "./context-bar";
import { CopyButton } from "./copy-button";
import { VersionHistory } from "./version-history";
import { RefinementPanel } from "./refinement-panel";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Eye,
  RotateCcw,
} from "lucide-react";

interface PromptResultProps {
  rawPrompt: string;
  category: string | null;
  targetModel: string;
  result: SynthesisResponse;
  onBack: () => void;
  onStartOver: () => void;
  // Version props
  versions: PromptVersion[];
  activeVersionIndex: number;
  onNavigateVersion: (index: number) => void;
  // Tips props
  currentTips: string[];
  appliedTips: string[];
  onApplyTip: (tip: string) => void;
  // Steering props
  steeringInputs: SteeringInputs;
  onSteeringInputsChange: (inputs: SteeringInputs) => void;
  steeringDirty: boolean;
  onRegenerateWithSteering: () => void;
  // Refine props
  onRefine: (instruction: string) => Promise<void>;
  isRefining: boolean;
}

export function PromptResult({
  rawPrompt,
  category,
  targetModel,
  result,
  onBack,
  onStartOver,
  versions,
  activeVersionIndex,
  onNavigateVersion,
  currentTips,
  appliedTips,
  onApplyTip,
  steeringInputs,
  onSteeringInputsChange,
  steeringDirty,
  onRegenerateWithSteering,
  onRefine,
  isRefining,
}: PromptResultProps) {
  const activeVersion = versions[activeVersionIndex];
  const currentPrompt = activeVersion?.prompt ?? result.finalPrompt;
  const currentChangelog = activeVersion?.changelog ?? result.changelog;

  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(currentPrompt);
  const [changelogOpen, setChangelogOpen] = useState(true);

  // Reset edited prompt when version changes
  useEffect(() => {
    setEditedPrompt(currentPrompt);
    setIsEditing(false);
  }, [currentPrompt]);

  const displayPrompt = isEditing ? editedPrompt : currentPrompt;

  return (
    <div className="flex flex-col gap-5">
      <ContextBar
        rawPrompt={rawPrompt}
        category={category}
        targetModel={targetModel}
        onBack={onBack}
      />

      <Card className="relative p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">
              Enhanced Prompt
            </h2>
            <VersionHistory
              versions={versions}
              activeIndex={activeVersionIndex}
              onNavigate={onNavigateVersion}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? (
                <>
                  <Eye className="mr-1.5 h-4 w-4" />
                  Preview
                </>
              ) : (
                <>
                  <Pencil className="mr-1.5 h-4 w-4" />
                  Edit
                </>
              )}
            </Button>
            <CopyButton text={displayPrompt} />
          </div>
        </div>

        {isEditing ? (
          <Textarea
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            className="min-h-[200px] text-sm font-mono"
          />
        ) : (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
            {displayPrompt}
          </div>
        )}
      </Card>

      {currentChangelog && currentChangelog.length > 0 && (
        <div className="rounded-lg border border-zinc-200">
          <button
            onClick={() => setChangelogOpen(!changelogOpen)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <span>What was improved</span>
            {changelogOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {changelogOpen && (
            <ul className="border-t border-zinc-100 px-4 py-3 space-y-2">
              {currentChangelog.map((item, i) => (
                <li key={i} className="text-sm text-zinc-600 flex gap-2">
                  <span className="text-zinc-400 mt-0.5">-</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <RefinementPanel
        aiTips={currentTips}
        category={category as PromptCategory | null}
        appliedTips={appliedTips}
        onApplyTip={onApplyTip}
        steeringInputs={steeringInputs}
        onSteeringInputsChange={onSteeringInputsChange}
        steeringDirty={steeringDirty}
        onRegenerateWithSteering={onRegenerateWithSteering}
        onRefine={onRefine}
        isRefining={isRefining}
      />

      <div className="flex items-center gap-3 pt-2">
        <Button variant="outline" onClick={onStartOver}>
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Start Over
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update page.tsx to pass new props**

In `apps/web/app/page.tsx`, replace the `PromptResult` rendering block (lines 60-68) with:

```tsx
            {flow.step === "result" && flow.synthesisResult && (
              <PromptResult
                rawPrompt={flow.rawPrompt}
                category={flow.analysisResult?.category ?? null}
                targetModel={flow.targetModel}
                result={flow.synthesisResult}
                onBack={flow.goBack}
                onStartOver={flow.startOver}
                versions={flow.versions}
                activeVersionIndex={flow.activeVersionIndex}
                onNavigateVersion={flow.navigateToVersion}
                currentTips={flow.currentTips}
                appliedTips={flow.appliedTips}
                onApplyTip={flow.applyTip}
                steeringInputs={flow.steeringInputs}
                onSteeringInputsChange={flow.setSteeringInputs}
                steeringDirty={flow.steeringDirty}
                onRegenerateWithSteering={flow.regenerateWithSteering}
                onRefine={flow.refine}
                isRefining={flow.isRefining}
              />
            )}
```

- [ ] **Step 3: Verify the full app builds**

Run: `pnpm build`
Expected: Build succeeds with no type errors

- [ ] **Step 4: Manual smoke test**

Run: `pnpm dev`

Test the following flow:
1. Enter a prompt on Screen 1, proceed through Screen 2 to Screen 3
2. Verify the refinement panel appears below the changelog
3. Verify AI tips display as clickable chips
4. Click a tip chip — verify it appends to the prompt and creates a new version
5. Verify version indicator shows "v2 of 2" and you can navigate back to v1
6. Type a free-text instruction and click Refine — verify Claude refines the prompt
7. Adjust steering dials — verify "Refresh Prompt" button appears
8. Click Refresh Prompt — verify full regeneration with new tips
9. Verify Start Over resets everything
10. Load a completed session from the sidebar — verify versions and steering are restored

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/prompt-result.tsx apps/web/app/page.tsx
git commit -m "feat: integrate refinement panel, version history, and tips into Screen 3"
```
