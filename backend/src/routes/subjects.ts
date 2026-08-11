/**
 * Subjects Routes
 *
 * HTTP endpoints for managing subjects.
 * All handler logic lives in the corresponding controller module.
 *
 * Route prefix: /api/subjects
 *
 * Endpoints:
 *   GET    /              — List all subjects (optionally filtered by gradeId/academicYearId)
 *   GET    /:id           — Get a single subject
 *   POST   /              — Create a new subject
 *   PATCH  /:id           — Update an existing subject
 *   DELETE /:id           — Delete a subject (admin only)
 */

import { Router } from "express";

import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import {
  listSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
} from "../controllers/subjects.js";

const router = Router();

// All subject routes require authentication
router.use(requireAuth);

/** GET /api/subjects — List all subjects (optionally filtered) */
router.get(
  "/",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "TEACHER", "STAFF", "STUDENT", "PARENT"),
  listSubjects,
);

/** GET /api/subjects/:id — Get a single subject */
router.get(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "TEACHER", "STAFF", "STUDENT", "PARENT"),
  getSubject,
);

/** POST /api/subjects — Create a new subject */
router.post(
  "/",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"),
  createSubject,
);

/** PATCH /api/subjects/:id — Update an existing subject */
router.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"),
  updateSubject,
);

/** DELETE /api/subjects/:id — Delete a subject (admin only) */
router.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL"),
  deleteSubject,
);

export default router;
