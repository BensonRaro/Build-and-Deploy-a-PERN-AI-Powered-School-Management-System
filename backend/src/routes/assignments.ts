/**
 * Assignments Routes
 *
 * HTTP endpoints for AI-generated assignments and student submissions.
 * All handler logic lives in the corresponding controller module.
 *
 * Route prefix: /api/assignments
 *
 * Endpoints:
 *   GET    /                          — List assignments (role-aware)
 *   POST   /generate                  — Trigger AI question generation (Inngest)
 *   GET    /generate/:jobId           — Poll an AI generation job
 *   POST   /                          — Create an assignment
 *   GET    /:id                       — Get a single assignment
 *   PATCH  /:id                       — Update an assignment
 *   DELETE /:id                       — Delete an assignment (admin only)
 *   POST   /:id/submit                — Student submits answers (instant AI grading)
 *   GET    /:id/submissions           — List submissions for an assignment
 *   PATCH  /submissions/:submissionId — Manually grade a submission
 */

import { Router } from "express";

import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import {
  listAssignments,
  getAssignment,
  generateAssignmentQuestions,
  getGenerationJob,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  listAssignmentSubmissions,
  gradeSubmission,
} from "../controllers/assignments.js";

const router = Router();

// All assignment routes require authentication
router.use(requireAuth);

/** GET /api/assignments — List assignments (role-aware) */
router.get(
  "/",
  requireRole(
    "SUPER_ADMIN",
    "PRINCIPAL",
    "VICE_PRINCIPAL",
    "TEACHER",
    "COUNSELOR",
    "STUDENT",
    "PARENT",
  ),
  listAssignments,
);

/** POST /api/assignments/generate — Trigger AI question generation (Inngest) */
router.post(
  "/generate",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "TEACHER"),
  generateAssignmentQuestions,
);

/** GET /api/assignments/generate/:jobId — Poll an AI generation job */
router.get(
  "/generate/:jobId",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "TEACHER"),
  getGenerationJob,
);

/** POST /api/assignments — Create a new assignment */
router.post(
  "/",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "TEACHER"),
  createAssignment,
);

/** GET /api/assignments/:id — Get a single assignment */
router.get(
  "/:id",
  requireRole(
    "SUPER_ADMIN",
    "PRINCIPAL",
    "VICE_PRINCIPAL",
    "TEACHER",
    "COUNSELOR",
    "STUDENT",
    "PARENT",
  ),
  getAssignment,
);

/** PATCH /api/assignments/:id — Update an assignment */
router.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "TEACHER"),
  updateAssignment,
);

/** DELETE /api/assignments/:id — Delete an assignment (admin only) */
router.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL"),
  deleteAssignment,
);

/** POST /api/assignments/:id/submit — Student submits answers (instant grading) */
router.post(
  "/:id/submit",
  requireRole("STUDENT"),
  submitAssignment,
);

/** GET /api/assignments/:id/submissions — List submissions */
router.get(
  "/:id/submissions",
  requireRole(
    "SUPER_ADMIN",
    "PRINCIPAL",
    "VICE_PRINCIPAL",
    "TEACHER",
    "COUNSELOR",
  ),
  listAssignmentSubmissions,
);

/** PATCH /api/assignments/submissions/:submissionId — Manually grade */
router.patch(
  "/submissions/:submissionId",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "TEACHER"),
  gradeSubmission,
);

export default router;
