---
name: project-context
description: What the prompt generator product is and the key architectural decisions driving it
type: project
---

Building a prompt generator SaaS — user enters a rough prompt, system asks smart clarification questions, generates a polished final prompt optimized for LLM use.

**Why:** User wants to start with personal use, then open it to the public with paid tiers.

**How to apply:** All design decisions should support the personal-use → public SaaS trajectory.

## Key decisions

- Claude Sonnet 4.6 via Anthropic API (direct, not Bedrock/Vertex) — cheapest path, best docs
- ModelProvider abstraction layer makes swapping providers a config change
- Tiered billing: FREE (5 sessions/day, quick mode only) → PRO $10/mo (unlimited, detailed, regen) → TEAM $15/user/mo (future)
- Stripe Checkout + Customer Portal — no custom payment UI
- One clarification round only (MVP) — multi-round deferred
- Server-side session state in PostgreSQL, frontend holds only session ID
- Port 3000 was in use during dev — used 3456 for testing
