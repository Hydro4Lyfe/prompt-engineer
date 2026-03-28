# Prompt Generator — Implementation Blueprint

---

## 1. Product Overview

### What It Does

The Prompt Generator is a web application that transforms rough, incomplete user prompts into polished, high-quality prompts optimized for LLM consumption. It operates as an intelligent intermediary: the user provides a messy idea, the system identifies what's missing, asks targeted clarification questions, and produces a structured final prompt that gets significantly better results from any LLM.

### Who It's For

- **Primary users**: Knowledge workers, marketers, developers, and creators who use LLMs regularly but aren't prompt engineers.
- **Secondary users**: Teams that want consistent prompt quality across an organization.
- **Power users**: Prompt engineers who want to speed up their workflow or catch blind spots.

### End-to-End User Flow

```
1. User enters a rough prompt (free text, 1-3 sentences)
2. System analyzes the prompt for intent, gaps, and ambiguity
3. System presents 3-5 targeted clarification questions
4. User answers (can skip any question)
5. System generates a polished final prompt
6. User receives:
   - The final prompt (copy-ready)
   - A short changelog explaining what was improved
7. User can: copy, edit inline, regenerate, or start over
```

### Value Proposition

Most people leave 60-80% of prompt quality on the table. They forget to specify audience, tone, format, constraints, or examples. This tool closes that gap in under 60 seconds. It's the difference between asking "write me an email" and asking "write a concise, professional email to a VP of Engineering requesting a meeting to discuss migrating our auth system, keeping it under 150 words, with a clear call-to-action and a warm but direct tone."

---

## 2. Functional Requirements

### Core Features

| Feature | Description | Priority |
|---|---|---|
| **Rough prompt input** | Free-text input field, 1-500 words | Must-have |
| **Prompt analysis** | Detect intent, category, gaps, ambiguity | Must-have |
| **Clarification questions** | Generate 3-5 targeted follow-ups | Must-have |
| **Final prompt generation** | Produce optimized, structured prompt | Must-have |
| **Improvement changelog** | Explain what was added/refined | Must-have |
| **Prompt categories** | Auto-detect: writing, coding, research, business, creative, educational | Must-have |
| **Copy to clipboard** | One-click copy of final prompt | Must-have |
| **Prompt history** | View and revisit past sessions | Should-have |
| **Inline editing** | Edit final prompt before copying | Should-have |
| **Regeneration** | Re-generate with different emphasis | Should-have |
| **Prompt templates** | Pre-built starting points by category | Nice-to-have |
| **Team sharing** | Share prompts across a workspace | Nice-to-have |

### Prompt Modes

**Quick Mode** (default)
- 2-3 questions max
- Optimized for speed
- Best for simple tasks (emails, summaries, short content)

**Detailed Mode**
- 4-6 questions
- Deeper analysis
- Best for complex tasks (system design, long-form writing, multi-step workflows)

The system auto-suggests a mode based on detected complexity but the user can override.

### Supported Prompt Categories

Each category triggers a specialized analysis lens:

| Category | Key dimensions analyzed |
|---|---|
| **Writing** | Audience, tone, length, format, style reference |
| **Coding** | Language, framework, constraints, error handling, testing |
| **Research** | Depth, sources, methodology, scope, output format |
| **Business** | Stakeholder, metric, deliverable, timeline, formality |
| **Creative** | Genre, mood, perspective, constraints, inspiration |
| **Educational** | Learner level, learning objective, format, assessment |

---

## 3. Prompt Engineering Logic

### Internal Processing Pipeline

The system processes every rough prompt through a 6-stage pipeline. Each stage runs as a structured reasoning step within a single Claude API call (not separate calls — this is a single system prompt that instructs Claude to reason through each stage).

```
┌─────────────────────────────────────────────────┐
│  Stage 1: INTENT EXTRACTION                     │
│  What is the user actually trying to accomplish? │
│  → Primary task, secondary goals, implicit needs │
├─────────────────────────────────────────────────┤
│  Stage 2: ENTITY & CONSTRAINT IDENTIFICATION    │
│  What concrete elements are mentioned?           │
│  → People, systems, formats, limits, tools       │
├─────────────────────────────────────────────────┤
│  Stage 3: CATEGORY CLASSIFICATION               │
│  What type of prompt is this?                    │
│  → writing | coding | research | business |     │
│    creative | educational                        │
├─────────────────────────────────────────────────┤
│  Stage 4: GAP ANALYSIS                          │
│  What critical information is missing?           │
│  → Apply category-specific checklist             │
│  → Score each gap by impact on output quality    │
├─────────────────────────────────────────────────┤
│  Stage 5: QUESTION GENERATION                   │
│  Generate ranked clarification questions         │
│  → Top 3-5 by information value                  │
│  → Each question includes a sensible default     │
├─────────────────────────────────────────────────┤
│  Stage 6: PROMPT SYNTHESIS                      │
│  Combine original input + answers → final prompt │
│  → Structure for optimal LLM performance         │
│  → Add role framing, constraints, output format  │
│  → Generate improvement changelog                │
└─────────────────────────────────────────────────┘
```

### Analysis System Prompt (Core Logic)

This is the system prompt that drives Stages 1-5. It runs on the initial user input to produce the clarification questions:

```
You are an expert prompt engineer analyzing a user's rough prompt.
Your job is to identify what information would most improve the
final prompt's effectiveness.

Analyze the following rough prompt and return a JSON response with:

1. "intent": What the user is trying to accomplish (1 sentence)
2. "category": One of [writing, coding, research, business, creative, educational]
3. "detected_elements": What's already specified (list)
4. "missing_elements": What's missing that would significantly improve results (list)
5. "suggested_mode": "quick" or "detailed" based on task complexity
6. "questions": Array of question objects, each with:
   - "id": unique identifier
   - "question": The clarification question (concise, specific)
   - "why": Why this matters (1 sentence, shown to user)
   - "default": A reasonable default if user skips
   - "priority": 1-5 (1 = highest impact)
   - "type": "select" | "text" | "scale"
   - "options": (for select type) array of choices

Rules:
- Generate 5-7 candidate questions, ranked by priority
- Never ask what the user already told you
- Each question should unlock meaningfully better output
- Defaults should be sensible so skipping still improves the prompt
- Prefer select/scale over open text when possible (faster for user)
```

### Synthesis System Prompt (Stage 6)

This runs after the user answers clarification questions:

```
You are an expert prompt engineer. Given the user's original rough
prompt and their answers to clarification questions, generate an
optimized final prompt.

Structure the final prompt to include:
1. Role/persona framing (if applicable)
2. Clear task statement
3. Context and background
4. Specific requirements and constraints
5. Output format specification
6. Tone/style guidance
7. Examples (if the task benefits from them)

Also return a "changelog" array listing 3-5 specific improvements
you made, each as a short sentence.

Rules:
- The final prompt should be self-contained (usable without this conversation)
- Don't pad with unnecessary instructions
- Match the complexity of the prompt to the complexity of the task
- Use the user's own language and terminology where possible
- If the user skipped questions, use the defaults but don't over-specify
```

---

## 4. Questioning Strategy

### Priority Framework

Questions are ranked by **information value** — how much the answer improves output quality. The framework:

```
Priority 1 (Critical): Without this, the output will likely be wrong
  → Target audience, programming language, core constraint

Priority 2 (High): Without this, the output will be generic
  → Tone, format, length, level of detail

Priority 3 (Medium): This refines quality noticeably
  → Examples, style references, edge cases

Priority 4 (Low): Nice to have, marginal improvement
  → Meta-preferences, secondary constraints

Priority 5 (Skip): Only ask if user chose detailed mode
  → Fine-tuning, advanced parameters
```

### Question Selection Rules

1. **Quick mode**: Show only Priority 1-2 questions (max 3)
2. **Detailed mode**: Show Priority 1-3 questions (max 6)
3. **Never show more than 6 questions** regardless of mode
4. **Every question must have a default** — skipping is always valid
5. **Prefer closed-ended questions** (selects, scales) over open text
6. **Never ask what's already stated** in the original prompt
7. **Front-load the highest-impact question** — users often answer the first and skip the rest

### Stopping Conditions

The system has "enough" information when:
- All Priority 1 gaps are filled (by answer or default)
- At least one Priority 2 gap is filled
- OR the user has answered 3+ questions (diminishing returns after this)

### Example Questions by Category

**Writing prompt: "write a blog post about AI"**
```
Q1 (P1, select): Who is the target reader?
    Options: [General audience, Tech professionals, Business executives, Students]
    Default: General audience

Q2 (P1, select): What's the primary goal?
    Options: [Inform/educate, Persuade/argue, Entertain, Tutorial/how-to]
    Default: Inform/educate

Q3 (P2, select): How long should it be?
    Options: [Short (500 words), Medium (1000 words), Long (2000+ words)]
    Default: Medium (1000 words)

Q4 (P2, select): What tone?
    Options: [Casual/conversational, Professional, Academic, Witty/engaging]
    Default: Professional

Q5 (P3, text): Any specific angle or thesis?
    Default: General overview of current AI landscape
```

**Coding prompt: "build a login page"**
```
Q1 (P1, select): What framework/stack?
    Options: [React, Vue, Svelte, Next.js, Plain HTML/CSS/JS, Other]
    Default: React

Q2 (P1, select): What auth method?
    Options: [Email/password, OAuth (Google/GitHub), Magic link, All of the above]
    Default: Email/password

Q3 (P2, select): What level of completeness?
    Options: [UI only, UI + validation, Full working component with API calls]
    Default: UI + validation

Q4 (P2, select): Any design system or styling?
    Options: [Tailwind CSS, CSS Modules, Styled Components, Material UI, None specified]
    Default: Tailwind CSS

Q5 (P3, select): Accessibility requirements?
    Options: [Basic (labels, focus), WCAG AA compliant, Not a priority right now]
    Default: Basic (labels, focus)
```

---

## 5. System Architecture

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│              Next.js (App Router, React 19)                  │
│                                                              │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  Prompt   │  │ Clarification│  │   Result Display     │  │
│  │  Input    │→ │   Questions  │→ │   + Copy/Edit/Regen  │  │
│  └──────────┘  └──────────────┘  └───────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS (REST + Streaming)
┌──────────────────────────▼──────────────────────────────────┐
│                        BACKEND                               │
│                  Next.js API Routes                           │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Prompt Processing Pipeline               │   │
│  │                                                       │   │
│  │  ┌─────────┐  ┌──────────┐  ┌────────────────────┐  │   │
│  │  │ Analyze │→ │ Question │→ │ Synthesize Prompt  │  │   │
│  │  │ Intent  │  │ Generate │  │ (after user answers)│  │   │
│  │  └─────────┘  └──────────┘  └────────────────────┘  │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────▼───────────────────────────────┐   │
│  │           Model Abstraction Layer                     │   │
│  │                                                       │   │
│  │  ┌─────────────┐  ┌────────────┐  ┌──────────────┐  │   │
│  │  │Claude (API) │  │ OpenAI     │  │ Local/Other  │  │   │
│  │  │  (primary)  │  │ (fallback) │  │  (pluggable) │  │   │
│  │  └─────────────┘  └────────────┘  └──────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Session     │  │    Auth      │  │   Rate Limiter   │  │
│  │  Manager     │  │  (NextAuth)  │  │                  │  │
│  └──────┬───────┘  └──────────────┘  └──────────────────┘  │
└─────────┼───────────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────────┐
│                      DATA LAYER                              │
│                                                              │
│  ┌─────────────────┐          ┌──────────────────────────┐  │
│  │   PostgreSQL     │          │   Redis (optional)       │  │
│  │   (via Prisma)   │          │   (session cache,        │  │
│  │                  │          │    rate limiting)         │  │
│  │  - users         │          └──────────────────────────┘  │
│  │  - sessions      │                                        │
│  │  - prompts       │                                        │
│  │  - audit_logs    │                                        │
│  └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
```

### Key Architecture Decisions

**Why Next.js for both frontend and backend?**
Single deployment unit. API routes co-located with the frontend. Server components for fast initial loads. Streaming support for progressive prompt generation. Reduces operational complexity for an MVP.

**Why a Model Abstraction Layer?**
Claude API access requires an API key and is billed per token. The abstraction layer:
- Isolates all model calls behind a single interface
- Makes it trivial to swap providers (Claude API → OpenAI → local model)
- Centralizes token counting, cost tracking, and retry logic
- Allows A/B testing different models for quality comparison

**Claude Integration Options**

| Option | How it works | Best for |
|---|---|---|
| **Anthropic API (recommended)** | Direct API calls with your API key. Pay per token. | Production use. Full control. |
| **AWS Bedrock** | Claude via AWS. Same models, AWS billing. | Teams already on AWS. |
| **Google Vertex AI** | Claude via GCP. Same models, GCP billing. | Teams already on GCP. |

**Recommendation**: Start with direct Anthropic API. It's the simplest integration, has the best documentation, and gives you access to the latest models immediately. If you later need enterprise features (VPC, compliance), migrate to Bedrock or Vertex — the abstraction layer makes this a config change, not a rewrite.

**Session State**
Conversation state (rough prompt → questions → answers → final prompt) is stored server-side in PostgreSQL. The frontend holds only a session ID. This means:
- Users can close the tab and return
- State survives page refreshes
- No complex client-side state management
- Easy to implement "prompt history"

---

## 6. Backend Design

### API Routes

```
POST   /api/sessions              Create a new prompt session
GET    /api/sessions/:id          Get session state
POST   /api/sessions/:id/analyze  Submit rough prompt, get questions
POST   /api/sessions/:id/answers  Submit answers, get final prompt
POST   /api/sessions/:id/regen    Regenerate with different params
GET    /api/sessions              List user's sessions (paginated)
DELETE /api/sessions/:id          Delete a session

POST   /api/auth/[...nextauth]   Auth endpoints (NextAuth)
GET    /api/user/usage            Token usage and limits
```

### Request/Response Lifecycle

**Step 1: Analyze** (`POST /api/sessions/:id/analyze`)

```
Request:
{
  "rawPrompt": "write a blog post about AI",
  "mode": "quick"  // optional, auto-detected if omitted
}

Response (streamed):
{
  "intent": "Create a blog post covering artificial intelligence",
  "category": "writing",
  "suggestedMode": "quick",
  "detectedElements": ["topic: AI", "format: blog post"],
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
    // ... more questions
  ]
}
```

**Step 2: Synthesize** (`POST /api/sessions/:id/answers`)

```
Request:
{
  "answers": {
    "q1": "Tech professionals",
    "q2": "Inform/educate",
    "q3": null,  // skipped, use default
    "q4": "Witty/engaging"
  }
}

Response (streamed):
{
  "finalPrompt": "You are a tech journalist known for making complex topics accessible and engaging...",
  "changelog": [
    "Added target audience: tech professionals who want practical insight, not hype",
    "Set tone to witty/engaging to match the reader profile",
    "Added structure: intro hook, 3 key sections, practical takeaway",
    "Specified length (~1000 words) with a skimmable format",
    "Framed the AI persona as a tech journalist for voice consistency"
  ],
  "metadata": {
    "category": "writing",
    "tokensUsed": 847,
    "modelUsed": "claude-sonnet-4-6"
  }
}
```

### Clarification Round Handling

The system supports exactly **one round** of clarification questions in the MVP. This is deliberate:
- Multi-round questioning fatigues users
- One round with good defaults captures 90%+ of the value
- The user can always regenerate or edit the final prompt

If a future version adds multi-round, the session model already supports it — `clarification_rounds` is an array.

### Error Handling and Retries

```typescript
// Retry strategy for model calls
const RETRY_CONFIG = {
  maxRetries: 2,
  baseDelay: 1000,     // 1 second
  maxDelay: 5000,      // 5 seconds
  retryOn: [429, 500, 502, 503, 529],  // rate limit, server errors, overloaded
};

// Validation
// - rawPrompt: 1-5000 chars, sanitized (no injection attacks)
// - answers: validated against question IDs from the session
// - mode: enum ["quick", "detailed"]

// Failure modes
// - Model timeout: Return cached/default questions, log for review
// - Invalid JSON from model: Re-request with stricter formatting instructions
// - Rate limit: Queue with exponential backoff, show user a "thinking..." state
// - Auth failure: 401, redirect to login
```

---

## 7. Data Model

### Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  createdAt     DateTime  @default(now())
  sessions      PromptSession[]
  usage         Usage?
}

model PromptSession {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])

  // Input
  rawPrompt       String
  mode            PromptMode @default(QUICK)
  category        PromptCategory?

  // Analysis
  intent          String?
  detectedElements Json?    // string[]
  missingElements  Json?    // string[]

  // Clarification
  questions       Json?     // Question[]
  answers         Json?     // Record<string, string | null>

  // Output
  finalPrompt     String?
  changelog       Json?     // string[]

  // Meta
  status          SessionStatus @default(CREATED)
  modelUsed       String?
  tokensUsed      Int?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([userId, createdAt(sort: Desc)])
}

model Usage {
  id              String    @id @default(cuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id])
  tokensUsedToday Int       @default(0)
  tokensUsedMonth Int       @default(0)
  lastResetDate   DateTime  @default(now())
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

### Why This Schema

- **Flat session model** instead of separate tables for questions/answers: Simplifies queries. A session is read/written as a unit. JSON columns handle the variable-length question arrays without join overhead.
- **Usage tracking** as a separate table: Updated on every API call, queried independently for rate limiting.
- **No separate audit log table for MVP**: The session itself is the audit trail. Every state transition is captured by `status` + `updatedAt`. Add a dedicated audit log table later if compliance requires it.

---

## 8. UX Flow

### Step-by-Step Experience

**Screen 1: Input**
- Large, centered textarea with placeholder: *"Describe what you want — even if it's rough"*
- Below: subtle examples that rotate: "e.g., write a cold email to a CTO" / "e.g., build a React dashboard" / "e.g., explain quantum computing to a 10-year-old"
- Optional mode toggle (Quick / Detailed) below the textarea — defaults to Quick
- Big "Improve my prompt" button

**Screen 2: Clarification Questions**
- Clean card layout, one question per card
- Each question shows the `why` line in muted text below
- Select questions render as pill buttons (tap to choose)
- Text questions have a short input field
- "Skip" option visible but not prominent on each card
- Bottom: "Generate prompt" button (active after viewing all questions, even if skipped)
- Animated transition from input screen — prompt slides up, questions slide in

**Screen 3: Result**
- Final prompt displayed in a styled, monospace block
- "Copy" button (top right of the block) — copies to clipboard with confirmation toast
- Below the prompt: collapsible "What we improved" section showing the changelog
- Action buttons:
  - **Copy** (primary)
  - **Edit** (opens inline editor within the prompt block)
  - **Regenerate** (re-runs synthesis with same answers, different phrasing)
  - **Start over** (returns to Screen 1)
- Below: "Prompt history" link showing past sessions

### UX Principles

1. **Speed over comprehensiveness**: The whole flow should complete in under 60 seconds
2. **Skipping is fine**: Defaults mean the user can tap "Generate" immediately after seeing questions
3. **Progressive disclosure**: Don't show complexity upfront. Mode toggle, history, editing — all secondary
4. **The prompt is the hero**: The final prompt block should feel premium — well-typeset, easy to scan, easy to copy
5. **No account required for first use**: Let users try it once without signing up. Prompt auth for history/saving

---

## 9. Example Interactions

### Example 1: Writing (Business Email)

**Rough input:**
> "write an email asking my boss for a raise"

**Clarification questions:**
1. What's your relationship with your boss? → *Friendly but professional*
2. What's your main justification? → *Took on two extra projects this quarter*
3. Do you have a specific number in mind? → *15% increase*
4. What tone? → *Confident but not aggressive*

**Final prompt:**
```
You are a professional communication coach helping someone draft a
raise request email.

Write an email from an employee to their direct manager requesting
a 15% salary increase. The relationship is friendly but professional.

Context:
- The employee took on two additional projects this quarter beyond
  their normal responsibilities
- The tone should be confident and direct, but not aggressive or
  ultimatum-like
- The employee wants to maintain the positive working relationship

Requirements:
- Open with appreciation, not complaint
- Present the extra work as evidence of increased value, not a grievance
- State the specific ask (15% raise) clearly — don't be vague
- Include a soft call-to-action (suggest a meeting to discuss)
- Keep it under 200 words
- Close warmly

Format: Ready-to-send email with subject line
```

**Changelog:**
- Added role framing (communication coach) for better output quality
- Specified relationship context so tone calibration is accurate
- Added structural guidance: appreciation → evidence → ask → CTA
- Set a 200-word limit to prevent rambling
- Included instruction to frame extra work as value, not complaint

---

### Example 2: Coding

**Rough input:**
> "make a todo app in react"

**Clarification questions:**
1. What features beyond basic CRUD? → *Drag-and-drop reordering, due dates*
2. Styling approach? → *Tailwind CSS*
3. State management? → *Keep it simple, local state is fine*
4. How complete should the code be? → *Fully working component I can drop in*

**Final prompt:**
```
Build a fully functional Todo application as a single React component
(or small set of components) that I can drop into an existing React +
Tailwind CSS project.

Features:
- Add new todos with a title and optional due date
- Mark todos as complete/incomplete (checkbox)
- Delete todos
- Drag-and-drop reordering (use @dnd-kit/sortable or react-beautiful-dnd)
- Visual indicator for overdue todos (due date has passed)
- Filter view: All / Active / Completed

Technical requirements:
- React functional components with hooks
- Local state only (useState/useReducer) — no external state library
- Tailwind CSS for all styling — no separate CSS files
- TypeScript types for the Todo interface
- Accessible: keyboard navigation, proper ARIA labels on interactive elements

Code structure:
- Export a single <TodoApp /> component as the entry point
- Extract sub-components (TodoItem, AddTodoForm) as needed for clarity
- Include brief inline comments only where logic is non-obvious

Do not include: routing, API calls, authentication, or backend code.
Provide the complete, working code.
```

**Changelog:**
- Specified drag-and-drop library options so the model doesn't invent one
- Added TypeScript requirement for type safety
- Defined clear scope boundaries (no routing, no API, no auth)
- Added accessibility requirements that were missing
- Structured features as a clear checklist for the model to follow

---

### Example 3: Research / Analysis

**Rough input:**
> "compare postgres and mongodb"

**Clarification questions:**
1. What's the comparison for? → *Choosing a database for a new SaaS product*
2. What kind of data? → *Mix of structured (users, billing) and semi-structured (user-generated content, activity logs)*
3. What scale? → *Starting small, need to scale to ~100k users*
4. What matters most? → *Developer experience and operational simplicity*

**Final prompt:**
```
You are a senior database architect advising a startup CTO.

Compare PostgreSQL and MongoDB for a new SaaS application with the
following profile:

Data characteristics:
- Structured data: users, billing, subscriptions (relational)
- Semi-structured data: user-generated content, activity/event logs
- Current scale: MVP stage
- Target scale: ~100,000 active users within 18 months

Evaluation criteria (in priority order):
1. Developer experience — speed of development, ORM/tooling ecosystem
2. Operational simplicity — hosting options, backup, monitoring ease
3. Query flexibility — ability to handle both structured and semi-structured data
4. Scalability path — what it takes to go from 1K to 100K users
5. Cost — hosting costs at target scale
6. Ecosystem — library support, hiring availability, community

For each criterion, give a clear verdict with reasoning — don't
hedge with "it depends" unless the tradeoff genuinely goes both ways.

Output format:
- Brief intro (2-3 sentences)
- Criterion-by-criterion comparison (table or structured sections)
- Clear recommendation with caveats
- "Choose PostgreSQL if..." / "Choose MongoDB if..." summary

Keep it practical and opinionated. I want a decision, not a textbook.
```

**Changelog:**
- Added decision context (SaaS product) so advice is targeted, not generic
- Defined specific evaluation criteria ranked by importance
- Specified data mix (structured + semi-structured) — the key differentiator
- Requested opinionated recommendation instead of neutral comparison
- Added output format guidance for a scannable, actionable response

---

## 10. MVP Plan

### Must-Have (Week 1-3)

- [ ] Single-page app with the 3-screen flow (input → questions → result)
- [ ] Prompt analysis + question generation via Claude API
- [ ] Prompt synthesis via Claude API
- [ ] Quick mode (3 questions)
- [ ] Auto-category detection
- [ ] Copy to clipboard
- [ ] Basic rate limiting (by IP, no auth required for MVP)
- [ ] Mobile-responsive layout

### Should-Have (Week 4-5)

- [ ] User authentication (NextAuth, Google + email)
- [ ] Stripe billing integration (FREE / PRO / TEAM tiers)
- [ ] Tier-based feature gating and usage limits
- [ ] Prompt history (list of past sessions, capped for FREE)
- [ ] Detailed mode — PRO only (5-6 questions)
- [ ] Inline editing of final prompt — PRO only
- [ ] Regenerate button — PRO only
- [ ] Upgrade banner when FREE users hit limits
- [ ] Pricing page

### Deferred (Post-MVP)

- Prompt templates / starting points
- Team workspaces (TEAM tier activation)
- Prompt scoring / quality metrics
- Multi-round clarification
- Export to various LLM platforms
- Custom category definitions
- API access for developers
- Prompt version history (diffs)

### MVP Success Criteria

1. A user can go from rough idea to polished prompt in under 60 seconds
2. The final prompt is measurably better than the input (judged by output quality)
3. The clarification questions feel smart, not generic
4. The system handles 100 concurrent users without degradation

---

## 11. Recommended Tech Stack

| Layer | Choice | Why |
|---|---|---|
| **Frontend** | Next.js 15 (App Router) + React 19 | SSR, streaming, API routes co-located. One deploy. |
| **Styling** | Tailwind CSS + shadcn/ui | Fast to build, consistent design, accessible components. |
| **Backend** | Next.js API Routes (Route Handlers) | Co-located with frontend. No separate server to manage. |
| **Database** | PostgreSQL (via Neon or Supabase) | Relational data, JSONB for flexible fields, free tier for MVP. |
| **ORM** | Prisma | Type-safe queries, migrations, great DX. |
| **Auth** | NextAuth.js (Auth.js v5) | Plug-and-play with Next.js. Google + email magic links. |
| **AI Integration** | Anthropic SDK (`@anthropic-ai/sdk`) | Official TypeScript SDK. Streaming support. |
| **Model** | Claude Sonnet 4.6 (primary) | Best cost/quality ratio for structured analysis tasks. |
| **Hosting** | Vercel | Zero-config Next.js deployment. Edge functions. Generous free tier. |
| **Billing** | Stripe (Checkout + Customer Portal) | Industry standard. Hosted payment pages. Webhook-driven. |
| **Cache/Rate Limit** | Upstash Redis | Serverless Redis. Rate limiting and session caching. |
| **Observability** | Vercel Analytics + Sentry | Error tracking, performance monitoring, web vitals. |
| **AI Observability** | Helicone or LangSmith | Track token usage, latency, prompt quality over time. |

### Why These Specific Choices

**Claude Sonnet 4.6 over Opus**: For prompt analysis and question generation, Sonnet provides excellent quality at ~1/5 the cost. The tasks here (intent extraction, gap analysis, structured output) are well within Sonnet's capabilities. Use Opus only if you later add a "premium quality" tier.

**PostgreSQL over MongoDB**: The data is fundamentally relational (users have sessions, sessions have prompts). JSONB columns handle the variable-structure parts (questions, answers) without losing query power.

**Vercel over self-hosted**: For an MVP, deployment friction is the enemy. Vercel deploys on `git push`, handles SSL, CDN, and scaling automatically. Migrate to AWS/GCP only if you need it.

---

## 12. Implementation Roadmap

### Phase 1: Foundation (Days 1-3)

```
- Initialize Next.js project with TypeScript
- Set up Tailwind + shadcn/ui
- Set up Prisma + PostgreSQL (Neon)
- Implement model abstraction layer
- Verify Claude API integration with a simple test call
- Set up environment variables and config
- Deploy skeleton to Vercel
```

**Exit criteria**: A deployed app that can make a Claude API call and display the result.

### Phase 2: Question Engine (Days 4-7)

```
- Build the analysis system prompt
- Implement POST /api/sessions/:id/analyze
- Build the question generation pipeline
- Implement category detection
- Build the clarification questions UI (Screen 2)
- Build the prompt input UI (Screen 1)
- Wire up the flow: input → analyze → display questions
- Test with 20+ diverse rough prompts, tune the system prompt
```

**Exit criteria**: User can enter a rough prompt and see relevant, smart questions.

### Phase 3: Prompt Generation (Days 8-11)

```
- Build the synthesis system prompt
- Implement POST /api/sessions/:id/answers
- Build the result UI (Screen 3)
- Implement copy to clipboard
- Implement streaming for the final prompt display
- Add the improvement changelog
- Wire up the full flow end-to-end
- Test with 20+ full sessions, tune synthesis quality
```

**Exit criteria**: Full flow works. User enters prompt, answers questions, gets a polished result.

### Phase 4: Persistence & Polish (Days 12-16)

```
- Add NextAuth (Google + email)
- Implement session persistence (prompt history)
- Add rate limiting (Upstash Redis)
- Implement usage tracking
- Add detailed mode toggle
- Build prompt history list view
- Add regenerate and inline edit
- Add error states and loading skeletons
- Mobile responsive pass
```

**Exit criteria**: Users can sign in, see history, and the app handles edge cases gracefully.

### Phase 5: Launch Readiness (Days 17-20)

```
- Set up Sentry for error tracking
- Set up Helicone for AI observability
- Add basic analytics (Vercel Analytics)
- Performance audit (Core Web Vitals)
- Security review (input sanitization, rate limits, auth)
- Write a landing page / hero section
- Set up a feedback mechanism (simple form or email link)
- Test with 5-10 real users, iterate on pain points
- Production deploy
```

**Exit criteria**: App is live, monitored, and has real users providing feedback.

---

## 13. Starter Code

### Model Abstraction Layer

```typescript
// lib/ai/types.ts
export interface ModelRequest {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "json" | "text";
}

export interface ModelResponse {
  content: string;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  model: string;
}

export interface ModelProvider {
  generate(request: ModelRequest): Promise<ModelResponse>;
  stream(request: ModelRequest): AsyncIterable<string>;
}
```

```typescript
// lib/ai/claude-provider.ts
import Anthropic from "@anthropic-ai/sdk";
import { ModelProvider, ModelRequest, ModelResponse } from "./types";

export class ClaudeProvider implements ModelProvider {
  private client: Anthropic;
  private model: string;

  constructor(
    apiKey: string,
    model: string = "claude-sonnet-4-6-20250514"
  ) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens ?? 2048,
      temperature: request.temperature ?? 0.7,
      system: request.systemPrompt,
      messages: [{ role: "user", content: request.userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return {
      content: textBlock?.text ?? "",
      tokensUsed: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens,
      },
      model: this.model,
    };
  }

  async *stream(request: ModelRequest): AsyncIterable<string> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: request.maxTokens ?? 2048,
      temperature: request.temperature ?? 0.7,
      system: request.systemPrompt,
      messages: [{ role: "user", content: request.userMessage }],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  }
}
```

```typescript
// lib/ai/index.ts
import { ModelProvider } from "./types";
import { ClaudeProvider } from "./claude-provider";

let provider: ModelProvider | null = null;

export function getModelProvider(): ModelProvider {
  if (!provider) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

    provider = new ClaudeProvider(apiKey);
  }
  return provider;
}
```

### Prompt Analysis Pipeline

```typescript
// lib/pipeline/analyze.ts
import { getModelProvider } from "@/lib/ai";
import { PromptCategory } from "@prisma/client";

export interface AnalysisResult {
  intent: string;
  category: PromptCategory;
  suggestedMode: "quick" | "detailed";
  detectedElements: string[];
  missingElements: string[];
  questions: ClarificationQuestion[];
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  why: string;
  default: string;
  priority: number;
  type: "select" | "text" | "scale";
  options?: string[];
}

const ANALYSIS_SYSTEM_PROMPT = `You are an expert prompt engineer analyzing a user's rough prompt to identify what information would most improve the final prompt's effectiveness.

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
- Priority 3+ = refinement, nice to have

Return ONLY valid JSON. No markdown, no explanation.`;

export async function analyzePrompt(
  rawPrompt: string,
  mode?: "quick" | "detailed"
): Promise<AnalysisResult> {
  const provider = getModelProvider();

  const response = await provider.generate({
    systemPrompt: ANALYSIS_SYSTEM_PROMPT,
    userMessage: rawPrompt,
    temperature: 0.4, // Lower temperature for more consistent analysis
    responseFormat: "json",
  });

  const result: AnalysisResult = JSON.parse(response.content);

  // Filter questions based on mode
  const effectiveMode = mode ?? result.suggestedMode;
  const maxQuestions = effectiveMode === "quick" ? 3 : 6;
  result.questions = result.questions
    .sort((a, b) => a.priority - b.priority)
    .slice(0, maxQuestions);

  return result;
}
```

### Prompt Synthesis

```typescript
// lib/pipeline/synthesize.ts
import { getModelProvider } from "@/lib/ai";
import { ClarificationQuestion } from "./analyze";

export interface SynthesisResult {
  finalPrompt: string;
  changelog: string[];
}

const SYNTHESIS_SYSTEM_PROMPT = `You are an expert prompt engineer. Given a user's original rough prompt and their answers to clarification questions, generate an optimized final prompt.

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

Return ONLY valid JSON.`;

export async function synthesizePrompt(
  rawPrompt: string,
  questions: ClarificationQuestion[],
  answers: Record<string, string | null>
): Promise<SynthesisResult> {
  const provider = getModelProvider();

  // Build context from Q&A
  const qaContext = questions
    .map((q) => {
      const answer = answers[q.id];
      const effectiveAnswer = answer ?? `${q.default} (default)`;
      return `Q: ${q.question}\nA: ${effectiveAnswer}`;
    })
    .join("\n\n");

  const userMessage = `Original rough prompt:
"${rawPrompt}"

Clarification Q&A:
${qaContext}

Generate the optimized prompt.`;

  const response = await provider.generate({
    systemPrompt: SYNTHESIS_SYSTEM_PROMPT,
    userMessage,
    temperature: 0.6,
    maxTokens: 3000,
    responseFormat: "json",
  });

  return JSON.parse(response.content);
}
```

### API Route: Analyze

```typescript
// app/api/sessions/[id]/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzePrompt } from "@/lib/pipeline/analyze";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { success } = await rateLimit(ip, { limit: 20, window: "1h" });
  if (!success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429 }
    );
  }

  const { rawPrompt, mode } = await req.json();

  // Validate input
  if (!rawPrompt || typeof rawPrompt !== "string") {
    return NextResponse.json(
      { error: "rawPrompt is required" },
      { status: 400 }
    );
  }
  if (rawPrompt.length > 5000) {
    return NextResponse.json(
      { error: "Prompt must be under 5000 characters" },
      { status: 400 }
    );
  }

  try {
    // Update session status
    await prisma.promptSession.update({
      where: { id: params.id },
      data: { rawPrompt, status: "ANALYZING" },
    });

    // Run analysis
    const analysis = await analyzePrompt(rawPrompt, mode);

    // Persist results
    await prisma.promptSession.update({
      where: { id: params.id },
      data: {
        intent: analysis.intent,
        category: analysis.category,
        detectedElements: analysis.detectedElements,
        missingElements: analysis.missingElements,
        questions: analysis.questions,
        status: "QUESTIONS_READY",
      },
    });

    return NextResponse.json(analysis);
  } catch (error) {
    await prisma.promptSession.update({
      where: { id: params.id },
      data: { status: "FAILED" },
    });
    console.error("Analysis failed:", error);
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 500 }
    );
  }
}
```

### Frontend: Main Flow Component

```tsx
// app/page.tsx
"use client";

import { useState } from "react";
import { PromptInput } from "@/components/prompt-input";
import { ClarificationQuestions } from "@/components/clarification-questions";
import { PromptResult } from "@/components/prompt-result";

type Step = "input" | "questions" | "result";

interface SessionState {
  sessionId: string | null;
  analysis: any | null;
  result: any | null;
}

export default function Home() {
  const [step, setStep] = useState<Step>("input");
  const [session, setSession] = useState<SessionState>({
    sessionId: null,
    analysis: null,
    result: null,
  });

  async function handlePromptSubmit(rawPrompt: string, mode: string) {
    // Create session
    const createRes = await fetch("/api/sessions", { method: "POST" });
    const { id } = await createRes.json();

    // Analyze
    const analyzeRes = await fetch(`/api/sessions/${id}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawPrompt, mode }),
    });
    const analysis = await analyzeRes.json();

    setSession({ sessionId: id, analysis, result: null });
    setStep("questions");
  }

  async function handleAnswersSubmit(answers: Record<string, string | null>) {
    const res = await fetch(
      `/api/sessions/${session.sessionId}/answers`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      }
    );
    const result = await res.json();

    setSession((prev) => ({ ...prev, result }));
    setStep("result");
  }

  function handleStartOver() {
    setSession({ sessionId: null, analysis: null, result: null });
    setStep("input");
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="mb-2 text-center text-3xl font-bold tracking-tight">
          Prompt Generator
        </h1>
        <p className="mb-12 text-center text-zinc-400">
          Turn rough ideas into polished prompts
        </p>

        {step === "input" && (
          <PromptInput onSubmit={handlePromptSubmit} />
        )}
        {step === "questions" && session.analysis && (
          <ClarificationQuestions
            questions={session.analysis.questions}
            onSubmit={handleAnswersSubmit}
            onBack={() => setStep("input")}
          />
        )}
        {step === "result" && session.result && (
          <PromptResult
            result={session.result}
            onRegenerate={() => handleAnswersSubmit(session.analysis.answers)}
            onStartOver={handleStartOver}
          />
        )}
      </div>
    </main>
  );
}
```

---

## 14. Risks and Design Considerations

### Risk 1: Too Many Questions (User Fatigue)

**Problem**: Users abandon the flow if confronted with too many questions.
**Mitigation**: Hard cap of 3 questions in Quick mode, 6 in Detailed. Every question has a default. Users can skip all questions and still get an improved prompt. The "Generate" button is always visible.

### Risk 2: Weak Prompt Synthesis

**Problem**: The final prompt isn't significantly better than the input, making the tool feel pointless.
**Mitigation**:
- Invest heavily in tuning the synthesis system prompt — this is the core value
- A/B test synthesis prompt variants using a quality rubric
- Log before/after pairs and periodically review for quality regression
- Add a "rate this prompt" thumbs up/down to collect signal

### Risk 3: Vendor Lock-in (Claude API)

**Problem**: Building entirely on Claude API creates dependency on Anthropic's pricing, availability, and terms.
**Mitigation**: The `ModelProvider` abstraction layer isolates all model calls behind an interface. Swapping to OpenAI, Gemini, or a local model requires implementing one interface (two methods: `generate` and `stream`). The system prompts are model-agnostic — they work with any capable LLM.

### Risk 4: Latency

**Problem**: Two sequential LLM calls (analyze + synthesize) could make the flow feel slow.
**Mitigation**:
- Use streaming for both calls — users see progress immediately
- Claude Sonnet is fast (~1-2s to first token)
- Show engaging loading states ("Analyzing your prompt...", "Crafting questions...")
- The question-answering step (human time) naturally masks the synthesis latency — start the synthesis call the instant the last answer is submitted

### Risk 5: Token Costs

**Problem**: Each session uses two Claude API calls. At scale, costs add up.
**Mitigation**:
- Use Sonnet (not Opus) — excellent quality at ~$3/$15 per million input/output tokens
- Average session: ~1500 input tokens + ~1000 output tokens = ~$0.02 per session
- At 10,000 sessions/month: ~$200/month in API costs — manageable
- Implement per-user daily limits (e.g., 20 sessions/day free, then paywall)
- Cache analysis results for identical/near-identical prompts (deduplicate)

### Risk 6: Poor UX from Over-Engineering

**Problem**: Adding too many features (templates, scoring, multi-round, teams) before the core is solid.
**Mitigation**: The MVP plan is deliberately minimal — 3 screens, one clarification round, no auth required for first use. Ship this in 2-3 weeks. Add features only after validating with real users that the core flow delivers value.

### Risk 7: Generic / Template-Feeling Questions

**Problem**: Questions feel like a form, not an intelligent conversation.
**Mitigation**:
- The `why` field on each question explains its purpose — this makes questions feel considered
- Questions are dynamically generated based on the specific prompt, not pulled from a fixed list
- Category-specific analysis ensures questions are domain-relevant
- Periodic review of generated questions to tune the analysis prompt

### Risk 8: JSON Parsing Failures from Claude

**Problem**: Despite asking for JSON, Claude occasionally returns invalid JSON or wraps it in markdown.
**Mitigation**:
- Strip markdown code fences before parsing
- Use a permissive JSON parser (`json5` or custom cleanup)
- On parse failure, retry once with a stricter system prompt addendum: "Return ONLY raw JSON. No markdown. No explanation."
- If second attempt fails, return a fallback set of generic high-value questions so the user isn't blocked

---

## Appendix: Cost & Revenue Estimate

### Operating Costs (at 10K sessions/month)

| Component | Monthly Cost |
|---|---|
| Claude API (Sonnet) | ~$200 |
| Vercel Pro | $20 |
| Neon PostgreSQL (free tier) | $0 |
| Upstash Redis (free tier) | $0 |
| Stripe (2.9% + $0.30 per txn) | ~$0.59/subscriber |
| Sentry (free tier) | $0 |
| Domain | ~$1 |
| **Total** | **~$221 + Stripe fees** |

### Tier Pricing

| Tier | Price | Sessions | Features |
|---|---|---|---|
| FREE | $0 | 5/day, 50/month | Quick mode only, last 10 history |
| PRO | $10/month | Unlimited | Detailed mode, regen, edit, full history |
| TEAM | $15/user/month | Unlimited | Everything + shared workspace (future) |

### Break-Even

- Cost per free user: ~$1/month (50 sessions)
- Revenue per Pro user: $10 - $0.59 Stripe fee = $9.41/month
- **23 Pro subscribers** cover 1,000 free users + all infra costs
