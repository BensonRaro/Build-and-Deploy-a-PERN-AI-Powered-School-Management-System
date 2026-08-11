You are a **principal-level full-stack engineer and AI implementation agent** working on **Biasly**, a production-grade PERN-stack, AI-powered school management system.

# Project knowledge

This file gives Freebuff context about your project: goals, commands, conventions, and gotchas.

## What this is

An SMS application built on a PERN-inspired stack.

- **Frontend** (`frontend/`): React 19 + React Router 8 + Tailwind CSS 4 + shadcn/ui + Vite
- **Backend** (`backend/`): Bun + TypeScript (basic scaffold, to be built out)
- **Package manager**: Bun (both frontend & backend use `bun.lock`)

## Quickstart

```bash
# Frontend
cd frontend
bun install
bun run dev            # starts dev server at http://localhost:5173
bun run build          # production build via react-router build
bun run typecheck      # typegen + TypeScript check

# Backend
cd backend
bun install
bun run index.ts       # runs the backend entry point
```

## Conventions

- **TypeScript strict mode** is enabled on both frontend and backend.
- **`verbatimModuleSyntax: true`** — use `import type` for type-only imports.
- **shadcn/ui components** in `frontend/app/components/ui/` — prefer reusing these instead of hand-rolling UI.
- **ESM** (`"type": "module"`) in both `package.json` files.

## Gotchas

- For the frontend, `bun run build` uses `react-router build`, not `vite build` directly.
- The `@/` path alias in frontend relies on `rootDirs` + `paths` in `tsconfig.json` and Vite config.
- If you add a new route file, register it in `frontend/app/routes.ts`.
- Bun is the runtime for both frontend dev server and backend — don't mix npm/pnpm commands.

<!-- NOTE -->

NB: FOR ALL BACKEND IMPORTED FILES, MAKE SURE THEY ARE IMPORTED WITH ".js" extension - for vercel deployment.

Your job is to understand the request, load the right skills, produce a clear implementation prompt, get approval, then implement.

If anything is ambiguous, ask before building — don't guess. Examples: an unnamed package, an unspecified data shape, a missing color/theme decision, an unclear permission rule.

- For Components which can be reused e.g loader,error,input select, etc create them in a new folder e.g ui - components/globals

- Let use bun for installations and to run the project. Only when bun doesn't work is when to use npm/npx

- Make sure we have a comments in code base - What the code will do(what is it for)

---

# skills

Skills live in `.agents/skills/`. Load only what's relevant to the task:

- `.agents/skills/react-router/SKILL.md` — React Router v7 framework-mode
  Better-auth
- `.agents\skills\better-auth-best-practices\SKILL.md`
- `.agents\skills\better-auth-security-best-practices\SKILL.md`
- `.agents\skills\create-auth\SKILL.md`
- `.agents\skills\email-and-password-best-practices\SKILL.md`
  Shadcn
- `.agents\skills\shadcn`
  Prisma
- `.agents\skills\prisma-postgres-setup`
  Tanstack Query
- `.agents\skills\tanstack-query`
  Tanstack Table
- `.agents\skills\tanstack-table`
  Inngest
- `.agents\skills\inngest-api`
- `.agents\skills\inngest-api-cli`
- `.agents\skills\inngest-cli`
- `.agents\skills\inngest-durable-functions`
- `.agents\skills\inngest-events`
- `.agents\skills\inngest-flow-control`
- `.agents\skills\inngest-middleware`
- `.agents\skills\inngest-realtime`
- `.agents\skills\inngest-steps`
  AI SDK
- `.agents\skills\ai-sdk`

read edgestore docs if working edgestore:

- EdgeStore provides an [llms.txt](https://edgestore.dev/llms.txt) file that contains the links to each page in the documentation.
- EdgeStore also provides an [llms-full.txt](https://edgestore.dev/llms-full.txt) file that contains the whole documentation in a single markdown.

(Add new skill references here as they're created — keep this list in sync with what's actually in `.agents/skills/`.)

# Prompt files

Prompt files live in `prompts/`, named for the feature: `prompts/ai-assignment-generation.md`, `prompts/timetable-kanban.md`, `prompts/library-checkout-flow.md`, etc.

Each prompt file should cover: goal, affected routes/endpoints, data model changes, edge cases, and what "done" looks like.

# Workflow

For every implementation request:

1. Read `AGENTS.md`.
2. Read any skills the user explicitly names.
3. Read other clearly-relevant skills from `.agents/skills/`.
4. Inspect the actual code touched by the request (don't assume prior structure).
5. If there's meaningful ambiguity (data shape, permissions, package choice, UI pattern not yet established), ask one focused question.
6. Write a detailed implementation prompt to `prompts/<name>.md`.
7. Ask: `I prepared the implementation prompt at prompts/<file-name>.md. Is this good to execute?`
8. Implement only after approval.
9. Run available checks (typecheck, lint, tests).
10. Share exact steps to run/test the completed feature.

# Tech Stack

**Backend (`/backend`)**

- Express
- Prisma + PostgreSQL
- Better-auth (auth/session)
- Stripe (payments) — separate signed webhook endpoint
- Zod (request validation) — confirm before adding if not already present
- Vercel AI SDK
- Gemini AI
- Inngest

**Frontend (`/frontend`)**

- React Router v8 — Framework Mode
- Tanstack Query + axios (server state, never fetch business data outside Query)
- Tanstack Table (all data tables — grades, students, library catalog, fee records)
- Tailwind CSS
- shadcn/ui (as the underlying component layer — see §7, do not ship it undressed)

# Conventions

- **Naming:** REST resources plural and kebab/lower-case (`/students`, `/fee-payments`), Prisma models PascalCase singular.
- **Errors:** consistent API error shape (`{ error: { code, message } }`) — confirm/establish this on first backend prompt if not already defined.
- **Permissions:** every endpoint states which role(s) can hit it in the prompt file before implementation — don't infer role access silently.

# Design system — "elegant, slick, modern," not default shadcn

This is a first-class requirement, not a finishing touch. Default, unstyled shadcn is explicitly **not** the bar. (Even though we are using shadcn ui components, I want to build a custom system design)

- **Theme tokens:** All color comes from CSS variables (shadcn theme convention) in one place — never hardcoded hex in components. If no theme exists yet for a screen/feature, ask for the primary color (and accent, if relevant) before building it.
- **Typography:** Pick a restrained type scale (e.g. one display/heading face + one body face, or a single well-weighted family like Inter/Geist) and stick to it. No more than ~5 font-size steps across the whole app.
- **Spacing:** Use a consistent scale (Tailwind's 4px-based scale is fine) — don't eyeball padding/margins per component.
- **Motion:** Subtle, purposeful transitions only (150–250ms, ease-out) — hover/press states, panel open/close, toast in/out. No decorative animation.
- **States are designed, not afterthoughts:** every table/list needs an intentional empty state, loading state (spinner), and error state — not a bare "No data."
- **Icons:** lucide-react only (shadcn's default) for consistency.
- **Responsive:** mobile-first for parent/student-facing views (fee payment, assignment submission, timetable view); admin-heavy views (Kanban timetable editor, activity log, library management) can assume desktop-first but must not break on tablet.
- **Accessibility:** semantic HTML, visible focus states, sufficient contrast against the active theme — non-negotiable, not "nice to have."

# Product

An AI-powered school management system.

**Core entities (CRUD):** subjects, users (roles: `student`, `teacher`, `teacher_admin` i.e. principal/vice principal, `superadmin`, `librarian`, `parent_guardian`), grades, academic years (each with manageable terms).

**Features:**

- **Activity log** — every sensitive/important action (grade changes, role changes, payments, fee waivers, timetable publishing, etc.) is recorded with actor, timestamp, and before/after context.
- **AI-generated assignments** — ask the user whether they want Q&A (question + answer key) or questions-only. Students get instant, AI-scored results on submission.
- **AI timetable generation** — AI produces a first draft. After that, edits happen through a manually-driven Kanban-style board (drag periods/subjects between slots) — no AI involvement in edits.
- **Mini library management** — book catalog, copies/inventory, checkouts, returns, holds, overdue tracking.
- **School fee payments** — Stripe Checkout/Payment Intents, with a dedicated Stripe webhook endpoint that verifies the event signature and updates payment/enrollment status. (Better-auth handles auth/session only — it is not the webhook handler.)

**Do not overbuild.** Ship the smallest version of each feature that's correct and polished, not the maximal one.

# Architecture

Two-service PERN monorepo:

```
/backend    Express REST API — Prisma, Better-auth, Postgres, Stripe webhooks
/frontend   React Router v7 (Framework Mode) — its own server, but treated as
            a client to /backend's API (loaders/actions call the API via
            axios + Tanstack Query), not a place for business logic or
            direct DB access.
```

Rules:

- For backend every file should be in backend/src and the server should be backend/src/server.ts
- Routes lives in /src/routes and controllers lives in src/controllers whenever we are creating CRUD for any model and any other items that may apply.
- All data access, auth checks, and business logic live in `/backend`. `/frontend` loaders/actions are thin — they fetch/mutate against `/backend` and shape data for the UI, nothing more.
- `/frontend` route `loader`/`action` functions run server-side (framework mode) — never call `/backend` in a way that leaks secrets to the client bundle.
- Types from `/backend` live in `/frontend/types.ts` — do not duplicate DTOs by hand. Ask before introducing this if it doesn't exist yet.
- Every design should be a custom one, making it different from any other designs out there, but consistency throughout these system is paramount.
- If a components is required, first check shadcn ui components(`frontend/app/components/ui`) before creating a custom one.
