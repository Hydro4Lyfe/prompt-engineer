# Prompt Engineer UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the end-to-end single-page web UI for the prompt engineering tool — input with steering controls, clarification questions, and final prompt result — with anonymous session history sidebar.

**Architecture:** Single-page React app using Next.js App Router. The page manages a 3-step state machine (input → questions → result). API routes are thin handlers calling the existing service layer. Steering controls and target model flow into prompt templates to customize analysis and synthesis. Anonymous sessions use a localStorage-generated ID stored on a new `anonymousId` field.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Prisma 6, Zod, Anthropic SDK (via existing `@prompt-engineer/ai` package)

**Spec:** `docs/superpowers/specs/2026-03-28-prompt-engineer-ui-design.md`

---

## File Structure

### New files

```
packages/validators/src/steering.schema.ts    — TargetModel enum, SteeringInputs Zod schema
packages/db/prisma/schema.prisma              — (modify) add anonymousId, targetModel, steeringInputs fields
packages/prompts/src/analysis.prompt.ts       — (modify) accept steering context params
packages/prompts/src/synthesis.prompt.ts      — (modify) accept target model param
packages/services/src/session.service.ts      — (modify) add anonymousId support
packages/services/src/analysis.service.ts     — (modify) pass steering to prompt builder, bypass tier gates
apps/web/app/globals.css                      — (modify) add design tokens for minimal theme
apps/web/app/layout.tsx                       — (modify) update metadata, font setup
apps/web/app/page.tsx                         — (modify) replace boilerplate with prompt flow
apps/web/app/api/sessions/route.ts            — POST create session, GET list sessions
apps/web/app/api/sessions/[id]/route.ts       — GET session by id
apps/web/app/api/sessions/[id]/analyze/route.ts — POST analyze prompt
apps/web/app/api/sessions/[id]/answers/route.ts — POST submit answers
apps/web/lib/hooks/use-session-flow.ts        — state machine hook for 3-step flow
apps/web/lib/hooks/use-anonymous-id.ts        — localStorage anonymous ID hook
apps/web/lib/hooks/use-copy-clipboard.ts      — clipboard copy hook
apps/web/lib/utils.ts                         — cn() helper
apps/web/lib/steering-dials.ts                — category-specific dial definitions
apps/web/components/header.tsx                — app header with sidebar toggle
apps/web/components/sidebar.tsx               — collapsible session history sidebar
apps/web/components/prompt-input.tsx           — Screen 1: textarea + steering controls
apps/web/components/target-model-select.tsx    — target model dropdown
apps/web/components/task-type-tags.tsx         — category pill/chip selector
apps/web/components/steering-dials.tsx         — universal + category-specific dials
apps/web/components/mode-toggle.tsx            — quick/detailed mode toggle
apps/web/components/clarification-questions.tsx — Screen 2: question cards
apps/web/components/question-card.tsx          — individual question card
apps/web/components/prompt-result.tsx          — Screen 3: final prompt + changelog
apps/web/components/copy-button.tsx            — copy-to-clipboard button
apps/web/components/context-bar.tsx            — context strip shown on screens 2 & 3
```

---

## Task 1: Schema & Validator Updates

**Files:**
- Modify: `packages/db/prisma/schema.prisma:48-80`
- Create: `packages/validators/src/steering.schema.ts`
- Modify: `packages/validators/src/session.schema.ts:12-16`
- Modify: `packages/validators/src/index.ts`

- [ ] **Step 1: Add new fields to Prisma schema**

In `packages/db/prisma/schema.prisma`, add three fields to the `PromptSession` model:

```prisma
model PromptSession {
  id               String          @id @default(cuid())
  userId           String?
  user             User?           @relation(fields: [userId], references: [id], onDelete: SetNull)
  anonymousId      String?

  // Input
  rawPrompt        String          @default("")
  mode             PromptMode      @default(QUICK)
  targetModel      String?
  steeringInputs   Json?

  // ... rest unchanged

  @@index([userId, createdAt(sort: Desc)])
  @@index([status])
  @@index([anonymousId, createdAt(sort: Desc)])
}
```

- [ ] **Step 2: Run Prisma migration**

```bash
cd packages/db && npx prisma migrate dev --name add-steering-and-anonymous-id
```

Expected: Migration created successfully, new fields added to database.

- [ ] **Step 3: Create steering schema validators**

Create `packages/validators/src/steering.schema.ts`:

```typescript
import { z } from "zod";
import { PromptCategory } from "./common.schema";

export const TargetModel = z.enum([
  "claude",
  "gpt-4",
  "gemini",
  "llama",
  "mistral",
  "other",
]);
export type TargetModel = z.infer<typeof TargetModel>;

export const SteeringInputs = z.object({
  taskType: PromptCategory.optional(),
  tone: z.number().min(0).max(100).default(50),
  detailLevel: z.number().min(0).max(100).default(50),
  categoryDials: z
    .record(
      z.string(),
      z.union([z.number(), z.boolean(), z.string()])
    )
    .optional(),
});
export type SteeringInputs = z.infer<typeof SteeringInputs>;
```

- [ ] **Step 4: Extend AnalyzeInput schema**

In `packages/validators/src/session.schema.ts`, add the new imports and fields:

```typescript
import {
  PromptMode,
  PromptCategory,
  SessionStatus,
  UserTier,
  ClarificationQuestion,
} from "./common.schema";
import { TargetModel, SteeringInputs } from "./steering.schema";

export const AnalyzeInput = z.object({
  rawPrompt: z.string().min(1).max(5000),
  mode: PromptMode.optional(),
  targetModel: TargetModel.optional(),
  steeringInputs: SteeringInputs.optional(),
});
export type AnalyzeInput = z.infer<typeof AnalyzeInput>;
```

- [ ] **Step 5: Export steering schema from validators index**

In `packages/validators/src/index.ts`, add:

```typescript
export * from "./steering.schema";
```

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/ packages/validators/src/
git commit -m "feat: add steering inputs, target model, and anonymousId to schema"
```

---

## Task 2: Update Prompt Templates

**Files:**
- Modify: `packages/prompts/src/analysis.prompt.ts`
- Modify: `packages/prompts/src/synthesis.prompt.ts`
- Modify: `packages/prompts/src/index.ts`

- [ ] **Step 1: Update analysis prompt builder to accept steering context**

Replace `packages/prompts/src/analysis.prompt.ts`:

```typescript
import type { SteeringInputs } from "@prompt-engineer/validators";

interface AnalysisPromptOptions {
  steeringInputs?: SteeringInputs;
  targetModel?: string;
}

function describeSteeringContext(inputs: SteeringInputs): string {
  const parts: string[] = [];

  if (inputs.taskType) {
    parts.push(`The user has categorized this as a ${inputs.taskType} task.`);
  }

  if (inputs.tone !== undefined && inputs.tone !== 50) {
    const toneDesc = inputs.tone < 30 ? "formal" : inputs.tone < 70 ? "balanced" : "casual";
    parts.push(`Preferred tone: ${toneDesc} (${inputs.tone}/100 on formal-to-casual scale).`);
  }

  if (inputs.detailLevel !== undefined && inputs.detailLevel !== 50) {
    const detailDesc = inputs.detailLevel < 30 ? "concise" : inputs.detailLevel < 70 ? "moderate" : "thorough";
    parts.push(`Preferred detail level: ${detailDesc} (${inputs.detailLevel}/100 on concise-to-thorough scale).`);
  }

  if (inputs.categoryDials) {
    const dialParts = Object.entries(inputs.categoryDials).map(
      ([key, value]) => `${key}: ${value}`
    );
    if (dialParts.length > 0) {
      parts.push(`Category-specific preferences: ${dialParts.join(", ")}.`);
    }
  }

  return parts.join(" ");
}

export function buildAnalysisPrompt(options?: AnalysisPromptOptions): string {
  let steeringSection = "";
  if (options?.steeringInputs) {
    const context = describeSteeringContext(options.steeringInputs);
    if (context) {
      steeringSection = `\n\nThe user has already provided these preferences:\n${context}\nDo NOT ask questions about topics the user has already specified above. Focus your questions on what is still missing.`;
    }
  }

  return `You are an expert prompt engineer analyzing a user's rough prompt to identify what information would most improve the final prompt's effectiveness.

Analyze the provided rough prompt and return a JSON object with these fields:

1. "intent": What the user is trying to accomplish (1 sentence)
2. "category": One of ["WRITING", "CODING", "RESEARCH", "BUSINESS", "CREATIVE", "EDUCATIONAL"]
3. "suggestedMode": "quick" if the task is straightforward, "detailed" if complex
4. "detectedElements": Array of strings — what's already specified
5. "missingElements": Array of strings — what's missing that would significantly improve results
6. "questions": Array of 5-7 question objects, each with:
   - "id": "q1", "q2", etc.
   - "question": Concise, specific clarification question
   - "why": One sentence explaining why this matters (shown to user)
   - "default": A reasonable default if user skips
   - "priority": 1-5 (1 = highest impact on output quality)
   - "type": "select" | "text" | "scale"
   - "options": (for select type only) array of 3-5 choices

Rules:
- Never ask what the user already told you
- Each question must unlock meaningfully better output
- Defaults must be sensible so skipping still improves the prompt
- Prefer "select" over "text" when possible — faster for the user
- Priority 1 = without this answer, the output will likely be wrong or useless
- Priority 2 = without this answer, the output will be generic
- Priority 3+ = refinement, nice to have${steeringSection}

Return ONLY valid JSON. No markdown, no explanation.`;
}
```

- [ ] **Step 2: Update synthesis prompt builder to accept target model**

Replace `packages/prompts/src/synthesis.prompt.ts`:

```typescript
const MODEL_GUIDANCE: Record<string, string> = {
  claude: `Format the prompt for Claude (Anthropic). Use XML tags like <context>, <instructions>, <constraints> for structure. Leverage system prompt conventions. Claude responds well to clear role definitions and explicit output format specifications.`,
  "gpt-4": `Format the prompt for GPT-4 (OpenAI). Use markdown formatting with headers and bullet points. Place the most important instructions first. Use explicit instruction hierarchy. GPT-4 responds well to numbered steps and "You MUST" directives.`,
  gemini: `Format the prompt for Gemini (Google). Use clear section headers and explicit output format specifications. Gemini works well with structured instructions and concrete examples.`,
  llama: `Format the prompt for Llama (Meta). Keep instructions direct and explicit. Use simple, clear formatting. Avoid relying on nuanced formatting — be straightforward. Shorter, focused prompts tend to work better.`,
  mistral: `Format the prompt for Mistral. Keep instructions direct and explicit. Use clear structure with simple formatting. Be specific about constraints and output format.`,
  other: `Format the prompt using generic best practices. Use clear structure with headers or separators. Include explicit constraints, output format, and examples where helpful.`,
};

export function buildSynthesisPrompt(targetModel?: string): string {
  const modelKey = targetModel ?? "other";
  const modelGuidance = MODEL_GUIDANCE[modelKey] ?? MODEL_GUIDANCE["other"];

  return `You are an expert prompt engineer. Given a user's original rough prompt and their answers to clarification questions, generate an optimized final prompt.

${modelGuidance}

Structure the final prompt to include (as applicable):
1. Role/persona framing
2. Clear task statement
3. Context and background
4. Specific requirements and constraints
5. Output format specification
6. Tone/style guidance

Also return a "changelog" array of 3-5 strings, each describing a specific improvement you made and why it matters.

Rules:
- The final prompt must be self-contained — usable without this conversation
- Don't pad with unnecessary instructions
- Match prompt complexity to task complexity — simple tasks get simple prompts
- Use the user's terminology
- For skipped questions, apply defaults subtly — don't over-specify
- The prompt should feel like a human expert wrote it, not a template

Return JSON with two fields:
- "finalPrompt": string (the complete optimized prompt)
- "changelog": string[] (3-5 improvement descriptions)

Return ONLY valid JSON. No markdown, no explanation.`;
}
```

- [ ] **Step 3: Update prompts index exports**

In `packages/prompts/src/index.ts`, the exports stay the same (function names unchanged):

```typescript
export { buildAnalysisPrompt } from "./analysis.prompt";
export { buildSynthesisPrompt } from "./synthesis.prompt";
```

No change needed — just verify the file still exports correctly.

- [ ] **Step 4: Commit**

```bash
git add packages/prompts/src/
git commit -m "feat: add steering context to analysis prompt, model-specific guidance to synthesis prompt"
```

---

## Task 3: Update Service Layer

**Files:**
- Modify: `packages/services/src/session.service.ts`
- Modify: `packages/services/src/analysis.service.ts`
- Modify: `packages/services/src/synthesis.service.ts`

- [ ] **Step 1: Add anonymousId support to SessionService**

In `packages/services/src/session.service.ts`, update `create()` and add `listByAnonymousId()`:

```typescript
import { prisma } from "@prompt-engineer/db";
import { ServiceError } from "./errors";

const VALID_TRANSITIONS: Record<string, string[]> = {
  CREATED: ["ANALYZING"],
  ANALYZING: ["QUESTIONS_READY", "FAILED"],
  QUESTIONS_READY: ["ANSWERS_SUBMITTED"],
  ANSWERS_SUBMITTED: ["GENERATING"],
  GENERATING: ["COMPLETED", "FAILED"],
  COMPLETED: ["GENERATING"],
  FAILED: ["ANALYZING"],
};

export class SessionService {
  async create(userId?: string, anonymousId?: string): Promise<{ id: string }> {
    const session = await prisma.promptSession.create({
      data: {
        rawPrompt: "",
        mode: "QUICK",
        status: "CREATED",
        ...(userId && { userId }),
        ...(anonymousId && !userId && { anonymousId }),
      },
      select: { id: true },
    });
    return session;
  }

  async getById(id: string, userId?: string, anonymousId?: string) {
    const session = await prisma.promptSession.findUnique({
      where: { id },
    });
    if (!session) throw new ServiceError("SESSION_NOT_FOUND", 404);
    if (userId && session.userId && session.userId !== userId) {
      throw new ServiceError("FORBIDDEN", 403);
    }
    if (anonymousId && session.anonymousId && session.anonymousId !== anonymousId) {
      throw new ServiceError("FORBIDDEN", 403);
    }
    return session;
  }

  async list(userId: string, cursor?: string, limit = 20) {
    const sessions = await prisma.promptSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: {
        id: true,
        rawPrompt: true,
        status: true,
        category: true,
        createdAt: true,
      },
    });

    const hasMore = sessions.length > limit;
    const items = hasMore ? sessions.slice(0, -1) : sessions;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return { sessions: items, nextCursor };
  }

  async listByAnonymousId(anonymousId: string, cursor?: string, limit = 20) {
    const sessions = await prisma.promptSession.findMany({
      where: { anonymousId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: {
        id: true,
        rawPrompt: true,
        status: true,
        category: true,
        createdAt: true,
        finalPrompt: true,
      },
    });

    const hasMore = sessions.length > limit;
    const items = hasMore ? sessions.slice(0, -1) : sessions;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return { sessions: items, nextCursor };
  }

  async transitionTo(
    id: string,
    status: string,
    data?: Record<string, unknown>
  ) {
    const session = await prisma.promptSession.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!session) throw new ServiceError("SESSION_NOT_FOUND", 404);

    const allowed = VALID_TRANSITIONS[session.status];
    if (!allowed?.includes(status)) {
      throw new ServiceError(
        "INVALID_TRANSITION",
        409,
        `Cannot transition from ${session.status} to ${status}`
      );
    }

    return prisma.promptSession.update({
      where: { id },
      data: { status: status as any, ...data },
    });
  }

  async delete(id: string, userId: string) {
    const session = await this.getById(id, userId);
    await prisma.promptSession.delete({ where: { id: session.id } });
  }
}
```

- [ ] **Step 2: Update AnalysisService to pass steering context and bypass tier gates**

In `packages/services/src/analysis.service.ts`, update the `analyze` method:

```typescript
import { getModelProvider, safeJsonParse } from "@prompt-engineer/ai";
import { buildAnalysisPrompt } from "@prompt-engineer/prompts";
import type {
  AnalysisResponse,
  PromptMode,
  SteeringInputs,
  TargetModel,
} from "@prompt-engineer/validators";
import { SessionService } from "./session.service";
import { UsageService } from "./usage.service";
import { ServiceError } from "./errors";

export class AnalysisService {
  constructor(
    private sessions: SessionService,
    private usage: UsageService
  ) {}

  async analyze(
    sessionId: string,
    rawPrompt: string,
    mode?: PromptMode,
    userId?: string,
    targetModel?: TargetModel,
    steeringInputs?: SteeringInputs
  ): Promise<AnalysisResponse> {
    // 1. Check rate limits and tier (skip for anonymous users)
    if (userId) {
      await this.usage.checkLimits(userId);
      if (mode === "detailed") {
        await this.usage.requireFeature(userId, "detailedMode");
      }
    }
    // Anonymous users can use any mode during testing

    // 2. Transition session to ANALYZING
    await this.sessions.transitionTo(sessionId, "ANALYZING", {
      rawPrompt,
      ...(targetModel && { targetModel }),
      ...(steeringInputs && { steeringInputs }),
    });

    try {
      // 3. Call model with steering context
      const provider = getModelProvider();
      const systemPrompt = buildAnalysisPrompt({ steeringInputs, targetModel });
      const response = await provider.generate({
        systemPrompt,
        userMessage: rawPrompt,
        temperature: 0.4,
        responseFormat: "json",
      });

      // 4. Parse and validate response
      const result = safeJsonParse<AnalysisResponse>(response.content);
      if (!result) {
        throw new ServiceError("MODEL_INVALID_RESPONSE", 500);
      }

      // 5. Filter questions by mode
      const effectiveMode = mode ?? result.suggestedMode;
      const maxQuestions = effectiveMode === "quick" ? 3 : 6;
      result.questions = result.questions
        .sort((a, b) => a.priority - b.priority)
        .slice(0, maxQuestions);

      // 6. Persist results and transition to QUESTIONS_READY
      await this.sessions.transitionTo(sessionId, "QUESTIONS_READY", {
        intent: result.intent,
        category: result.category,
        detectedElements: result.detectedElements,
        missingElements: result.missingElements,
        questions: result.questions,
        mode: effectiveMode === "quick" ? "QUICK" : "DETAILED",
      });

      // 7. Track usage
      if (userId) {
        await this.usage.recordSession(userId, response.tokensUsed.total);
      }

      return result;
    } catch (error) {
      await this.sessions.transitionTo(sessionId, "FAILED").catch(() => {});
      throw error;
    }
  }
}
```

- [ ] **Step 3: Update SynthesisService to pass target model to prompt builder**

In `packages/services/src/synthesis.service.ts`, update the `synthesize` method to read `targetModel` from the session and pass it to `buildSynthesisPrompt`:

Change the `synthesize` method — after loading the session (line 23-27), read `targetModel`:

```typescript
const targetModel = (session as any).targetModel as string | undefined;
```

Change the prompt builder call (around line 65-66):

```typescript
const provider = getModelProvider();
const response = await provider.generate({
  systemPrompt: buildSynthesisPrompt(targetModel),
  userMessage,
  temperature: 0.6,
  maxTokens: 3000,
  responseFormat: "json",
});
```

Also update the `regenerate` method similarly — read `targetModel` from session and pass to `buildSynthesisPrompt(targetModel)`.

- [ ] **Step 4: Commit**

```bash
git add packages/services/src/ packages/prompts/src/
git commit -m "feat: update services for steering context, anonymous sessions, and model targeting"
```

---

## Task 4: Install shadcn/ui and Set Up Design System

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/layout.tsx`
- Create: `apps/web/lib/utils.ts`

- [ ] **Step 1: Install shadcn/ui dependencies**

```bash
cd apps/web && pnpm add class-variance-authority clsx tailwind-merge lucide-react
```

- [ ] **Step 2: Create cn() utility**

Create `apps/web/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Initialize shadcn/ui and add required components**

```bash
cd apps/web && npx shadcn@latest init
```

Follow the prompts selecting: TypeScript, default style, neutral base color, CSS variables.

Then add components:

```bash
cd apps/web && npx shadcn@latest add button card select slider textarea badge tooltip
```

- [ ] **Step 4: Update globals.css with design tokens**

Update `apps/web/app/globals.css` to include shadcn/ui CSS variables and the minimal theme. The `shadcn init` command will have generated most of this — keep what it generated and ensure the color palette is muted/minimal (not the default vivid palette).

- [ ] **Step 5: Update layout.tsx metadata**

In `apps/web/app/layout.tsx`, update the metadata:

```typescript
export const metadata: Metadata = {
  title: "Prompt Engineer",
  description: "Transform rough prompts into polished, high-quality prompts optimized for any AI model.",
};
```

- [ ] **Step 6: Commit**

```bash
cd /home/hydro4lyfe/coding-projects/prompt-engineer
git add apps/web/
git commit -m "feat: set up shadcn/ui, design tokens, and utility helpers"
```

---

## Task 5: API Routes

**Files:**
- Create: `apps/web/app/api/sessions/route.ts`
- Create: `apps/web/app/api/sessions/[id]/route.ts`
- Create: `apps/web/app/api/sessions/[id]/analyze/route.ts`
- Create: `apps/web/app/api/sessions/[id]/answers/route.ts`

- [ ] **Step 1: Create sessions list/create route**

Create `apps/web/app/api/sessions/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { SessionService } from "@prompt-engineer/services";

const sessions = new SessionService();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const anonymousId = body.anonymousId as string | undefined;
    const session = await sessions.create(undefined, anonymousId);
    return NextResponse.json(session, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Failed to create session" },
      { status: error.status ?? 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const anonymousId = searchParams.get("anonymousId");
    const cursor = searchParams.get("cursor") ?? undefined;
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);

    if (!anonymousId) {
      return NextResponse.json({ error: "anonymousId required" }, { status: 400 });
    }

    const result = await sessions.listByAnonymousId(anonymousId, cursor, limit);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Failed to list sessions" },
      { status: error.status ?? 500 }
    );
  }
}
```

- [ ] **Step 2: Create session get-by-id route**

Create `apps/web/app/api/sessions/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { SessionService } from "@prompt-engineer/services";

const sessions = new SessionService();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const anonymousId = new URL(req.url).searchParams.get("anonymousId") ?? undefined;
    const session = await sessions.getById(id, undefined, anonymousId);
    return NextResponse.json(session);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Session not found" },
      { status: error.status ?? 500 }
    );
  }
}
```

- [ ] **Step 3: Create analyze route**

Create `apps/web/app/api/sessions/[id]/analyze/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { SessionService, AnalysisService, UsageService } from "@prompt-engineer/services";
import { AnalyzeInput } from "@prompt-engineer/validators";

const sessionService = new SessionService();
const usageService = new UsageService();
const analysisService = new AnalysisService(sessionService, usageService);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = AnalyzeInput.parse(body);

    const result = await analysisService.analyze(
      id,
      parsed.rawPrompt,
      parsed.mode,
      undefined, // no userId for anonymous
      parsed.targetModel,
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
      { error: error.message ?? "Analysis failed" },
      { status: error.status ?? 500 }
    );
  }
}
```

- [ ] **Step 4: Create answers route**

Create `apps/web/app/api/sessions/[id]/answers/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { SessionService, SynthesisService, UsageService } from "@prompt-engineer/services";
import { AnswersInput } from "@prompt-engineer/validators";

const sessionService = new SessionService();
const usageService = new UsageService();
const synthesisService = new SynthesisService(sessionService, usageService);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = AnswersInput.parse(body);

    const result = await synthesisService.synthesize(
      id,
      parsed.answers,
      undefined // no userId for anonymous
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
      { error: error.message ?? "Synthesis failed" },
      { status: error.status ?? 500 }
    );
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/
git commit -m "feat: add API routes for sessions, analysis, and synthesis"
```

---

## Task 6: React Hooks

**Files:**
- Create: `apps/web/lib/hooks/use-anonymous-id.ts`
- Create: `apps/web/lib/hooks/use-session-flow.ts`
- Create: `apps/web/lib/hooks/use-copy-clipboard.ts`
- Create: `apps/web/lib/steering-dials.ts`

- [ ] **Step 1: Create anonymous ID hook**

Create `apps/web/lib/hooks/use-anonymous-id.ts`:

```typescript
"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "pe-anon-id";

export function useAnonymousId(): string | null {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    let stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      stored = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, stored);
    }
    setId(stored);
  }, []);

  return id;
}
```

- [ ] **Step 2: Create session flow state machine hook**

Create `apps/web/lib/hooks/use-session-flow.ts`:

```typescript
"use client";

import { useState, useCallback } from "react";
import type {
  AnalysisResponse,
  SynthesisResponse,
  SteeringInputs,
  TargetModel,
  PromptMode,
  ClarificationQuestion,
} from "@prompt-engineer/validators";

type FlowStep = "input" | "questions" | "result";

interface FlowState {
  step: FlowStep;
  sessionId: string | null;
  isLoading: boolean;
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
}

const initialSteeringInputs: SteeringInputs = {
  tone: 50,
  detailLevel: 50,
};

const initialState: FlowState = {
  step: "input",
  sessionId: null,
  isLoading: false,
  error: null,
  rawPrompt: "",
  targetModel: "claude",
  steeringInputs: initialSteeringInputs,
  mode: "quick",
  analysisResult: null,
  answers: {},
  synthesisResult: null,
};

export function useSessionFlow(anonymousId: string | null) {
  const [state, setState] = useState<FlowState>(initialState);

  const setRawPrompt = useCallback((rawPrompt: string) => {
    setState((s) => ({ ...s, rawPrompt }));
  }, []);

  const setTargetModel = useCallback((targetModel: TargetModel) => {
    setState((s) => ({ ...s, targetModel }));
  }, []);

  const setSteeringInputs = useCallback((steeringInputs: SteeringInputs) => {
    setState((s) => ({ ...s, steeringInputs }));
  }, []);

  const setMode = useCallback((mode: PromptMode) => {
    setState((s) => ({ ...s, mode }));
  }, []);

  const analyze = useCallback(async () => {
    if (!anonymousId || !state.rawPrompt.trim()) return;

    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      // 1. Create session
      const createRes = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonymousId }),
      });
      if (!createRes.ok) throw new Error("Failed to create session");
      const { id: sessionId } = await createRes.json();

      // 2. Analyze
      const analyzeRes = await fetch(`/api/sessions/${sessionId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawPrompt: state.rawPrompt,
          mode: state.mode,
          targetModel: state.targetModel,
          steeringInputs: state.steeringInputs,
        }),
      });
      if (!analyzeRes.ok) {
        const err = await analyzeRes.json();
        throw new Error(err.error ?? "Analysis failed");
      }
      const analysisResult: AnalysisResponse = await analyzeRes.json();

      // 3. Pre-fill answers with defaults
      const defaultAnswers: Record<string, string | null> = {};
      for (const q of analysisResult.questions) {
        defaultAnswers[q.id] = q.default;
      }

      setState((s) => ({
        ...s,
        sessionId,
        analysisResult,
        answers: defaultAnswers,
        step: "questions",
        isLoading: false,
      }));
    } catch (error: any) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: error.message ?? "Something went wrong",
      }));
    }
  }, [anonymousId, state.rawPrompt, state.mode, state.targetModel, state.steeringInputs]);

  const setAnswer = useCallback((questionId: string, value: string | null) => {
    setState((s) => ({
      ...s,
      answers: { ...s.answers, [questionId]: value },
    }));
  }, []);

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

      setState((s) => ({
        ...s,
        synthesisResult,
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

  const goBack = useCallback(() => {
    setState((s) => {
      if (s.step === "questions") return { ...s, step: "input", error: null };
      if (s.step === "result") return { ...s, step: "questions", error: null };
      return s;
    });
  }, []);

  const startOver = useCallback(() => {
    setState(initialState);
  }, []);

  const loadSession = useCallback(async (sessionId: string) => {
    if (!anonymousId) return;

    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const res = await fetch(
        `/api/sessions/${sessionId}?anonymousId=${anonymousId}`
      );
      if (!res.ok) throw new Error("Failed to load session");
      const session = await res.json();

      if (session.status === "COMPLETED" && session.finalPrompt) {
        setState((s) => ({
          ...s,
          sessionId,
          rawPrompt: session.rawPrompt ?? "",
          synthesisResult: {
            finalPrompt: session.finalPrompt,
            changelog: session.changelog ?? [],
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
                suggestedMode: session.mode === "DETAILED" ? "detailed" : "quick",
                detectedElements: session.detectedElements ?? [],
                missingElements: [],
                questions: session.questions,
              }
            : null,
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
  }, [anonymousId]);

  return {
    ...state,
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
  };
}
```

- [ ] **Step 3: Create copy-to-clipboard hook**

Create `apps/web/lib/hooks/use-copy-clipboard.ts`:

```typescript
"use client";

import { useState, useCallback } from "react";

export function useCopyClipboard(resetDelay = 2000) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), resetDelay);
      } catch {
        // Fallback for older browsers
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopied(true);
        setTimeout(() => setCopied(false), resetDelay);
      }
    },
    [resetDelay]
  );

  return { copied, copy };
}
```

- [ ] **Step 4: Create steering dials definition file**

Create `apps/web/lib/steering-dials.ts`:

```typescript
import type { PromptCategory } from "@prompt-engineer/validators";

export interface DialDefinition {
  key: string;
  label: string;
  type: "slider" | "toggle" | "select";
  // Slider
  min?: number;
  max?: number;
  defaultValue?: number;
  minLabel?: string;
  maxLabel?: string;
  // Toggle
  defaultChecked?: boolean;
  // Select
  options?: { value: string; label: string }[];
  defaultOption?: string;
}

export const UNIVERSAL_DIALS: DialDefinition[] = [
  {
    key: "tone",
    label: "Tone",
    type: "slider",
    min: 0,
    max: 100,
    defaultValue: 50,
    minLabel: "Formal",
    maxLabel: "Casual",
  },
  {
    key: "detailLevel",
    label: "Detail Level",
    type: "slider",
    min: 0,
    max: 100,
    defaultValue: 50,
    minLabel: "Concise",
    maxLabel: "Thorough",
  },
];

export const CATEGORY_DIALS: Record<PromptCategory, DialDefinition[]> = {
  CODING: [
    { key: "errorHandling", label: "Error Handling", type: "toggle", defaultChecked: false },
    { key: "includeTests", label: "Include Tests", type: "toggle", defaultChecked: false },
  ],
  WRITING: [
    { key: "length", label: "Length", type: "slider", min: 0, max: 100, defaultValue: 50, minLabel: "Short", maxLabel: "Long" },
    {
      key: "audience",
      label: "Audience",
      type: "select",
      options: [
        { value: "general", label: "General" },
        { value: "technical", label: "Technical" },
        { value: "executive", label: "Executive" },
        { value: "casual", label: "Casual" },
      ],
      defaultOption: "general",
    },
  ],
  RESEARCH: [
    { key: "depth", label: "Depth", type: "slider", min: 0, max: 100, defaultValue: 50, minLabel: "Overview", maxLabel: "Deep Dive" },
    { key: "sourcesRequired", label: "Sources Required", type: "toggle", defaultChecked: false },
  ],
  BUSINESS: [
    { key: "formality", label: "Formality", type: "slider", min: 0, max: 100, defaultValue: 50, minLabel: "Informal", maxLabel: "Formal" },
    { key: "includeMetrics", label: "Include Metrics", type: "toggle", defaultChecked: false },
  ],
  CREATIVE: [
    { key: "creativity", label: "Creativity", type: "slider", min: 0, max: 100, defaultValue: 50, minLabel: "Conservative", maxLabel: "Experimental" },
    { key: "constraints", label: "Use Constraints", type: "toggle", defaultChecked: false },
  ],
  EDUCATIONAL: [
    {
      key: "learnerLevel",
      label: "Learner Level",
      type: "select",
      options: [
        { value: "beginner", label: "Beginner" },
        { value: "intermediate", label: "Intermediate" },
        { value: "advanced", label: "Advanced" },
      ],
      defaultOption: "beginner",
    },
    { key: "includeAssessment", label: "Include Assessment", type: "toggle", defaultChecked: false },
  ],
};
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/
git commit -m "feat: add React hooks for session flow, anonymous ID, clipboard, and steering dials config"
```

---

## Task 7: Shared UI Components

**Files:**
- Create: `apps/web/components/header.tsx`
- Create: `apps/web/components/context-bar.tsx`
- Create: `apps/web/components/copy-button.tsx`
- Create: `apps/web/components/mode-toggle.tsx`

- [ ] **Step 1: Create header component**

Create `apps/web/components/header.tsx`:

```tsx
"use client";

import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">Prompt Engineer</h1>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Create context bar component**

Create `apps/web/components/context-bar.tsx`:

```tsx
"use client";

import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ContextBarProps {
  rawPrompt: string;
  category?: string | null;
  targetModel?: string;
  onBack: () => void;
}

export function ContextBar({
  rawPrompt,
  category,
  targetModel,
  onBack,
}: ContextBarProps) {
  const truncated =
    rawPrompt.length > 80 ? rawPrompt.slice(0, 80) + "..." : rawPrompt;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back</span>
      </button>
      <span className="text-zinc-300">|</span>
      <span className="text-zinc-600 truncate flex-1">{truncated}</span>
      {category && (
        <Badge variant="secondary" className="text-xs">
          {category}
        </Badge>
      )}
      {targetModel && (
        <Badge variant="outline" className="text-xs">
          {targetModel}
        </Badge>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create copy button component**

Create `apps/web/components/copy-button.tsx`:

```tsx
"use client";

import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopyClipboard } from "@/lib/hooks/use-copy-clipboard";

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const { copied, copy } = useCopyClipboard();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => copy(text)}
      className={className}
    >
      {copied ? (
        <>
          <Check className="mr-1.5 h-4 w-4" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="mr-1.5 h-4 w-4" />
          Copy
        </>
      )}
    </Button>
  );
}
```

- [ ] **Step 4: Create mode toggle component**

Create `apps/web/components/mode-toggle.tsx`:

```tsx
"use client";

import type { PromptMode } from "@prompt-engineer/validators";

interface ModeToggleProps {
  mode: PromptMode;
  onChange: (mode: PromptMode) => void;
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-zinc-500">Mode:</span>
      <div className="flex rounded-md border border-zinc-200">
        <button
          onClick={() => onChange("quick")}
          className={`px-3 py-1 text-sm transition-colors ${
            mode === "quick"
              ? "bg-zinc-900 text-white"
              : "text-zinc-600 hover:bg-zinc-50"
          } rounded-l-md`}
        >
          Quick
        </button>
        <button
          onClick={() => onChange("detailed")}
          className={`px-3 py-1 text-sm transition-colors ${
            mode === "detailed"
              ? "bg-zinc-900 text-white"
              : "text-zinc-600 hover:bg-zinc-50"
          } rounded-r-md`}
        >
          Detailed
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/
git commit -m "feat: add shared UI components — header, context bar, copy button, mode toggle"
```

---

## Task 8: Screen 1 — Prompt Input + Steering Controls

**Files:**
- Create: `apps/web/components/prompt-input.tsx`
- Create: `apps/web/components/target-model-select.tsx`
- Create: `apps/web/components/task-type-tags.tsx`
- Create: `apps/web/components/steering-dials.tsx`

- [ ] **Step 1: Create target model select component**

Create `apps/web/components/target-model-select.tsx`:

```tsx
"use client";

import type { TargetModel } from "@prompt-engineer/validators";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MODEL_OPTIONS: { value: TargetModel; label: string }[] = [
  { value: "claude", label: "Claude (Anthropic)" },
  { value: "gpt-4", label: "GPT-4 (OpenAI)" },
  { value: "gemini", label: "Gemini (Google)" },
  { value: "llama", label: "Llama (Meta)" },
  { value: "mistral", label: "Mistral" },
  { value: "other", label: "Other" },
];

interface TargetModelSelectProps {
  value: TargetModel;
  onChange: (value: TargetModel) => void;
}

export function TargetModelSelect({ value, onChange }: TargetModelSelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-700">
        Target AI Model
      </label>
      <Select value={value} onValueChange={(v) => onChange(v as TargetModel)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MODEL_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 2: Create task type tags component**

Create `apps/web/components/task-type-tags.tsx`:

```tsx
"use client";

import type { PromptCategory } from "@prompt-engineer/validators";
import { cn } from "@/lib/utils";

const CATEGORIES: { value: PromptCategory; label: string }[] = [
  { value: "WRITING", label: "Writing" },
  { value: "CODING", label: "Coding" },
  { value: "RESEARCH", label: "Research" },
  { value: "BUSINESS", label: "Business" },
  { value: "CREATIVE", label: "Creative" },
  { value: "EDUCATIONAL", label: "Educational" },
];

interface TaskTypeTagsProps {
  selected: PromptCategory | undefined;
  onChange: (category: PromptCategory | undefined) => void;
}

export function TaskTypeTags({ selected, onChange }: TaskTypeTagsProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-700">
        Task Type <span className="font-normal text-zinc-400">(optional)</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() =>
              onChange(selected === cat.value ? undefined : cat.value)
            }
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              selected === cat.value
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create steering dials component**

Create `apps/web/components/steering-dials.tsx`:

```tsx
"use client";

import type { PromptCategory, SteeringInputs } from "@prompt-engineer/validators";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UNIVERSAL_DIALS, CATEGORY_DIALS, type DialDefinition } from "@/lib/steering-dials";

interface SteeringDialsProps {
  steeringInputs: SteeringInputs;
  onChange: (inputs: SteeringInputs) => void;
}

export function SteeringDials({ steeringInputs, onChange }: SteeringDialsProps) {
  const categoryDials = steeringInputs.taskType
    ? CATEGORY_DIALS[steeringInputs.taskType]
    : [];

  const handleUniversalSlider = (key: string, value: number[]) => {
    onChange({ ...steeringInputs, [key]: value[0] });
  };

  const handleCategoryDial = (key: string, value: number | boolean | string) => {
    onChange({
      ...steeringInputs,
      categoryDials: { ...steeringInputs.categoryDials, [key]: value },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Universal dials */}
      {UNIVERSAL_DIALS.map((dial) => (
        <SliderDial
          key={dial.key}
          dial={dial}
          value={(steeringInputs[dial.key as keyof SteeringInputs] as number) ?? dial.defaultValue ?? 50}
          onChange={(v) => handleUniversalSlider(dial.key, v)}
        />
      ))}

      {/* Category-specific dials */}
      {categoryDials.length > 0 && (
        <div className="border-t border-zinc-100 pt-4 flex flex-col gap-4">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            {steeringInputs.taskType} options
          </span>
          {categoryDials.map((dial) => (
            <DialControl
              key={dial.key}
              dial={dial}
              value={steeringInputs.categoryDials?.[dial.key]}
              onChange={(v) => handleCategoryDial(dial.key, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SliderDial({
  dial,
  value,
  onChange,
}: {
  dial: DialDefinition;
  value: number;
  onChange: (value: number[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-zinc-700">{dial.label}</label>
        <span className="text-xs text-zinc-400">{value}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-400 w-16 text-right">{dial.minLabel}</span>
        <Slider
          value={[value]}
          onValueChange={onChange}
          min={dial.min ?? 0}
          max={dial.max ?? 100}
          step={1}
          className="flex-1"
        />
        <span className="text-xs text-zinc-400 w-16">{dial.maxLabel}</span>
      </div>
    </div>
  );
}

function DialControl({
  dial,
  value,
  onChange,
}: {
  dial: DialDefinition;
  value: unknown;
  onChange: (value: number | boolean | string) => void;
}) {
  if (dial.type === "slider") {
    return (
      <SliderDial
        dial={dial}
        value={(value as number) ?? dial.defaultValue ?? 50}
        onChange={(v) => onChange(v[0])}
      />
    );
  }

  if (dial.type === "toggle") {
    const checked = (value as boolean) ?? dial.defaultChecked ?? false;
    return (
      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-sm font-medium text-zinc-700">{dial.label}</span>
        <button
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            checked ? "bg-zinc-900" : "bg-zinc-200"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
              checked ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </label>
    );
  }

  if (dial.type === "select" && dial.options) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700">{dial.label}</label>
        <Select
          value={(value as string) ?? dial.defaultOption}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {dial.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 4: Create prompt input screen component**

Create `apps/web/components/prompt-input.tsx`:

```tsx
"use client";

import type { SteeringInputs, TargetModel, PromptMode } from "@prompt-engineer/validators";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { TargetModelSelect } from "./target-model-select";
import { TaskTypeTags } from "./task-type-tags";
import { SteeringDials } from "./steering-dials";
import { ModeToggle } from "./mode-toggle";
import { Loader2 } from "lucide-react";

interface PromptInputProps {
  rawPrompt: string;
  onRawPromptChange: (value: string) => void;
  targetModel: TargetModel;
  onTargetModelChange: (value: TargetModel) => void;
  steeringInputs: SteeringInputs;
  onSteeringInputsChange: (value: SteeringInputs) => void;
  mode: PromptMode;
  onModeChange: (value: PromptMode) => void;
  onSubmit: () => void;
  isLoading: boolean;
  error: string | null;
}

export function PromptInput({
  rawPrompt,
  onRawPromptChange,
  targetModel,
  onTargetModelChange,
  steeringInputs,
  onSteeringInputsChange,
  mode,
  onModeChange,
  onSubmit,
  isLoading,
  error,
}: PromptInputProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Prompt textarea */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-700">Your Prompt</label>
        <Textarea
          value={rawPrompt}
          onChange={(e) => onRawPromptChange(e.target.value)}
          placeholder="Describe what you want the AI to do..."
          className="min-h-[140px] resize-y text-base"
          disabled={isLoading}
        />
      </div>

      {/* Target model */}
      <TargetModelSelect value={targetModel} onChange={onTargetModelChange} />

      {/* Task type tags */}
      <TaskTypeTags
        selected={steeringInputs.taskType}
        onChange={(taskType) =>
          onSteeringInputsChange({
            ...steeringInputs,
            taskType,
            categoryDials: taskType !== steeringInputs.taskType ? undefined : steeringInputs.categoryDials,
          })
        }
      />

      {/* Steering dials */}
      <SteeringDials
        steeringInputs={steeringInputs}
        onChange={onSteeringInputsChange}
      />

      {/* Mode toggle + submit */}
      <div className="flex items-center justify-between pt-2">
        <ModeToggle mode={mode} onChange={onModeChange} />
        <Button
          onClick={onSubmit}
          disabled={isLoading || !rawPrompt.trim()}
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            "Enhance My Prompt"
          )}
        </Button>
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/
git commit -m "feat: add Screen 1 components — prompt input, target model, task tags, steering dials"
```

---

## Task 9: Screen 2 — Clarification Questions

**Files:**
- Create: `apps/web/components/question-card.tsx`
- Create: `apps/web/components/clarification-questions.tsx`

- [ ] **Step 1: Create question card component**

Create `apps/web/components/question-card.tsx`:

```tsx
"use client";

import type { ClarificationQuestion } from "@prompt-engineer/validators";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface QuestionCardProps {
  question: ClarificationQuestion;
  answer: string | null;
  onChange: (value: string | null) => void;
}

export function QuestionCard({ question, answer, onChange }: QuestionCardProps) {
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-900">{question.question}</p>
          <p className="text-xs text-zinc-500 mt-1">{question.why}</p>
        </div>

        {question.type === "select" && question.options && (
          <Select
            value={answer ?? question.default}
            onValueChange={(v) => onChange(v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {question.options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {question.type === "text" && (
          <Textarea
            value={answer ?? question.default}
            onChange={(e) => onChange(e.target.value)}
            placeholder={question.default}
            className="min-h-[80px] text-sm"
          />
        )}

        {question.type === "scale" && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">1</span>
            <Slider
              value={[parseInt(answer ?? question.default ?? "3", 10)]}
              onValueChange={(v) => onChange(String(v[0]))}
              min={1}
              max={5}
              step={1}
              className="flex-1"
            />
            <span className="text-xs text-zinc-400">5</span>
          </div>
        )}
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Create clarification questions screen component**

Create `apps/web/components/clarification-questions.tsx`:

```tsx
"use client";

import type { ClarificationQuestion } from "@prompt-engineer/validators";
import { Button } from "@/components/ui/button";
import { QuestionCard } from "./question-card";
import { ContextBar } from "./context-bar";
import { Loader2 } from "lucide-react";

interface ClarificationQuestionsProps {
  rawPrompt: string;
  category: string | null;
  targetModel: string;
  questions: ClarificationQuestion[];
  answers: Record<string, string | null>;
  onAnswerChange: (questionId: string, value: string | null) => void;
  onSubmit: () => void;
  onBack: () => void;
  isLoading: boolean;
  error: string | null;
}

export function ClarificationQuestions({
  rawPrompt,
  category,
  targetModel,
  questions,
  answers,
  onAnswerChange,
  onSubmit,
  onBack,
  isLoading,
  error,
}: ClarificationQuestionsProps) {
  const handleSkipRemaining = () => {
    // All defaults are already pre-filled, just submit
    onSubmit();
  };

  return (
    <div className="flex flex-col gap-5">
      <ContextBar
        rawPrompt={rawPrompt}
        category={category}
        targetModel={targetModel}
        onBack={onBack}
      />

      <div className="flex flex-col gap-3">
        {questions.map((q) => (
          <QuestionCard
            key={q.id}
            question={q}
            answer={answers[q.id] ?? null}
            onChange={(value) => onAnswerChange(q.id, value)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handleSkipRemaining}
          className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
          disabled={isLoading}
        >
          Skip remaining & use defaults
        </button>
        <Button onClick={onSubmit} disabled={isLoading} size="lg">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            "Generate Prompt"
          )}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/
git commit -m "feat: add Screen 2 components — question cards and clarification questions"
```

---

## Task 10: Screen 3 — Prompt Result

**Files:**
- Create: `apps/web/components/prompt-result.tsx`

- [ ] **Step 1: Create prompt result screen component**

Create `apps/web/components/prompt-result.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { SynthesisResponse } from "@prompt-engineer/validators";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ContextBar } from "./context-bar";
import { CopyButton } from "./copy-button";
import { ChevronDown, ChevronUp, Pencil, Eye, RotateCcw, RefreshCw } from "lucide-react";

interface PromptResultProps {
  rawPrompt: string;
  category: string | null;
  targetModel: string;
  result: SynthesisResponse;
  onBack: () => void;
  onStartOver: () => void;
}

export function PromptResult({
  rawPrompt,
  category,
  targetModel,
  result,
  onBack,
  onStartOver,
}: PromptResultProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(result.finalPrompt);
  const [changelogOpen, setChangelogOpen] = useState(true);

  const displayPrompt = isEditing ? editedPrompt : result.finalPrompt;

  return (
    <div className="flex flex-col gap-5">
      <ContextBar
        rawPrompt={rawPrompt}
        category={category}
        targetModel={targetModel}
        onBack={onBack}
      />

      {/* Final prompt card */}
      <Card className="relative p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            Enhanced Prompt
          </h2>
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

      {/* Changelog */}
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
            {result.changelog.map((item, i) => (
              <li key={i} className="text-sm text-zinc-600 flex gap-2">
                <span className="text-zinc-400 mt-0.5">-</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button variant="outline" onClick={onStartOver}>
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Start Over
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="outline" disabled>
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                  Regenerate
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Pro feature — coming soon</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/prompt-result.tsx
git commit -m "feat: add Screen 3 component — prompt result with inline editing and changelog"
```

---

## Task 11: Sidebar — Session History

**Files:**
- Create: `apps/web/components/sidebar.tsx`

- [ ] **Step 1: Create sidebar component**

Create `apps/web/components/sidebar.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SessionSummary {
  id: string;
  rawPrompt: string;
  status: string;
  category: string | null;
  createdAt: string;
}

interface SidebarProps {
  isOpen: boolean;
  anonymousId: string | null;
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function Sidebar({
  isOpen,
  anonymousId,
  activeSessionId,
  onSelectSession,
}: SidebarProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  useEffect(() => {
    if (!isOpen || !anonymousId) return;

    const fetchSessions = async () => {
      try {
        const res = await fetch(
          `/api/sessions?anonymousId=${encodeURIComponent(anonymousId)}`
        );
        if (res.ok) {
          const data = await res.json();
          setSessions(
            data.sessions.filter(
              (s: SessionSummary) => s.status === "COMPLETED"
            )
          );
        }
      } catch {
        // Silently fail — sidebar is non-critical
      }
    };

    fetchSessions();
  }, [isOpen, anonymousId]);

  return (
    <aside
      className={cn(
        "border-r border-zinc-200 bg-zinc-50 transition-all duration-200 overflow-hidden flex-shrink-0",
        isOpen ? "w-72" : "w-0"
      )}
    >
      <div className="flex flex-col h-full w-72">
        <div className="px-4 py-3 border-b border-zinc-200">
          <h2 className="text-sm font-semibold text-zinc-700">History</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <p className="px-4 py-8 text-sm text-zinc-400 text-center">
              No sessions yet
            </p>
          ) : (
            <ul className="py-1">
              {sessions.map((session) => (
                <li key={session.id}>
                  <button
                    onClick={() => onSelectSession(session.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-zinc-100 transition-colors",
                      activeSessionId === session.id && "bg-zinc-100"
                    )}
                  >
                    <p className="text-sm text-zinc-800 truncate">
                      {session.rawPrompt || "Untitled"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {session.category && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {session.category}
                        </Badge>
                      )}
                      <span className="text-[10px] text-zinc-400">
                        {timeAgo(session.createdAt)}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/sidebar.tsx
git commit -m "feat: add collapsible session history sidebar"
```

---

## Task 12: Main Page — Wire Everything Together

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Replace the boilerplate page with the full prompt flow**

Replace `apps/web/app/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useAnonymousId } from "@/lib/hooks/use-anonymous-id";
import { useSessionFlow } from "@/lib/hooks/use-session-flow";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { PromptInput } from "@/components/prompt-input";
import { ClarificationQuestions } from "@/components/clarification-questions";
import { PromptResult } from "@/components/prompt-result";

export default function Home() {
  const anonymousId = useAnonymousId();
  const flow = useSessionFlow(anonymousId);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen">
      <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          anonymousId={anonymousId}
          activeSessionId={flow.sessionId}
          onSelectSession={flow.loadSession}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-6 py-10">
            {flow.step === "input" && (
              <PromptInput
                rawPrompt={flow.rawPrompt}
                onRawPromptChange={flow.setRawPrompt}
                targetModel={flow.targetModel}
                onTargetModelChange={flow.setTargetModel}
                steeringInputs={flow.steeringInputs}
                onSteeringInputsChange={flow.setSteeringInputs}
                mode={flow.mode}
                onModeChange={flow.setMode}
                onSubmit={flow.analyze}
                isLoading={flow.isLoading}
                error={flow.error}
              />
            )}

            {flow.step === "questions" && flow.analysisResult && (
              <ClarificationQuestions
                rawPrompt={flow.rawPrompt}
                category={flow.analysisResult.category}
                targetModel={flow.targetModel}
                questions={flow.analysisResult.questions}
                answers={flow.answers}
                onAnswerChange={flow.setAnswer}
                onSubmit={flow.submitAnswers}
                onBack={flow.goBack}
                isLoading={flow.isLoading}
                error={flow.error}
              />
            )}

            {flow.step === "result" && flow.synthesisResult && (
              <PromptResult
                rawPrompt={flow.rawPrompt}
                category={flow.analysisResult?.category ?? null}
                targetModel={flow.targetModel}
                result={flow.synthesisResult}
                onBack={flow.goBack}
                onStartOver={flow.startOver}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat: wire up main page with 3-step prompt flow and sidebar"
```

---

## Task 13: Database Setup & End-to-End Smoke Test

- [ ] **Step 1: Create .env file from .env.example**

```bash
cp .env.example .env
```

Then edit `.env` to set:
- `DATABASE_URL` — your PostgreSQL connection string
- `ANTHROPIC_API_KEY` — your Claude API key

Leave Stripe, Google, Redis, and Sentry values empty.

- [ ] **Step 2: Install dependencies**

```bash
pnpm install
```

- [ ] **Step 3: Generate Prisma client and push schema**

```bash
pnpm db:generate && pnpm db:push
```

Expected: Prisma client generated, schema synced to database.

- [ ] **Step 4: Start the dev server**

```bash
pnpm dev
```

Expected: Next.js dev server starts on http://localhost:3000.

- [ ] **Step 5: Manual smoke test**

1. Open http://localhost:3000
2. Type a rough prompt: "write me an email to my boss about a raise"
3. Select target model: Claude
4. Click a task type tag: Writing
5. Adjust tone slider toward formal
6. Click "Enhance My Prompt"
7. Verify: clarification questions appear
8. Answer or skip questions, click "Generate Prompt"
9. Verify: final prompt appears with changelog
10. Click "Copy" — verify clipboard
11. Open sidebar — verify the session appears in history
12. Click the session in history — verify it loads

- [ ] **Step 6: Fix any issues found during smoke test**

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during smoke test"
```
