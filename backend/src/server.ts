import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { toNodeHandler } from "better-auth/node";
import { serve } from "inngest/express";

/**
 * Express application entry point for the School Management System API.
 *
 * Initializes the Express server with:
 * - Dotenv (load environment variables from .env)
 * - Helmet (secure HTTP headers)
 * - CORS (cross-origin requests from the frontend)
 * - Cookie parser (parse cookies for auth/sessions)
 * - JSON body parsing
 * - URL-encoded body parsing (form submissions)
 * - Prisma (database connection via the singleton client)
 * - A health-check route at GET /
 */

// ─── App Initialization ───────────────────────────────────────────────────────

import { prisma } from "./lib/prisma.js";
import { auth } from "./lib/auth.js";
import { requireAuth } from "./middlewares/requireAuth.js";
import { requirePermission } from "./middlewares/requirePermission.js";
import { logActivity } from "./lib/activity-log.js";
import activityLogsRouter from "./routes/activity-logs.js";
import academicYearsRouter from "./routes/academic-years.js";
import termsRouter from "./routes/terms.js";
import gradesRouter from "./routes/grades.js";
import feesRouter from "./routes/fees.js";
import paymentsRouter from "./routes/payments.js";
import invoicesRouter from "./routes/invoices.js";
import financeRouter from "./routes/finance.js";
import analyticsRouter from "./routes/analytics.js";
import subjectsRouter from "./routes/subjects.js";
import usersRouter from "./routes/users.js";
import studentGuardiansRouter from "./routes/student-guardians.js";
import announcementsRouter from "./routes/announcements.js";
import assignmentsRouter from "./routes/assignments.js";
import timetableRouter from "./routes/timetable.js";
import { inngest, functions } from "./inngest/client.js";
import { edgestoreHandler } from "./lib/edgestore.js";

const app = express();
const PORT = process.env.PORT ?? 5000;

// ─── Security Middleware ──────────────────────────────────────────────────────

// Helmet sets secure HTTP headers (e.g. CSP, X-Frame-Options, etc.)
app.use(helmet());

// CORS — allows the frontend to call the API with credentials (cookies)
app.use(
  cors({
    origin: process.env.CLIENT_URL ?? "http://localhost:5173",
    credentials: true, // allow cookies to be sent cross-origin
  }),
);

app.all("/api/auth/*splat", toNodeHandler(auth)); // For ExpressJS v5

// ─── Request Parsing Middleware ───────────────────────────────────────────────

// Parse cookies — signs them with the secret for tamper detection
app.use(cookieParser(process.env.COOKIE_SECRET));

// Parse incoming JSON request bodies (limit: 50kb — increased for assessment payloads)
app.use(express.json());

// Parse URL-encoded form data (e.g. <form> submissions)
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// set the get and post routes for the edgestore router
app.get("/edgestore/*splat", edgestoreHandler);
app.post("/edgestore/*splat", edgestoreHandler);

/**
 * Activity Logs
 *
 * CRUD endpoints for viewing and managing audit/activity log entries.
 * All routes are behind authentication; write-access is admin-only.
 */
app.use("/api/activity-logs", activityLogsRouter);

/**
 * Academic Years
 *
 * CRUD endpoints for managing academic years — the foundational academic
 * structure that terms, grades, subjects, and enrollments reference.
 */
app.use("/api/academic-years", academicYearsRouter);

/**
 * Terms
 *
 * CRUD endpoints for managing academic terms within academic years.
 */
app.use("/api/terms", termsRouter);

/**
 * Grades
 *
 * CRUD endpoints for managing grades/classes within academic years.
 */
app.use("/api/grades", gradesRouter);

/**
 * Fees
 *
 * CRUD endpoints for managing school fee structures — one fee amount per
 * grade per term (e.g. "Grade 10 — Term 1 — 250.00").
 */
app.use("/api/fees", feesRouter);

/**
 * Payments
 *
 * Endpoints for school-fee payments via Stripe Checkout — students/parents
 * pay fee structures online; webhooks (handled by the @better-auth/stripe
 * plugin at /api/auth/stripe/webhook) record completed payments.
 */
app.use("/api/payments", paymentsRouter);

/**
 * Invoices
 *
 * Endpoints for school-fee invoices — management list with status filters,
 * per-user invoices for students/parents, and full payment breakdowns.
 */
app.use("/api/invoices", invoicesRouter);

/**
 * Finance
 *
 * Management endpoints for whole-school financial analytics.
 */
app.use("/api/finance", financeRouter);

/**
 * Analytics
 *
 * Whole-school analytics overview for the management dashboard.
 */
app.use("/api/analytics", analyticsRouter);

/**
 * Subjects
 *
 * CRUD endpoints for managing subjects within grades and academic years.
 */
app.use("/api/subjects", subjectsRouter);

/**
 * Users
 *
 * CRUD endpoints for managing users with role-based profiles
 * (StudentProfile, ParentProfile, StaffProfile).
 */
app.use("/api/users", usersRouter);

/**
 * Student Guardians
 *
 * Endpoints for managing links between student and parent profiles.
 */
app.use("/api/student-guardians", studentGuardiansRouter);

/**
 * Announcements
 *
 * CRUD endpoints for managing broadcast announcements targeted at
 * specific roles (e.g. TEACHER, STUDENT, PARENT).
 */
app.use("/api/announcements", announcementsRouter);

/**
 * Assignments
 *
 * Endpoints for AI-generated assignments, student submissions, and
 * instant auto-grading via Gemini.
 */
app.use("/api/assignments", assignmentsRouter);

/**
 * Timetable
 *
 * Endpoints for viewing and managing grade timetables.
 * Includes AI generation via Inngest + Gemini.
 */
app.use("/api/timetable", timetableRouter);

// inngest
app.use("/api/inngest", serve({ client: inngest, functions }));

/**
 * GET /
 * Health-check endpoint to confirm the server and database are running.
 */
app.get("/", async (req, res) => {
  // Log health-check accesses for monitoring (fire-and-forget — don't block)
  try {
    // Verify database connection with a lightweight query
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      message: "School Management System API is running",
      database: "connected",
    });
  } catch {
    res.status(503).json({
      status: "error",
      message: "School Management System API is running",
      database: "disconnected",
    });
  }
});

// ─── Server Start ─────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

export default app;
