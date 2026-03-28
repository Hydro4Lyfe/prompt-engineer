# Prompt Engineer — UI Design Spec

## Overview

Build the end-to-end web UI for the prompt engineering tool as a single-page flow with step transitions. Users enter a rough prompt with steering controls, answer clarification questions, and receive an optimized final prompt tailored to their target AI model. Payment/billing is deferred — the focus is on getting the core prompt engineering loop working.

## Scope

- Single-page, 3-step flow (input → questions → result)
- Collapsible sidebar for session history
- No authentication or billing (anonymous sessions for testing)
- Claude API integration via existing service layer
- Minimal, clean visual design (Linear/Notion aesthetic)

## Out of Scope

- Authentication / user accounts
- Stripe billing / payment
- Regeneration feature (button shown disabled as Pro-only)
- Team sharing
- Prompt templates

---

## Screen 1: Prompt Input + Steering Controls

The landing screen is the primary workspace. Centered layout, max-width container.

### Layout (top to bottom)

1. **Header** — App name/logo, minimal. Sidebar toggle button. No nav (no auth/billing).
2. **Prompt textarea** — Large, prominent. Placeholder: "Describe what you want the AI to do..." Accepts 1–500 words.
3. **Target model selector** — Dropdown directly below the textarea. Options: Claude, GPT-4, Gemini, Llama, Mistral, Other. Default: Claude.
4. **Task type tags** — Horizontal row of selectable pill/chip buttons: Writing, Coding, Research, Business, Creative, Educational. Optional selection — the AI auto-detects category if none selected, but selecting one pre-fills category-specific dials.
5. **Steering dials** — Below the tags:
   - **Universal (always visible):** Tone (formal ↔ casual slider), Detail Level (concise ↔ thorough slider)
   - **Category-specific (appear when a tag is selected):**
     - Coding → "Error Handling" toggle, "Include Tests" toggle
     - Writing → "Length" slider, "Audience" quick-select
     - Research → "Depth" slider, "Sources Required" toggle
     - Business → "Formality" slider, "Include Metrics" toggle
     - Creative → "Creativity" slider, "Constraints" toggle
     - Educational → "Learner Level" quick-select, "Include Assessment" toggle
6. **Mode toggle** — Quick / Detailed, small and secondary. Quick is default.
7. **"Enhance My Prompt" button** — Primary CTA.

### Behavior

- All steering values (tags, dials, target model, mode) are serialized and sent alongside the raw prompt to the analysis endpoint.
- Claude factors these into question generation — e.g., if the user already set tone to "formal," the AI skips asking about tone.
- If no task type tag is selected, the AI auto-detects the category as it does today.

---

## Screen 2: Clarification Questions

After "Enhance My Prompt," the input area transitions (fade/slide) into the questions panel.

### Layout

1. **Context bar** — Slim strip showing the original prompt (truncated), selected category badge, target model. Clickable to go back and edit inputs.
2. **Question cards** — Stacked vertically, one per question. Each card shows:
   - Question text
   - "Why this matters" subtitle (muted text)
   - Input control matching the question type (select dropdown, text field, or slider)
   - Pre-filled with the default value so users can skip through
3. **"Skip remaining" link** — Accepts all defaults for unanswered questions.
4. **"Generate Prompt" button** — Primary CTA at bottom.

### Behavior

- Steering dials from Screen 1 are not repeated here — they've been factored into the analysis.
- The context bar lets users go back to Screen 1 to adjust inputs if the questions don't seem right.

---

## Screen 3: Result

The questions panel transitions into the result view.

### Layout

1. **Context bar** — Same as Screen 2. Clickable to start over.
2. **Final prompt card** — Large, bordered card with readable text. Editable inline (toggle between display and edit mode) so the user can tweak before copying.
3. **Copy button** — Prominent, top-right of the prompt card. Shows "Copied!" toast feedback.
4. **Changelog panel** — Collapsible section below the prompt card. Shows 3–5 bullet points describing what was improved and why. Expanded by default on first view.
5. **Actions row:**
   - "Start Over" — resets to Screen 1 with empty state
   - "Regenerate" — shown disabled/grayed with tooltip "Pro feature" (placeholder for future billing)

---

## Sidebar: Session History

### Behavior

- Collapsed by default on first visit.
- Toggle button in the header (panel icon).
- When open, pushes main content to the right (not an overlay).
- Shows a list of past sessions: truncated raw prompt text, category badge, relative timestamp.
- Clicking a session loads its completed result into the main area.
- Sessions are anonymous during testing — stored in database with no user association. Optionally scoped to the browser via a localStorage identifier.

---

## Data Flow

```
Screen 1: prompt + tags + dials + targetModel + mode
    |
    v
POST /api/sessions              → creates session record
POST /api/sessions/[id]/analyze → sends prompt + all steering context
    |
    v
Screen 2: clarification questions (from analysis response)
    |
    v
POST /api/sessions/[id]/answers → sends user answers
    |
    v
Screen 3: final prompt + changelog (from synthesis response)
```

### Steering Context Integration

The steering controls must flow into two places:

1. **Analysis prompt** — Task type tags and dial values are included in the user message sent to the analysis endpoint. This lets Claude skip redundant questions and generate more targeted ones. Example: if tone is set to "formal" and detail is "thorough," Claude doesn't ask about tone or depth.

2. **Synthesis prompt** — The target model selection flows into the synthesis step. The synthesis prompt template is extended to include model-specific formatting guidance:
   - **Claude:** Use XML tags for structure, leverage system prompt conventions
   - **GPT-4:** Use markdown formatting, explicit instruction hierarchy
   - **Gemini:** Use clear section headers, explicit output format
   - **Llama/Mistral:** Keep instructions direct and explicit, less reliance on nuanced formatting
   - **Other:** Apply generic best-practices (clear structure, explicit constraints, examples)

### Schema Changes

The `PromptSession` model and API contracts need extensions:

- `targetModel` field on `PromptSession` — string, stores the selected model
- `steeringInputs` JSON field on `PromptSession` — stores tags + dial values
- `AnalyzeInput` schema extended with `targetModel` and `steeringInputs`
- Analysis prompt builder accepts steering context as parameters
- Synthesis prompt builder accepts target model as a parameter

---

## Visual Design

- **Aesthetic:** Minimal and clean — Linear/Notion style
- **Colors:** Muted palette, white/off-white backgrounds, subtle borders. Accent color for primary CTA and selected states.
- **Typography:** Clean sans-serif, clear hierarchy between headings, body, and muted text.
- **Spacing:** Generous whitespace, nothing feels cramped.
- **Components:** Use shadcn/ui primitives (already in the implementation plan) for buttons, cards, dropdowns, sliders, toggles.
- **Transitions:** Smooth fade/slide between steps. No jarring page reloads.
- **Dark mode:** Support via Tailwind dark classes, but light mode is the default.

---

## Technical Notes

- **No auth required** — Skip all user/billing checks during testing. Services support optional `userId` already.
- **State management** — React state machine (via `use-session-flow` hook from the implementation plan) manages the 3-step transitions.
- **API routes** — Thin handlers calling existing service layer. Need to create the actual Next.js route files.
- **Prompt templates** — `buildAnalysisPrompt()` and `buildSynthesisPrompt()` need to accept steering/model parameters.
- **Target model** — Stored on the session and passed through to synthesis. Does NOT change which model runs the analysis/synthesis (that's always Claude via our API key). It only affects how the output prompt is formatted.
