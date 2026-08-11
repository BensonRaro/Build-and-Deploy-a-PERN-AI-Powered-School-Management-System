/**
 * Grades Routes
 *
 * HTTP endpoints for managing grades/classes.
 * All handler logic lives in the corresponding controller module.
 *
 * Route prefix: /api/grades
 *
 * Endpoints:
 *   GET    /              — List all grades (optionally filtered by academicYearId)
 *   GET    /:id           — Get a single grade
 *   POST   /              — Create a new grade
 *   PATCH  /:id           — Update an existing grade
 *   DELETE /:id           — Delete a grade (admin only)
 */

import { Router } from "express";

import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import {
  listGrades,
  getGrade,
  createGrade,
  updateGrade,
  deleteGrade,
} from "../controllers/grades.js";

const router = Router();

// All grade routes require authentication
router.use(requireAuth);

/** GET /api/grades — List all grades (optionally filtered by academicYearId) */
router.get(
  "/",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "TEACHER", "STAFF", "STUDENT", "PARENT"),
  listGrades,
);

/** GET /api/grades/:id — Get a single grade */
router.get(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "TEACHER", "STAFF", "STUDENT", "PARENT"),
  getGrade,
);

/** POST /api/grades — Create a new grade */
router.post(
  "/",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"),
  createGrade,
);

/** PATCH /api/grades/:id — Update an existing grade */
router.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"),
  updateGrade,
);

/** DELETE /api/grades/:id — Delete a grade (admin only) */
router.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL"),
  deleteGrade,
);

export default router;
