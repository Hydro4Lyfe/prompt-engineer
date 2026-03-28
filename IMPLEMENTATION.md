# Prompt Generator — Phased Monorepo Implementation Plan

---

## Monorepo Structure

```
prompt-engineer/
├── package.json                    # Root workspace config
├── tsconfig.json                   # Base TypeScript config
├── .env.example                    # Environment variable template
├── .gitignore
├── turbo.json                      # Turborepo pipeline config
│
├── apps/
│   └── web/                        # Next.js application
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── postcss.config.js
│       │
│       ├── app/                    # Next.js App Router
│       │   ├── layout.tsx          # Root layout (fonts, providers)
│       │   ├── page.tsx            # Landing / main prompt flow
│       │   ├── globals.css         # Tailwind base + custom tokens
│       │   │
│       │   ├── (app)/              # Authenticated app routes (route group)
│       │   │   ├── layout.tsx      # App shell with nav
│       │   │   ├── history/
│       │   │   │   └── page.tsx    # Prompt history list
│       │   │   └── session/
│       │   │       └── [id]/
│       │   │           └── page.tsx # View a past session
│       │   │
│       │   └── api/                # API route handlers
│       │       ├── sessions/
│       │       │   ├── route.ts              # POST (create), GET (list)
│       │       │   └── [id]/
│       │       │       ├── route.ts           # GET (read), DELETE
│       │       │       ├── analyze/
│       │       │       │   └── route.ts       # POST — analyze prompt
│       │       │       ├── answers/
│       │       │       │   └── route.ts       # POST — submit answers
│       │       │       └── regen/
│       │       │           └── route.ts       # POST — regenerate
│       │       ├── auth/
│       │       │   └── [...nextauth]/
│       │       │       └── route.ts           # NextAuth handler
│       │       ├── billing/
│       │       │   ├── checkout/
│       │       │   │   └── route.ts           # POST — create Stripe checkout
│       │       │   ├── portal/
│       │       │   │   └── route.ts           # POST — Stripe customer portal
│       │       │   └── webhook/
│       │       │       └── route.ts           # POST — Stripe webhook handler
│       │       └── user/
│       │           └── usage/
│       │               └── route.ts           # GET — usage stats + tier info
│       │
│       ├── components/             # React components
│       │   ├── ui/                 # shadcn/ui primitives (button, card, etc.)
│       │   ├── prompt-input.tsx    # Screen 1: rough prompt textarea
│       │   ├── mode-toggle.tsx     # Quick / Detailed switch
│       │   ├── clarification-questions.tsx  # Screen 2: question cards
│       │   ├── question-card.tsx   # Individual question (select/text/scale)
│       │   ├── prompt-result.tsx   # Screen 3: final prompt display
│       │   ├── changelog-panel.tsx # Collapsible improvement list
│       │   ├── copy-button.tsx     # Copy-to-clipboard with toast
│       │   ├── loading-states.tsx  # Skeleton / spinner components
│       │   ├── session-list.tsx    # History list component
│       │   ├── upgrade-banner.tsx  # Upsell when free limits hit
│       │   └── usage-meter.tsx     # Visual usage bar by tier
│       │
│       └── lib/                    # App-specific utilities
│           ├── hooks/
│           │   ├── use-session-flow.ts   # State machine for the 3-step flow
│           │   └── use-copy-clipboard.ts # Clipboard hook
│           └── utils.ts            # cn() helper, formatters
│
├── packages/
│   ├── db/                         # Database layer
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # Full Prisma schema
│   │   │   └── migrations/         # Generated migration files
│   │   ├── src/
│   │   │   ├── index.ts            # Export prisma client instance
│   │   │   └── client.ts           # Singleton PrismaClient
│   │   └── seed.ts                 # Seed script (dev data)
│   │
│   ├── ai/                         # Model abstraction layer
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts            # getModelProvider() export
│   │       ├── types.ts            # ModelRequest, ModelResponse, ModelProvider
│   │       ├── providers/
│   │       │   ├── claude.ts       # ClaudeProvider (Anthropic SDK)
│   │       │   └── openai.ts       # OpenAIProvider (future fallback)
│   │       ├── retry.ts            # Retry logic with exponential backoff
│   │       └── json-parse.ts       # Robust JSON extraction from LLM output
│   │
│   ├── services/                   # Backend service layer
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts            # Re-export all services
│   │       ├── session.service.ts  # Session CRUD + state transitions
│   │       ├── analysis.service.ts # Prompt analysis orchestration
│   │       ├── synthesis.service.ts # Prompt synthesis orchestration
│   │       ├── usage.service.ts    # Token tracking + tier-based limits
│   │       ├── billing.service.ts  # Stripe checkout, portal, webhook handling
│   │       ├── tier.ts            # Tier definitions, limits, feature flags
│   │       └── errors.ts          # Typed service errors
│   │
│   ├── prompts/                    # System prompt templates
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts            # Export all prompt builders
│   │       ├── analysis.prompt.ts  # Analysis system prompt
│   │       ├── synthesis.prompt.ts # Synthesis system prompt
│   │       └── types.ts           # Shared types (AnalysisResult, etc.)
│   │
│   └── validators/                 # Shared validation (Zod schemas)
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── session.schema.ts   # analyzeInput, answersInput schemas
│           ├── billing.schema.ts   # checkout, tier, webhook schemas
│           └── common.schema.ts    # Shared enums, base types
│
└── tooling/                        # Dev tooling configs
    ├── eslint/
    │   └── base.js                 # Shared ESLint config
    └── typescript/
        └── base.json               # Shared tsconfig base
```

### Why This Structure

**`packages/services/`** is the critical layer. API routes become thin handlers — they validate input, call a service method, return the result. All business logic lives in services, making it testable without HTTP, reusable across routes, and easy to reason about.

**`packages/ai/`** owns every model interaction. No other package imports `@anthropic-ai/sdk` directly. This is the only place you'd touch to swap providers.

**`packages/prompts/`** is separated from services because prompt templates change frequently during tuning. Isolating them means you can iterate on prompt quality without touching business logic.

**`packages/validators/`** shares Zod schemas between frontend (form validation) and backend (request validation). Single source of truth for what constitutes valid input.

---

## API Contracts

Every endpoint uses strict TypeScript types shared through `packages/validators/`. Below are the complete contracts.

### Shared Types (`packages/validators/src/session.schema.ts`)

```typescript
import { z } from "zod";

// ── Enums ──────────────────────────────────────────────

export const PromptMode = z.enum(["quick", "detailed"]);
export type PromptMode = z.infer<typeof PromptMode>;

export const PromptCategory = z.enum([
  "WRITING", "CODING", "RESEARCH", "BUSINESS", "CREATIVE", "EDUCATIONAL"
]);
export type PromptCategory = z.infer<typeof PromptCategory>;

export const SessionStatus = z.enum([
  "CREATED", "ANALYZING", "QUESTIONS_READY",
  "ANSWERS_SUBMITTED", "GENERATING", "COMPLETED", "FAILED"
]);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const UserTier = z.enum(["FREE", "PRO", "TEAM"]);
export type UserTier = z.infer<typeof UserTier>;

// ── Question Types ─────────────────────────────────────

export const QuestionType = z.enum(["select", "text", "scale"]);

export const ClarificationQuestion = z.object({
  id:       z.string(),
  question: z.string(),
  why:      z.string(),
  default:  z.string(),
  priority: z.number().int().min(1).max(5),
  type:     QuestionType,
  options:  z.array(z.string()).optional(),
});
export type ClarificationQuestion = z.infer<typeof ClarificationQuestion>;

// ── Request Schemas ────────────────────────────────────

export const AnalyzeInput = z.object({
  rawPrompt: z.string().min(1).max(5000),
  mode:      PromptMode.optional(),
});
export type AnalyzeInput = z.infer<typeof AnalyzeInput>;

export const AnswersInput = z.object({
  answers: z.record(z.string(), z.string().nullable()),
});
export type AnswersInput = z.infer<typeof AnswersInput>;

export const RegenInput = z.object({
  emphasis: z.string().max(500).optional(),
});
export type RegenInput = z.infer<typeof RegenInput>;

// ── Billing Schemas ───────────────────────────────────

export const CheckoutInput = z.object({
  tier: z.enum(["PRO", "TEAM"]),       // can't "buy" free
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});
export type CheckoutInput = z.infer<typeof CheckoutInput>;

export const CheckoutResponse = z.object({
  checkoutUrl: z.string().url(),
});
export type CheckoutResponse = z.infer<typeof CheckoutResponse>;

export const PortalResponse = z.object({
  portalUrl: z.string().url(),
});
export type PortalResponse = z.infer<typeof PortalResponse>;

export const ListSessionsInput = z.object({
  cursor: z.string().optional(),
  limit:  z.number().int().min(1).max(50).default(20),
});
export type ListSessionsInput = z.infer<typeof ListSessionsInput>;

// ── Response Schemas ───────────────────────────────────

export const AnalysisResponse = z.object({
  intent:           z.string(),
  category:         PromptCategory,
  suggestedMode:    PromptMode,
  detectedElements: z.array(z.string()),
  missingElements:  z.array(z.string()),
  questions:        z.array(ClarificationQuestion),
});
export type AnalysisResponse = z.infer<typeof AnalysisResponse>;

export const SynthesisResponse = z.object({
  finalPrompt: z.string(),
  changelog:   z.array(z.string()),
  metadata: z.object({
    category:   PromptCategory,
    tokensUsed: z.number(),
    modelUsed:  z.string(),
  }),
});
export type SynthesisResponse = z.infer<typeof SynthesisResponse>;

export const SessionResponse = z.object({
  id:               z.string(),
  rawPrompt:        z.string().nullable(),
  mode:             PromptMode,
  status:           SessionStatus,
  category:         PromptCategory.nullable(),
  intent:           z.string().nullable(),
  detectedElements: z.array(z.string()).nullable(),
  questions:        z.array(ClarificationQuestion).nullable(),
  answers:          z.record(z.string(), z.string().nullable()).nullable(),
  finalPrompt:      z.string().nullable(),
  changelog:        z.array(z.string()).nullable(),
  tokensUsed:       z.number().nullable(),
  createdAt:        z.string().datetime(),
  updatedAt:        z.string().datetime(),
});
export type SessionResponse = z.infer<typeof SessionResponse>;

export const UsageResponse = z.object({
  tier:             UserTier,
  tokensUsedToday:  z.number(),
  tokensUsedMonth:  z.number(),
  sessionsToday:    z.number(),
  sessionsMonth:    z.number(),
  limits: z.object({
    dailySessions:  z.number(),
    monthlySessions: z.number(),
    dailyTokens:    z.number(),
    monthlyTokens:  z.number(),
    detailedMode:   z.boolean(),
    history:        z.boolean(),
  }),
  stripe: z.object({
    customerId:      z.string().nullable(),
    subscriptionId:  z.string().nullable(),
    currentPeriodEnd: z.string().datetime().nullable(),
  }).optional(),
});
export type UsageResponse = z.infer<typeof UsageResponse>;

export const ErrorResponse = z.object({
  error:   z.string(),
  code:    z.string().optional(),
  details: z.unknown().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;
```

### Endpoint Contracts

---

#### `POST /api/sessions` — Create Session

```
Auth:     Optional (anonymous = FREE tier limits)
Rate:     FREE: 5/day, PRO: unlimited, TEAM: unlimited

Request:  (empty body)

Response: 201 Created
{
  "id": "clx9abc123def",
  "status": "CREATED",
  "mode": "quick",
  "createdAt": "2026-03-22T10:00:00.000Z"
}

Errors:
  429  Rate/tier limit exceeded — returns upgrade prompt for FREE users
  500  Internal server error
```

---

#### `GET /api/sessions` — List Sessions

```
Auth:     Required
Rate:     100/hour

Query:
  ?cursor=clx9abc123def    (pagination cursor, optional)
  &limit=20                (1-50, default 20)

Response: 200 OK
{
  "sessions": [
    {
      "id": "clx9abc123def",
      "rawPrompt": "write a blog post about AI",
      "status": "COMPLETED",
      "category": "WRITING",
      "createdAt": "2026-03-22T10:00:00.000Z"
    }
  ],
  "nextCursor": "clx8xyz789ghi" | null
}

Errors:
  401  Unauthorized
```

---

#### `GET /api/sessions/:id` — Get Session

```
Auth:     Required (must own session)
Rate:     100/hour

Response: 200 OK
          Full SessionResponse object (see schema above)

Errors:
  401  Unauthorized
  403  Forbidden (not owner)
  404  Session not found
```

---

#### `POST /api/sessions/:id/analyze` — Analyze Prompt

```
Auth:     Optional (anonymous = FREE tier limits)
Rate:     FREE: 5 sessions/day, PRO/TEAM: token-based limits

Request:
{
  "rawPrompt": "write a blog post about AI",   // 1-5000 chars, required
  "mode": "quick"                                // optional, auto-detected
}

Response: 200 OK
{
  "intent": "Create a blog post covering artificial intelligence",
  "category": "WRITING",
  "suggestedMode": "quick",
  "detectedElements": ["topic: AI", "format: blog post"],
  "missingElements": ["target audience", "tone", "length", "specific angle"],
  "questions": [
    {
      "id": "q1",
      "question": "Who is the target reader?",
      "why": "A post for executives reads very differently than one for developers",
      "type": "select",
      "options": ["General audience", "Tech professionals", "Business executives", "Students"],
      "default": "General audience",
      "priority": 1
    },
    {
      "id": "q2",
      "question": "What's the primary goal of this post?",
      "why": "An educational post needs different structure than a persuasive one",
      "type": "select",
      "options": ["Inform/educate", "Persuade/argue a position", "Entertain", "Tutorial/how-to"],
      "default": "Inform/educate",
      "priority": 1
    },
    {
      "id": "q3",
      "question": "What tone should it have?",
      "why": "Tone sets reader expectations and affects engagement",
      "type": "select",
      "options": ["Casual/conversational", "Professional", "Academic", "Witty/engaging"],
      "default": "Professional",
      "priority": 2
    }
  ]
}

Errors:
  400  Validation error (missing/invalid rawPrompt)
  404  Session not found
  403  Detailed mode requires PRO tier
  409  Session already analyzed (status != CREATED)
  429  Rate/tier limit exceeded
  500  Analysis failed (model error)
```

---

#### `POST /api/sessions/:id/answers` — Submit Answers + Generate

```
Auth:     Optional (anonymous = FREE tier)
Rate:     Tier-based (counted as part of session)

Request:
{
  "answers": {
    "q1": "Tech professionals",
    "q2": "Inform/educate",
    "q3": null                    // null = skipped, use default
  }
}

Response: 200 OK
{
  "finalPrompt": "You are a tech journalist known for making complex topics...",
  "changelog": [
    "Added target audience: tech professionals",
    "Set tone to professional with accessible language",
    "Added structure: intro hook, 3 key sections, practical takeaway",
    "Specified length (~1000 words) with skimmable format"
  ],
  "metadata": {
    "category": "WRITING",
    "tokensUsed": 847,
    "modelUsed": "claude-sonnet-4-6"
  }
}

Errors:
  400  Validation error (answer IDs don't match session questions)
  404  Session not found
  409  Session not in QUESTIONS_READY state
  429  Rate limit exceeded
  500  Synthesis failed (model error)
```

---

#### `POST /api/sessions/:id/regen` — Regenerate Prompt

```
Auth:     Required (PRO/TEAM only — FREE users see upgrade prompt)
Rate:     Tier-based

Request:
{
  "emphasis": "make it more concise"   // optional guidance for regen
}

Response: 200 OK
          Same shape as answers response (SynthesisResponse)

Errors:
  404  Session not found
  409  Session not in COMPLETED state
  429  Rate limit exceeded
```

---

#### `DELETE /api/sessions/:id` — Delete Session

```
Auth:     Required (must own session)

Response: 204 No Content

Errors:
  401  Unauthorized
  403  Forbidden
  404  Not found
```

---

#### `GET /api/user/usage` — Usage Stats + Tier Info

```
Auth:     Required

Response: 200 OK
{
  "tier": "PRO",
  "tokensUsedToday": 4230,
  "tokensUsedMonth": 89400,
  "sessionsToday": 12,
  "sessionsMonth": 245,
  "limits": {
    "dailySessions": -1,          // -1 = unlimited
    "monthlySessions": -1,
    "dailyTokens": 200000,
    "monthlyTokens": 5000000,
    "detailedMode": true,
    "history": true
  },
  "stripe": {
    "customerId": "cus_abc123",
    "subscriptionId": "sub_xyz789",
    "currentPeriodEnd": "2026-04-22T00:00:00.000Z"
  }
}
```

---

#### `POST /api/billing/checkout` — Create Stripe Checkout Session

```
Auth:     Required

Request:
{
  "tier": "PRO",
  "successUrl": "https://app.example.com/billing?success=true",
  "cancelUrl": "https://app.example.com/billing?canceled=true"
}

Response: 200 OK
{
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_live_..."
}

Errors:
  400  Already on requested tier
  401  Unauthorized
```

Frontend redirects the user to `checkoutUrl`. Stripe handles the payment form.
After payment, Stripe fires a webhook → backend upgrades the user's tier.

---

#### `POST /api/billing/portal` — Stripe Customer Portal

```
Auth:     Required (must have active subscription)

Request:  (empty body)

Response: 200 OK
{
  "portalUrl": "https://billing.stripe.com/p/session/..."
}

Errors:
  401  Unauthorized
  404  No active subscription
```

Portal lets users: change plan, update payment method, cancel, view invoices.
All managed by Stripe — zero custom UI needed.

---

#### `POST /api/billing/webhook` — Stripe Webhook Handler

```
Auth:     Stripe signature verification (not user auth)
Headers:  stripe-signature: t=...,v1=...

Request:  Raw Stripe event body (do NOT parse as JSON before verification)

Handled events:
  checkout.session.completed     → Activate subscription, set tier
  customer.subscription.updated  → Tier change (upgrade/downgrade)
  customer.subscription.deleted  → Revert to FREE tier
  invoice.payment_failed         → Flag account, send warning email

Response: 200 OK { "received": true }
```

---

## Tier System

### Tier Definitions

| | FREE | PRO ($10/mo) | TEAM ($15/user/mo) |
|---|---|---|---|
| **Sessions/day** | 5 | Unlimited | Unlimited |
| **Sessions/month** | 50 | Unlimited | Unlimited |
| **Daily tokens** | 12,500 (~5 sessions) | 200,000 (~80 sessions) | 200,000/user |
| **Monthly tokens** | 125,000 | 5,000,000 | 5,000,000/user |
| **Quick mode** | Yes | Yes | Yes |
| **Detailed mode** | No | Yes | Yes |
| **Regenerate** | No | Yes | Yes |
| **Prompt history** | Last 10 | Unlimited | Unlimited |
| **Inline edit** | No | Yes | Yes |

### How Tiers Are Enforced

Enforcement happens in two places:

1. **`UsageService.checkLimits()`** — called before every model API call. Reads the user's tier, checks session/token counts against tier limits, throws `TIER_LIMIT_EXCEEDED` if over.

2. **Frontend feature gating** — the `/api/user/usage` response includes a `limits` object. The frontend reads `limits.detailedMode`, `limits.history`, etc. to show/hide UI and display upgrade prompts. This is a UX convenience, not a security boundary — the backend always enforces.

### Revenue Math

- Cost per session: ~$0.02
- Free tier: 50 sessions/month = $1.00/month per free user
- PRO at $10/month: profitable unless user exceeds ~500 sessions/month (won't happen)
- Break-even: ~23 Pro subscribers cover 1,000 free users

---

## Service Layer Design

The service layer is the brain of the backend. API routes are thin wrappers — validate, call service, return response.

### Service Architecture

```
API Route (thin handler)
  │
  ├── validates request body (Zod schema)
  ├── extracts auth context (optional)
  │
  └── calls Service method
        │
        ├── enforces business rules (state transitions, ownership)
        ├── orchestrates dependencies (AI provider, DB)
        ├── handles errors (typed, catchable)
        │
        └── returns typed result
```

### `session.service.ts` — Session Lifecycle

```typescript
// packages/services/src/session.service.ts

import { prisma } from "@prompt-engineer/db";
import type { SessionStatus, PromptMode } from "@prompt-engineer/validators";
import { ServiceError } from "./errors";

export class SessionService {

  // ── Create ────────────────────────────────────────────

  async create(userId?: string): Promise<{ id: string }> {
    const session = await prisma.promptSession.create({
      data: {
        rawPrompt: "",
        mode: "QUICK",
        status: "CREATED",
        ...(userId && { userId }),
      },
      select: { id: true },
    });
    return session;
  }

  // ── Read ──────────────────────────────────────────────

  async getById(id: string, userId?: string) {
    const session = await prisma.promptSession.findUnique({
      where: { id },
    });
    if (!session) throw new ServiceError("SESSION_NOT_FOUND", 404);
    if (userId && session.userId && session.userId !== userId) {
      throw new ServiceError("FORBIDDEN", 403);
    }
    return session;
  }

  async list(userId: string, cursor?: string, limit = 20) {
    const sessions = await prisma.promptSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,   // fetch one extra for cursor
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

  // ── State Transitions ─────────────────────────────────

  async transitionTo(id: string, status: SessionStatus, data?: Record<string, unknown>) {
    // Validate legal transitions
    const session = await prisma.promptSession.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!session) throw new ServiceError("SESSION_NOT_FOUND", 404);

    const allowed = VALID_TRANSITIONS[session.status as string];
    if (!allowed?.includes(status)) {
      throw new ServiceError(
        "INVALID_TRANSITION",
        409,
        `Cannot transition from ${session.status} to ${status}`
      );
    }

    return prisma.promptSession.update({
      where: { id },
      data: { status, ...data },
    });
  }

  // ── Delete ────────────────────────────────────────────

  async delete(id: string, userId: string) {
    const session = await this.getById(id, userId);
    await prisma.promptSession.delete({ where: { id: session.id } });
  }
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  CREATED:           ["ANALYZING"],
  ANALYZING:         ["QUESTIONS_READY", "FAILED"],
  QUESTIONS_READY:   ["ANSWERS_SUBMITTED"],
  ANSWERS_SUBMITTED: ["GENERATING"],
  GENERATING:        ["COMPLETED", "FAILED"],
  COMPLETED:         ["GENERATING"],  // allows regen
  FAILED:            ["ANALYZING"],   // allows retry
};
```

### `analysis.service.ts` — Prompt Analysis

```typescript
// packages/services/src/analysis.service.ts

import { getModelProvider } from "@prompt-engineer/ai";
import { buildAnalysisPrompt } from "@prompt-engineer/prompts";
import { safeJsonParse } from "@prompt-engineer/ai/json-parse";
import type { AnalysisResponse, PromptMode } from "@prompt-engineer/validators";
import { SessionService } from "./session.service";
import { UsageService } from "./usage.service";
import { ServiceError } from "./errors";

export class AnalysisService {
  constructor(
    private sessions: SessionService,
    private usage: UsageService,
  ) {}

  async analyze(
    sessionId: string,
    rawPrompt: string,
    mode?: PromptMode,
    userId?: string,
  ): Promise<AnalysisResponse> {

    // 1. Check rate limits and tier
    if (userId) {
      await this.usage.checkLimits(userId);
      // Gate detailed mode behind PRO tier
      if (mode === "detailed") {
        await this.usage.requireFeature(userId, "detailedMode");
      }
    } else {
      // Anonymous users are forced to quick mode
      mode = "quick";
    }

    // 2. Transition session to ANALYZING
    await this.sessions.transitionTo(sessionId, "ANALYZING", { rawPrompt });

    try {
      // 3. Call model
      const provider = getModelProvider();
      const systemPrompt = buildAnalysisPrompt();
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

      // 7. Track usage (session count + tokens)
      if (userId) {
        await this.usage.recordSession(userId, response.tokensUsed.total);
      }

      return result;

    } catch (error) {
      // On failure, transition to FAILED so user can retry
      await this.sessions.transitionTo(sessionId, "FAILED").catch(() => {});
      throw error;
    }
  }
}
```

### `synthesis.service.ts` — Prompt Generation

```typescript
// packages/services/src/synthesis.service.ts

import { getModelProvider } from "@prompt-engineer/ai";
import { buildSynthesisPrompt } from "@prompt-engineer/prompts";
import { safeJsonParse } from "@prompt-engineer/ai/json-parse";
import type {
  SynthesisResponse,
  ClarificationQuestion,
} from "@prompt-engineer/validators";
import { SessionService } from "./session.service";
import { UsageService } from "./usage.service";
import { ServiceError } from "./errors";

export class SynthesisService {
  constructor(
    private sessions: SessionService,
    private usage: UsageService,
  ) {}

  async synthesize(
    sessionId: string,
    answers: Record<string, string | null>,
    userId?: string,
  ): Promise<SynthesisResponse> {

    // 1. Load session and validate state
    const session = await this.sessions.getById(sessionId, userId);
    const questions = session.questions as ClarificationQuestion[];
    if (!questions || !session.rawPrompt) {
      throw new ServiceError("SESSION_NOT_ANALYZED", 409);
    }

    // 2. Validate answer IDs match question IDs
    const questionIds = new Set(questions.map((q) => q.id));
    for (const key of Object.keys(answers)) {
      if (!questionIds.has(key)) {
        throw new ServiceError(
          "INVALID_ANSWER_ID",
          400,
          `Unknown question ID: ${key}`
        );
      }
    }

    // 3. Transition: ANSWERS_SUBMITTED → GENERATING
    await this.sessions.transitionTo(sessionId, "ANSWERS_SUBMITTED", { answers });
    await this.sessions.transitionTo(sessionId, "GENERATING");

    try {
      // 4. Build Q&A context
      const qaContext = questions
        .map((q) => {
          const answer = answers[q.id];
          const effective = answer ?? `${q.default} (default)`;
          return `Q: ${q.question}\nA: ${effective}`;
        })
        .join("\n\n");

      const userMessage = [
        `Original rough prompt:\n"${session.rawPrompt}"`,
        `\nClarification Q&A:\n${qaContext}`,
        `\nGenerate the optimized prompt.`,
      ].join("\n");

      // 5. Call model
      const provider = getModelProvider();
      const response = await provider.generate({
        systemPrompt: buildSynthesisPrompt(),
        userMessage,
        temperature: 0.6,
        maxTokens: 3000,
        responseFormat: "json",
      });

      // 6. Parse response
      const result = safeJsonParse<{ finalPrompt: string; changelog: string[] }>(
        response.content
      );
      if (!result) {
        throw new ServiceError("MODEL_INVALID_RESPONSE", 500);
      }

      // 7. Build full response
      const synthesisResponse: SynthesisResponse = {
        finalPrompt: result.finalPrompt,
        changelog: result.changelog,
        metadata: {
          category: session.category!,
          tokensUsed: response.tokensUsed.total,
          modelUsed: response.model,
        },
      };

      // 8. Persist and complete
      await this.sessions.transitionTo(sessionId, "COMPLETED", {
        finalPrompt: result.finalPrompt,
        changelog: result.changelog,
        tokensUsed: response.tokensUsed.total,
        modelUsed: response.model,
      });

      if (userId) {
        await this.usage.recordTokens(userId, response.tokensUsed.total);
      }

      return synthesisResponse;

    } catch (error) {
      await this.sessions.transitionTo(sessionId, "FAILED").catch(() => {});
      throw error;
    }
  }

  async regenerate(
    sessionId: string,
    emphasis?: string,
    userId?: string,
  ): Promise<SynthesisResponse> {
    // Regeneration is a PRO/TEAM feature
    if (userId) {
      await this.usage.requireFeature(userId, "regenerate");
      await this.usage.checkLimits(userId);
    } else {
      throw new ServiceError("FEATURE_NOT_AVAILABLE", 403,
        "Sign in and upgrade to Pro to regenerate prompts."
      );
    }

    const session = await this.sessions.getById(sessionId, userId);
    if (session.status !== "COMPLETED") {
      throw new ServiceError("SESSION_NOT_COMPLETED", 409);
    }

    // Re-run synthesis with stored answers, optionally adding emphasis
    const answers = session.answers as Record<string, string | null>;

    // Transition back to GENERATING (allowed from COMPLETED)
    await this.sessions.transitionTo(sessionId, "GENERATING");

    // Modify the raw prompt with emphasis if provided
    const rawPrompt = emphasis
      ? `${session.rawPrompt}\n\nAdditional guidance: ${emphasis}`
      : session.rawPrompt;

    // Build and call — same flow as synthesize but with tweaked input
    const questions = session.questions as ClarificationQuestion[];
    const qaContext = questions
      .map((q) => {
        const answer = answers[q.id];
        const effective = answer ?? `${q.default} (default)`;
        return `Q: ${q.question}\nA: ${effective}`;
      })
      .join("\n\n");

    const provider = getModelProvider();
    const response = await provider.generate({
      systemPrompt: buildSynthesisPrompt(),
      userMessage: `Original rough prompt:\n"${rawPrompt}"\n\nClarification Q&A:\n${qaContext}\n\nGenerate the optimized prompt. Use different phrasing than previous attempts.`,
      temperature: 0.8, // Higher temp for variety on regen
      maxTokens: 3000,
      responseFormat: "json",
    });

    const result = safeJsonParse<{ finalPrompt: string; changelog: string[] }>(
      response.content
    );
    if (!result) throw new ServiceError("MODEL_INVALID_RESPONSE", 500);

    const synthesisResponse: SynthesisResponse = {
      finalPrompt: result.finalPrompt,
      changelog: result.changelog,
      metadata: {
        category: session.category!,
        tokensUsed: response.tokensUsed.total,
        modelUsed: response.model,
      },
    };

    await this.sessions.transitionTo(sessionId, "COMPLETED", {
      finalPrompt: result.finalPrompt,
      changelog: result.changelog,
      tokensUsed: response.tokensUsed.total,
    });

    return synthesisResponse;
  }
}
```

### `tier.ts` — Tier Definitions

```typescript
// packages/services/src/tier.ts

export type TierName = "FREE" | "PRO" | "TEAM";

export interface TierLimits {
  dailySessions:   number;   // -1 = unlimited
  monthlySessions: number;
  dailyTokens:     number;
  monthlyTokens:   number;
  detailedMode:    boolean;
  regenerate:      boolean;
  history:         boolean | number;  // true = unlimited, number = max entries
  inlineEdit:      boolean;
}

export const TIERS: Record<TierName, TierLimits> = {
  FREE: {
    dailySessions:   5,
    monthlySessions: 50,
    dailyTokens:     12_500,
    monthlyTokens:   125_000,
    detailedMode:    false,
    regenerate:      false,
    history:         10,
    inlineEdit:      false,
  },
  PRO: {
    dailySessions:   -1,
    monthlySessions: -1,
    dailyTokens:     200_000,
    monthlyTokens:   5_000_000,
    detailedMode:    true,
    regenerate:      true,
    history:         true,
    inlineEdit:      true,
  },
  TEAM: {
    dailySessions:   -1,
    monthlySessions: -1,
    dailyTokens:     200_000,
    monthlyTokens:   5_000_000,
    detailedMode:    true,
    regenerate:      true,
    history:         true,
    inlineEdit:      true,
  },
};

// Stripe price IDs — set these in env vars
export const STRIPE_PRICE_IDS: Record<string, string> = {
  PRO:  process.env.STRIPE_PRICE_PRO!,   // e.g., price_1Abc...
  TEAM: process.env.STRIPE_PRICE_TEAM!,  // e.g., price_1Xyz...
};
```

### `usage.service.ts` — Tier-Aware Usage Tracking

```typescript
// packages/services/src/usage.service.ts

import { prisma } from "@prompt-engineer/db";
import { TIERS, type TierName, type TierLimits } from "./tier";
import { ServiceError } from "./errors";

export class UsageService {

  // ── Tier Resolution ───────────────────────────────────

  async getUserTier(userId: string): Promise<TierName> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true },
    });
    return (user?.tier as TierName) ?? "FREE";
  }

  async getLimitsForUser(userId: string): Promise<TierLimits> {
    const tier = await this.getUserTier(userId);
    return TIERS[tier];
  }

  // ── Limit Checking ───────────────────────────────────

  async checkLimits(userId: string): Promise<void> {
    const tier = await this.getUserTier(userId);
    const limits = TIERS[tier];
    const usage = await this.getOrCreate(userId);

    // Reset daily counter if new day
    const today = new Date().toISOString().slice(0, 10);
    const lastReset = usage.lastResetDate.toISOString().slice(0, 10);
    if (today !== lastReset) {
      await prisma.usage.update({
        where: { userId },
        data: {
          tokensUsedToday: 0,
          sessionsToday: 0,
          lastResetDate: new Date(),
        },
      });
      return; // Fresh day, always allowed
    }

    // Check session limits (skip if unlimited)
    if (limits.dailySessions !== -1 && usage.sessionsToday >= limits.dailySessions) {
      throw new ServiceError("TIER_LIMIT_EXCEEDED", 429,
        tier === "FREE"
          ? "Free tier limit reached. Upgrade to Pro for unlimited sessions."
          : "Daily session limit reached."
      );
    }
    if (limits.monthlySessions !== -1 && usage.sessionsMonth >= limits.monthlySessions) {
      throw new ServiceError("TIER_LIMIT_EXCEEDED", 429,
        tier === "FREE"
          ? "Monthly limit reached. Upgrade to Pro for unlimited sessions."
          : "Monthly session limit reached."
      );
    }

    // Check token limits
    if (usage.tokensUsedToday >= limits.dailyTokens) {
      throw new ServiceError("TIER_LIMIT_EXCEEDED", 429, "Daily token limit reached.");
    }
    if (usage.tokensUsedMonth >= limits.monthlyTokens) {
      throw new ServiceError("TIER_LIMIT_EXCEEDED", 429, "Monthly token limit reached.");
    }
  }

  // ── Feature Gating ───────────────────────────────────

  async requireFeature(userId: string, feature: keyof TierLimits): Promise<void> {
    const limits = await this.getLimitsForUser(userId);
    const value = limits[feature];
    if (value === false) {
      throw new ServiceError("FEATURE_NOT_AVAILABLE", 403,
        `This feature requires a Pro subscription.`
      );
    }
  }

  // ── Recording ────────────────────────────────────────

  async recordSession(userId: string, tokens: number): Promise<void> {
    await this.getOrCreate(userId);
    await prisma.usage.update({
      where: { userId },
      data: {
        tokensUsedToday:  { increment: tokens },
        tokensUsedMonth:  { increment: tokens },
        sessionsToday:    { increment: 1 },
        sessionsMonth:    { increment: 1 },
      },
    });
  }

  async recordTokens(userId: string, tokens: number): Promise<void> {
    await this.getOrCreate(userId);
    await prisma.usage.update({
      where: { userId },
      data: {
        tokensUsedToday: { increment: tokens },
        tokensUsedMonth: { increment: tokens },
      },
    });
  }

  // ── Stats ────────────────────────────────────────────

  async getStats(userId: string) {
    const [tier, usage, user] = await Promise.all([
      this.getUserTier(userId),
      this.getOrCreate(userId),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          stripePeriodEnd: true,
        },
      }),
    ]);
    const limits = TIERS[tier];

    return {
      tier,
      tokensUsedToday:  usage.tokensUsedToday,
      tokensUsedMonth:  usage.tokensUsedMonth,
      sessionsToday:    usage.sessionsToday,
      sessionsMonth:    usage.sessionsMonth,
      limits: {
        dailySessions:   limits.dailySessions,
        monthlySessions: limits.monthlySessions,
        dailyTokens:     limits.dailyTokens,
        monthlyTokens:   limits.monthlyTokens,
        detailedMode:    limits.detailedMode,
        history:         limits.history !== false,
      },
      stripe: {
        customerId:       user?.stripeCustomerId ?? null,
        subscriptionId:   user?.stripeSubscriptionId ?? null,
        currentPeriodEnd: user?.stripePeriodEnd?.toISOString() ?? null,
      },
    };
  }

  private async getOrCreate(userId: string) {
    return prisma.usage.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }
}
```

### `billing.service.ts` — Stripe Integration

```typescript
// packages/services/src/billing.service.ts

import Stripe from "stripe";
import { prisma } from "@prompt-engineer/db";
import { STRIPE_PRICE_IDS, type TierName } from "./tier";
import { ServiceError } from "./errors";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

export class BillingService {

  // ── Checkout ──────────────────────────────────────────

  async createCheckout(
    userId: string,
    tier: "PRO" | "TEAM",
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ checkoutUrl: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, tier: true, stripeCustomerId: true },
    });
    if (!user) throw new ServiceError("SESSION_NOT_FOUND", 404);
    if (user.tier === tier) {
      throw new ServiceError("INVALID_TRANSITION", 400, `Already on ${tier} tier.`);
    }

    // Reuse existing Stripe customer or create new one
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: STRIPE_PRICE_IDS[tier], quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId, tier },
    });

    return { checkoutUrl: session.url! };
  }

  // ── Customer Portal ───────────────────────────────────

  async createPortalSession(userId: string): Promise<{ portalUrl: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });
    if (!user?.stripeCustomerId) {
      throw new ServiceError("SESSION_NOT_FOUND", 404, "No active subscription.");
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.NEXTAUTH_URL}/settings`,
    });

    return { portalUrl: session.url };
  }

  // ── Webhook Processing ────────────────────────────────

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );

    switch (event.type) {
      case "checkout.session.completed":
        await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.updated":
        await this.onSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await this.onSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_failed":
        await this.onPaymentFailed(event.data.object as Stripe.Invoice);
        break;
    }
  }

  // ── Webhook Handlers ─────────────────────────────────

  private async onCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    const tier = session.metadata?.tier as TierName;
    if (!userId || !tier) return;

    // Retrieve the subscription to get period end
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string
    );

    await prisma.user.update({
      where: { id: userId },
      data: {
        tier,
        stripeSubscriptionId: subscription.id,
        stripePeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });
  }

  private async onSubscriptionUpdated(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!user) return;

    // Determine tier from the price ID
    const priceId = subscription.items.data[0]?.price.id;
    const tier = this.priceIdToTier(priceId);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        tier,
        stripeSubscriptionId: subscription.id,
        stripePeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });
  }

  private async onSubscriptionDeleted(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    await prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: {
        tier: "FREE",
        stripeSubscriptionId: null,
        stripePeriodEnd: null,
      },
    });
  }

  private async onPaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    // Don't immediately downgrade — Stripe retries.
    // Log for monitoring. Downgrade happens via subscription.deleted
    // if all retries fail.
    console.warn(`Payment failed for customer ${customerId}`, {
      invoiceId: invoice.id,
      attemptCount: invoice.attempt_count,
    });
  }

  private priceIdToTier(priceId: string): TierName {
    for (const [tier, id] of Object.entries(STRIPE_PRICE_IDS)) {
      if (id === priceId) return tier as TierName;
    }
    return "FREE";
  }
}
```

### `errors.ts` — Typed Service Errors

```typescript
// packages/services/src/errors.ts

export type ErrorCode =
  | "SESSION_NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_TRANSITION"
  | "SESSION_NOT_ANALYZED"
  | "SESSION_NOT_COMPLETED"
  | "INVALID_ANSWER_ID"
  | "MODEL_INVALID_RESPONSE"
  | "TIER_LIMIT_EXCEEDED"
  | "FEATURE_NOT_AVAILABLE";

export class ServiceError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ServiceError";
  }
}
```

### Service → Route Wiring

Every API route follows this pattern. Here's the full analyze route showing how thin it is:

```typescript
// apps/web/app/api/sessions/[id]/analyze/route.ts

import { NextRequest, NextResponse } from "next/server";
import { AnalyzeInput } from "@prompt-engineer/validators";
import { AnalysisService, SessionService, UsageService, BillingService } from "@prompt-engineer/services";
import { ServiceError } from "@prompt-engineer/services/errors";

const sessions  = new SessionService();
const usage     = new UsageService();
const analysis  = new AnalysisService(sessions, usage);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Parse + validate
  const body = await req.json();
  const parsed = AnalyzeInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // 2. Call service
  try {
    const result = await analysis.analyze(
      id,
      parsed.data.rawPrompt,
      parsed.data.mode,
      /* userId from auth session, or undefined */
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### Webhook Route (Special Handling)

The Stripe webhook route is unique — it must read the raw request body (not parsed JSON) for signature verification:

```typescript
// apps/web/app/api/billing/webhook/route.ts

import { NextRequest, NextResponse } from "next/server";
import { BillingService } from "@prompt-engineer/services";

const billing = new BillingService();

// Disable Next.js body parsing — Stripe needs the raw buffer
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  try {
    const rawBody = Buffer.from(await req.arrayBuffer());
    await billing.handleWebhook(rawBody, signature);
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook error:", error.message);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 400 }
    );
  }
}
```

---

## Model Abstraction Layer (`packages/ai/`)

### `json-parse.ts` — Robust LLM JSON Extraction

```typescript
// packages/ai/src/json-parse.ts

/**
 * Extracts and parses JSON from LLM output that may contain
 * markdown fences, leading text, or trailing explanation.
 */
export function safeJsonParse<T>(raw: string): T | null {
  // Strip markdown code fences
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Try direct parse
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fall through
  }

  // Try extracting first JSON object
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]) as T;
    } catch {
      // Fall through
    }
  }

  return null;
}
```

### `retry.ts` — Retry with Backoff

```typescript
// packages/ai/src/retry.ts

interface RetryConfig {
  maxRetries:  number;
  baseDelay:   number;
  maxDelay:    number;
  retryOn:     number[];
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelay:  1000,
  maxDelay:   5000,
  retryOn:    [429, 500, 502, 503, 529],
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay, retryOn } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      const status = error?.status ?? error?.statusCode;
      const isRetryable = retryOn.includes(status);

      if (attempt === maxRetries || !isRetryable) {
        throw error;
      }

      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 500,
        maxDelay
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}
```

---

## Prisma Schema (Final)

```prisma
// packages/db/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                    String          @id @default(cuid())
  email                 String          @unique
  name                  String?
  image                 String?
  emailVerified         DateTime?
  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt

  // Billing
  tier                  UserTier        @default(FREE)
  stripeCustomerId      String?         @unique
  stripeSubscriptionId  String?         @unique
  stripePeriodEnd       DateTime?

  // Relations
  sessions              PromptSession[]
  usage                 Usage?
  accounts              Account[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model PromptSession {
  id               String          @id @default(cuid())
  userId           String?
  user             User?           @relation(fields: [userId], references: [id], onDelete: SetNull)

  // Input
  rawPrompt        String          @default("")
  mode             PromptMode      @default(QUICK)

  // Analysis results
  category         PromptCategory?
  intent           String?
  detectedElements Json?           // string[]
  missingElements  Json?           // string[]

  // Clarification
  questions        Json?           // ClarificationQuestion[]
  answers          Json?           // Record<string, string | null>

  // Output
  finalPrompt      String?         @db.Text
  changelog        Json?           // string[]

  // Meta
  status           SessionStatus   @default(CREATED)
  modelUsed        String?
  tokensUsed       Int?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  @@index([userId, createdAt(sort: Desc)])
  @@index([status])
}

model Usage {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokensUsedToday Int      @default(0)
  tokensUsedMonth Int      @default(0)
  sessionsToday   Int      @default(0)
  sessionsMonth   Int      @default(0)
  lastResetDate   DateTime @default(now())
}

enum UserTier {
  FREE
  PRO
  TEAM
}

enum PromptMode {
  QUICK
  DETAILED
}

enum PromptCategory {
  WRITING
  CODING
  RESEARCH
  BUSINESS
  CREATIVE
  EDUCATIONAL
}

enum SessionStatus {
  CREATED
  ANALYZING
  QUESTIONS_READY
  ANSWERS_SUBMITTED
  GENERATING
  COMPLETED
  FAILED
}
```

---

## Phased Implementation

### Phase 1: Scaffold + AI Layer (Days 1-3)

**Goal**: Monorepo boots, packages resolve, Claude API call works end-to-end in a test script.

```
Day 1
  ├── Initialize monorepo (pnpm workspaces + Turborepo)
  ├── Create all package dirs with package.json + tsconfig.json
  ├── Set up tooling/eslint and tooling/typescript base configs
  ├── Create apps/web with Next.js (App Router, TypeScript, Tailwind)
  ├── Install shadcn/ui, run init
  └── Commit: "scaffold monorepo structure"

Day 2
  ├── Implement packages/ai (types, ClaudeProvider, retry, json-parse)
  ├── Implement packages/db (Prisma schema, client singleton)
  ├── Set up Neon PostgreSQL, run first migration
  ├── Wire up .env with ANTHROPIC_API_KEY, DATABASE_URL
  ├── Write a smoke test: call Claude API from a script, verify JSON back
  └── Commit: "add AI provider and database layer"

Day 3
  ├── Implement packages/validators (all Zod schemas)
  ├── Implement packages/prompts (analysis + synthesis system prompts)
  ├── Deploy skeleton to Vercel, verify build succeeds
  └── Commit: "add validators and prompt templates"
```

**Exit criteria**: `pnpm dev` starts the app. `pnpm test:smoke` calls Claude and prints a parsed analysis result. Deployed to Vercel (blank page is fine).

---

### Phase 2: Service Layer + Question Engine (Days 4-8)

**Goal**: User can enter a rough prompt and see clarification questions. Full service layer operational.

```
Day 4
  ├── Implement packages/services/session.service.ts
  ├── Implement packages/services/usage.service.ts
  ├── Implement packages/services/errors.ts
  ├── Implement packages/services/index.ts (DI wiring)
  └── Commit: "add session and usage services"

Day 5
  ├── Implement packages/services/analysis.service.ts
  ├── Wire up API routes:
  │   ├── POST /api/sessions (create)
  │   ├── POST /api/sessions/[id]/analyze
  │   └── GET /api/sessions/[id]
  ├── Test with curl/Postman: create session → analyze → verify DB state
  └── Commit: "add analysis service and API routes"

Day 6-7
  ├── Build components: prompt-input.tsx, mode-toggle.tsx
  ├── Build components: clarification-questions.tsx, question-card.tsx
  ├── Build components: loading-states.tsx
  ├── Implement lib/hooks/use-session-flow.ts (state machine)
  ├── Wire up app/page.tsx: input → analyze → display questions
  └── Commit: "add input and question UI"

Day 8
  ├── Test with 20+ diverse prompts across all 6 categories
  ├── Tune analysis system prompt based on quality of generated questions
  ├── Fix edge cases (very short prompts, multi-topic prompts)
  └── Commit: "tune analysis prompt, fix edge cases"
```

**Exit criteria**: Type a rough prompt in the browser, see 3 smart clarification questions appear. Questions feel relevant, not generic. State persists in PostgreSQL.

---

### Phase 3: Synthesis Engine + Result UI (Days 9-13)

**Goal**: Full end-to-end flow works. User enters prompt, answers questions, gets polished result.

```
Day 9
  ├── Implement packages/services/synthesis.service.ts
  ├── Wire up API route: POST /api/sessions/[id]/answers
  ├── Test with curl: submit answers → verify final prompt in DB
  └── Commit: "add synthesis service and answers endpoint"

Day 10-11
  ├── Build components: prompt-result.tsx, changelog-panel.tsx, copy-button.tsx
  ├── Implement lib/hooks/use-copy-clipboard.ts
  ├── Wire Screen 3 into the flow
  ├── Add streaming display for final prompt generation
  └── Commit: "add result display with copy and changelog"

Day 12
  ├── Implement POST /api/sessions/[id]/regen
  ├── Add regenerate button to result screen
  ├── Add "Start over" flow
  └── Commit: "add regeneration support"

Day 13
  ├── Test 20+ full sessions end-to-end
  ├── Tune synthesis system prompt
  ├── Verify state transitions are correct in all paths
  ├── Fix streaming edge cases
  └── Commit: "tune synthesis, fix e2e issues"
```

**Exit criteria**: Complete flow works in the browser. Final prompts are genuinely better than input. Copy button works. Regenerate produces different output.

---

### Phase 4: Auth, Billing, History, Polish (Days 14-20)

**Goal**: Users can sign in, subscribe, see history. Tier limits enforced. App handles errors gracefully.

```
Day 14
  ├── Set up NextAuth (Auth.js v5) with Google + email providers
  ├── Add Account model to Prisma schema (already in schema above)
  ├── Wire auth into API routes (optional — anonymous still works)
  ├── Add userId to session creation when authenticated
  └── Commit: "add authentication"

Day 15
  ├── Create Stripe account + products (Pro $10/mo, Team $15/mo)
  ├── Implement packages/services/tier.ts (tier definitions + limits)
  ├── Implement packages/services/billing.service.ts
  ├── Wire up POST /api/billing/checkout
  ├── Wire up POST /api/billing/portal
  ├── Wire up POST /api/billing/webhook
  ├── Set up Stripe webhook forwarding (stripe listen --forward-to)
  ├── Test full checkout flow locally:
  │   create checkout → pay with test card → webhook fires → tier updates
  └── Commit: "add Stripe billing integration"

Day 16
  ├── Update UsageService with tier-aware limit checking
  ├── Add tier gating to analysis (detailed mode) and synthesis (regen)
  ├── Wire up GET /api/user/usage (returns tier + limits + Stripe info)
  ├── Build upgrade-banner.tsx (shown when FREE users hit limits)
  ├── Build usage-meter.tsx (visual bar showing usage vs limit)
  ├── Gate UI features by tier (detailed toggle, regen button, edit)
  └── Commit: "add tier enforcement and upgrade UX"

Day 17
  ├── Wire up GET /api/sessions (list, paginated)
  ├── Wire up DELETE /api/sessions/[id]
  ├── Build session-list.tsx component
  ├── Build (app)/history/page.tsx (gated: FREE sees last 10)
  ├── Build (app)/session/[id]/page.tsx (view past session)
  └── Commit: "add prompt history"

Day 18-20
  ├── Add error states for all failure modes
  ├── Add loading skeletons for each screen transition
  ├── Mobile responsive pass (test on 375px viewport)
  ├── Add toast notifications (copy success, errors, upgrade prompts)
  ├── Add inline edit mode on final prompt (PRO only)
  ├── Keyboard navigation: Enter to submit, Tab through questions
  ├── Test tier transitions: FREE → PRO → cancel → FREE
  ├── Test edge: hit limit mid-session, subscription expires mid-day
  └── Commit: "polish UI, error handling, mobile"
```

**Exit criteria**: Auth works. Stripe checkout works with test cards. Tier limits enforced correctly. History shows past sessions (capped for FREE). Upgrade flow is smooth. App looks good on mobile.

---

### Phase 5: Launch (Days 21-24)

**Goal**: Production-ready, monitored, real users.

```
Day 21
  ├── Set up Sentry (error tracking)
  ├── Add Helicone proxy for AI observability
  ├── Add Vercel Analytics
  ├── Security review:
  │   ├── Input sanitization (rawPrompt, answers)
  │   ├── Tier bypass testing (can FREE user call PRO endpoints?)
  │   ├── Webhook signature verification
  │   ├── Auth bypass testing
  │   └── CORS + CSP headers
  └── Commit: "add observability and security hardening"

Day 22
  ├── Build landing hero section (above the prompt input)
  ├── Add pricing section (FREE / PRO / TEAM comparison table)
  ├── Add meta tags, OG image, favicon
  ├── Performance audit (Lighthouse, Core Web Vitals)
  ├── Add simple feedback link/form
  └── Commit: "add landing page with pricing and meta"

Day 23
  ├── Switch Stripe to production mode (live keys, live webhook)
  ├── Production deploy to Vercel
  ├── Verify all production env vars (Stripe live keys, webhook secret)
  ├── Run a real $10 checkout → verify tier upgrade → refund
  ├── Test full flow in production
  └── Commit: "production launch"

Day 24
  ├── Share with 5-10 test users
  ├── Monitor Sentry + Helicone + Stripe dashboard
  ├── Watch for first-day issues
  └── Iterate on feedback
```

**Exit criteria**: App is live on a custom domain. Stripe is in production mode. Monitoring is active. Real users are using it and can pay.

---

## Workspace Configuration

### Root `package.json`

```json
{
  "name": "prompt-engineer",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "db:migrate": "pnpm --filter @prompt-engineer/db migrate",
    "db:push": "pnpm --filter @prompt-engineer/db db:push",
    "db:seed": "pnpm --filter @prompt-engineer/db seed"
  },
  "packageManager": "pnpm@9.15.0",
  "devDependencies": {
    "turbo": "^2.4.0",
    "typescript": "^5.7.0"
  }
}
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    }
  }
}
```

### Package naming convention

All packages use the `@prompt-engineer/` scope:

```
@prompt-engineer/web         → apps/web
@prompt-engineer/db          → packages/db
@prompt-engineer/ai          → packages/ai
@prompt-engineer/services    → packages/services
@prompt-engineer/prompts     → packages/prompts
@prompt-engineer/validators  → packages/validators
```

### `.env.example`

```bash
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"

# AI Provider
ANTHROPIC_API_KEY="sk-ant-..."

# Auth (NextAuth)
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Stripe Billing
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_PRO="price_..."        # $10/mo Pro plan price ID
STRIPE_PRICE_TEAM="price_..."       # $15/mo Team plan price ID

# Rate Limiting (Upstash Redis — optional for MVP)
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""

# Observability (optional)
SENTRY_DSN=""
HELICONE_API_KEY=""
```

---

## Dependency Graph

```
apps/web
  ├── @prompt-engineer/services    (business logic)
  ├── @prompt-engineer/validators  (request/response types)
  └── @prompt-engineer/db          (direct reads for server components)

packages/services
  ├── @prompt-engineer/ai          (model calls)
  ├── @prompt-engineer/prompts     (system prompt templates)
  ├── @prompt-engineer/db          (persistence)
  ├── @prompt-engineer/validators  (types)
  └── stripe                       (only package that imports Stripe SDK)

packages/ai
  └── @anthropic-ai/sdk            (only package that imports this)

packages/prompts
  └── @prompt-engineer/validators  (shared types)

packages/validators
  └── zod                          (no internal deps)

packages/db
  └── @prisma/client               (no internal deps)
```

No circular dependencies. `validators` and `db` are leaf nodes. `services` is the orchestration layer that ties everything together. `apps/web` only imports `services` and `validators` — it never touches `ai` or `prompts` directly.
