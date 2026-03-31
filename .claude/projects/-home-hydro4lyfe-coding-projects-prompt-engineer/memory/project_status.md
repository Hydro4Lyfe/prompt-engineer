---
name: project-build-status
description: Current build phase and what's completed vs remaining for the prompt generator monorepo
type: project
---

Prompt Generator monorepo — Phase 1 (scaffold + AI layer) is COMPLETE as of 2026-03-22.

**Why:** Tracking progress across conversations so work resumes cleanly without re-reading everything.

**How to apply:** Check this memory at the start of any session to know what's done and what's next.

## Completed (Phase 1)

- Monorepo initialized: pnpm workspaces + Turborepo
- Next.js 16 app at `apps/web/` — dev server verified working
- `packages/validators/` — all Zod schemas (session, billing, common enums)
- `packages/db/` — Prisma schema with User (tier + Stripe fields), PromptSession, Usage, Account models. Client generated. **No migration run yet — needs DATABASE_URL.**
- `packages/ai/` — ModelProvider interface, ClaudeProvider (Anthropic SDK), retry with backoff, safeJsonParse
- `packages/prompts/` — analysis + synthesis system prompt builders
- `packages/services/` — all 5 services written:
  - SessionService (CRUD + state machine)
  - AnalysisService (prompt analysis, tier-gated detailed mode)
  - SynthesisService (prompt generation + regen, regen gated to PRO)
  - UsageService (tier-aware limits, session/token counting)
  - BillingService (Stripe checkout, portal, webhook handling)
- `.env.example` created with all required vars
- Git repo initialized, all files staged (no commit yet)

## Blocked — needs user input

- `DATABASE_URL` — needs a PostgreSQL instance (Neon, Supabase, or local)
- `ANTHROPIC_API_KEY` — needs API key from console.anthropic.com

## Next steps (Phase 2: Service Layer + Question Engine, Days 4-8)

Once env vars are set:
1. Copy `.env.example` to `.env`, fill in keys
2. Run first Prisma migration (`pnpm db:migrate`)
3. Wire up API routes in `apps/web/app/api/`:
   - POST /api/sessions (create)
   - GET /api/sessions/:id (read)
   - POST /api/sessions/:id/analyze (analyze prompt)
   - POST /api/sessions/:id/answers (submit answers)
   - POST /api/sessions/:id/regen (regenerate)
   - GET /api/sessions (list)
   - DELETE /api/sessions/:id
   - Billing routes (checkout, portal, webhook)
   - GET /api/user/usage
4. Build UI components (prompt-input, question-card, prompt-result)
5. Wire the 3-screen flow in app/page.tsx

## Implementation docs

- `BLUEPRINT.md` — product vision, UX, examples, prompt engineering logic
- `IMPLEMENTATION.md` — monorepo structure, API contracts, service layer code, Prisma schema, phased roadmap
