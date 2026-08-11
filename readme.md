<div align="center">

# 🎓 Biasly — AI-Powered School Management System

A production-grade, full-stack school management system (SMS) that brings together **AI-driven tools**, scheduling, academic tracking, library management, and fee processing in one elegant platform for modern schools.

**Bun · TypeScript · React 19 · Express · Prisma · PostgreSQL · Better Auth · Stripe · Vercel AI SDK (Gemini) · Inngest · EdgeStore**

</div>

---

## 💎 Patreon Members & Code Purchase — Extra Features

Some modules are reserved as **extra features**, unlocked for **Patreon members** and **purchasers of the full source code**:

### 📋 Attendance _(extra)_

- **Daily grade register** and **per-lesson register** with statuses `PRESENT / ABSENT / LATE / EXCUSED`.
- Bulk upsert for fast roll-call, plus role-aware access — teachers only their own classes, parents/students only their own history.

### 📚 Library Management System( _(extra)_

- **Books catalog** with cover uploads (EdgeStore), auto-generated reference numbers (`BK-0001`), and copy/inventory tracking.
- **Borrow / return flow** — race-safe copy decrement on issue, computed **overdue status** on read, and automatic **fines ($0.50/day)** on late returns.

> 👉 Join the **Patreon** or **purchase the code** to unlock Attendance, Library, and any future extra modules.

---

## ✨ Overview

Biasly is a two-service PERN monorepo built for a real school workflow. It covers the full academic year — from enrollment and scheduling to assignments, attendance, library, and fee collection — with **AI assistance** embedded where it saves teachers real time:

- 🤖 **AI assignment generation** — generate tailored quizzes/homework in seconds; students get **instant, AI-scored results** on submission.
- 📅 **AI timetable generation** — Gemini drafts an optimized weekly timetable for a grade (avoiding teacher/room collisions across all grades), then fine-tune it manually on a **Kanban-style drag-and-drop board**.
- 📈 **AI insights** — predictive analytics and early-warning flags on academic performance and attendance.

Everything else is a carefully crafted set of role-aware CRUD modules with a consistent **activity log** (every sensitive action is recorded with actor, timestamp, and context).

## 🧱 Tech Stack

| Layer                 | Technology                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**          | React 19 · React Router 8 (Framework Mode) · Tailwind CSS 4 · shadcn/ui · TanStack Query · TanStack Table · Axios · Vite · lucide-react · Recharts |
| **Backend**           | Express 5 · TypeScript (strict) · Prisma 7 + PostgreSQL · Better Auth · Stripe · Vercel AI SDK (`@ai-sdk/google`) · Inngest · EdgeStore · Zod      |
| **Runtime / Tooling** | Bun (package manager & runtime) · Nodemon · Prisma Migrate                                                                                         |

## 📁 Project Structure

```
sms-pern/
├── backend/                     # Express REST API
│   ├── prisma/
│   │   └── schema.prisma        # Data model (users, academics, fees, …)
│   └── src/
│       ├── server.ts            # Express entry point + route mounting
│       ├── controllers/         # Per-resource business logic
│       ├── routes/              # Per-resource routers (auth + role/permission gated)
│       ├── middlewares/         # requireAuth, requireRole, requirePermission
│       ├── lib/                 # prisma, auth, permissions, stripe, edgestore, activity-log
│       └── inngest/             # AI background functions (timetable, assignments)
└── frontend/                    # React Router app (thin client to /backend)
    └── app/
        ├── routes/              # home, login, dashboard/* (framework-mode loaders/actions)
        ├── components/          # ui/ (shadcn), globals/ (reusable), feature components
        ├── lib/                 # api client, auth-client, TanStack Query hooks
        └── types.ts             # Shared types mirroring backend DTOs
```

## 🚀 Getting Started

> **Prerequisites:** [Bun](https://bun.sh) ≥ 1.3, a PostgreSQL database (e.g. Neon), and API keys for Gemini, Stripe, and EdgeStore.

### 1. Environment variables

Create `backend/.env` (the backend's `prisma.config.ts` and `src/lib/*` read from it):

```env
# Core
DATABASE_URL="postgresql://user:password@host:5432/sms"
BACKEND_URL="http://localhost:5000"
CLIENT_URL="http://localhost:5173"
COOKIE_SECRET="a-long-random-secret"
PORT=5000

# Auth / payments
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# AI (Vercel AI SDK — Google/Gemini)
GOOGLE_GENERATIVE_AI_API_KEY="AIza..."

# EdgeStore (file uploads — book covers, avatars)
EDGE_STORE_ACCESS_KEY="..."
EDGE_STORE_SECRET_KEY="..."
```

Create `frontend/.env` if you need to override the default backend origin:

```env
# Backend API origin (defaults to http://localhost:5000)
VITE_API_URL="http://localhost:5000"
```

### 2. Backend

```bash
cd backend
bun install                 # installs deps + runs `prisma generate` (postinstall)
bunx prisma migrate dev     # create/apply the database schema
bun run dev                 # starts the API with Nodemon → http://localhost:5000
```

### 3. Frontend

```bash
cd frontend
bun install
bun run dev                 # → http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173), sign in, and you're in the dashboard.

## 📜 Available Scripts

| Command                   | Where       | Description                                          |
| ------------------------- | ----------- | ---------------------------------------------------- |
| `bun run dev`             | `frontend/` | Start the dev server with HMR (port 5173)            |
| `bun run build`           | `frontend/` | Production build via `react-router build`            |
| `bun run typecheck`       | `frontend/` | React Router typegen + `tsc`                         |
| `bun run dev`             | `backend/`  | Start the API with Nodemon + `tsx` (port 5000)       |
| `bun run start`           | `backend/`  | Run the compiled server via `tsx src/server.ts`      |
| `bun run typecheck`       | `backend/`  | `tsc --noEmit`                                       |
| `bun run inngest`         | `backend/`  | Launch the Inngest Dev Server for local AI functions |
| `bunx prisma migrate dev` | `backend/`  | Create/apply a new Prisma migration                  |
| `bunx prisma db push`     | `backend/`  | Push schema changes without a migration              |
| `bunx prisma studio`      | `backend/`  | Open the Prisma data explorer                        |

## 🧩 Features

### People & Roles

- **RBAC with 10 roles** — `SUPER_ADMIN`, `PRINCIPAL`, `VICE_PRINCIPAL`, `TEACHER`, `LIBRARIAN`, `ACCOUNTANT`, `COUNSELOR`, `STAFF`, `STUDENT`, `PARENT` — enforced server-side via `requireAuth` + `requireRole` + `requirePermission` middlewares.
- **Full CRUD** for students, teachers, parents, and staff, with role-specific profiles (`StudentProfile`, `StaffProfile`, `ParentProfile`) and auto-generated **admission numbers** / **employee IDs** (e.g. `26-0001`).

### Academics

- **Academic years → terms → grades → subjects**, with teacher–grade–subject assignments (`TeachergradeSubject`) powering timetables and per-class scoping.
- **AI assignment generator** — teachers pick _Q&A (with answer key)_ or _questions-only_; a background Inngest function calls Gemini (`gemini-3.6-flash`) and stores the draft. Students submit and receive **instant AI-scored results** with per-question feedback.
- **AI timetable generation** — one click produces an AI first draft for a grade; admins then edit via a drag-and-drop board (no AI involved in edits). Lesson-context snapshots on attendance records survive timetable regeneration.

### Attendance _(extra — Patreon / code purchase)_

- **Daily grade register** and **per-lesson register** with statuses `PRESENT / ABSENT / LATE / EXCUSED`, bulk upsert, and role-aware access (teachers only their own classes; parents/students see their own history).

### Library _(extra — Patreon / code purchase)_

- **Books catalog** with cover uploads (EdgeStore), auto-generated reference numbers (`BK-0001`), and copy tracking.
- **Borrow / return flow** — race-safe copy decrement on issue, computed **overdue status** on read, and automatic **fines ($0.50/day)** on late returns.

> 💡 In this free source code these two modules are **not included** — their dashboard routes render a simple placeholder page. Join the **Patreon** or **purchase the code** to get the full implementations.
>
> **Note:** the Prisma schema here also excludes the Attendance/Library tables. If you are upgrading from a previous version that included them, run `bunx prisma migrate dev` to sync your database (this drops the old `student_attendance`, `book`, and `book_issue` tables).

### Finance

- **Fee structures** — one fee amount per grade per term.
- **Invoices** with `UNPAID / PARTIALLY_PAID / PAID / CANCELLED` statuses.
- **Stripe payments** — one-time Checkout sessions for fees; a signature-verified Stripe webhook (via the Better Auth Stripe plugin) records completed payments back into the system.

### Platform

- **Activity log** — every sensitive action (grade changes, role changes, payments, timetable publishing, etc.) with actor, timestamp, and context.
- **Role-aware dashboards** — whole-school analytics for management, personalized timetables for teachers, and student/parent views.
- **Analytics** — school-wide, finance, and library analytics dashboards (Recharts).
- **Announcements** — role-targeted broadcasts.
- **AI insights** — per-student predictive analytics and recommendations (`AiInsight`).

## 🏗️ Architecture Notes

- **Two-service monorepo.** `/backend` owns all data access, auth checks, and business logic; `/frontend` loaders/actions are thin — they fetch/mutate against the API and shape data for the UI, never touching the database directly.
- **Framework Mode.** Frontend routes run server-side in React Router framework mode; never call `/backend` in a way that leaks secrets into the client bundle.
- **API conventions.** REST resources are plural and kebab-case (`/api/book-issues`); errors return a consistent shape: `{ error: { code, message } }`.
- **AI as background work.** Heavy AI calls (timetable, assignment generation) run as durable **Inngest functions**, so long-running generations survive restarts and retry automatically.
- **Prisma 7 driver adapters.** The backend uses the `pg` pool + `PrismaPg` driver-adapter pattern.

## 🔒 Security

- Helmet security headers, CORS restricted to `CLIENT_URL` with credentials.
- Session cookies (`httpOnly`, `SameSite`/`Secure` tuned per environment) via Better Auth.
- Rate limiting on auth endpoints (Better Auth).
- Stripe webhook signature verification; soft deletes preserve the audit trail.
- Role/permission checks on **every** endpoint — never trusted from the client.

## ☁️ Deployment

Both services ship with `vercel.json` and are designed for serverless deployment:

```bash
# Backend → Vercel (see backend/vercel.json)
vercel deploy --prod

# Frontend → Vercel (see frontend/vercel.json — rewrites /edgestore/* to the backend)
vercel deploy --prod
```

The frontend rewrites EdgeStore upload requests to the deployed backend URL, so file uploads keep working in production. Set the same environment variables above in both Vercel projects.

> **Note for backend deploys:** all backend imports use `.js` extensions (ESM) — required for the Vercel build.

## 📄 License

Private project — all rights reserved. © Biasly.
