/**
 * Student Guardians Routes
 *
 * HTTP endpoints for managing links between student and parent profiles.
 * All handler logic lives in the corresponding controller module.
 *
 * Route prefix: /api/student-guardians
 *
 * Endpoints:
 *   GET    /              — List all guardian links (optionally filtered)
 *   POST   /              — Create a new guardian link
 *   DELETE /:id           — Remove a guardian link (admin only)
 */

import { Router } from "express";

import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import {
  listStudentGuardians,
  createStudentGuardian,
  deleteStudentGuardian,
} from "../controllers/student-guardians.js";

const router = Router();

// All routes require authentication
router.use(requireAuth);

/** GET /api/student-guardians — List all guardian links (optionally filtered) */
router.get(
  "/",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "TEACHER", "STAFF"),
  listStudentGuardians,
);

/** POST /api/student-guardians — Create a new guardian link */
router.post(
  "/",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"),
  createStudentGuardian,
);

/** DELETE /api/student-guardians/:id — Remove a guardian link */
router.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL"),
  deleteStudentGuardian,
);

export default router;
