/**
 * Academic Years Routes
 *
 * HTTP endpoints for managing academic years.
 * All handler logic lives in the corresponding controller module.
 *
 * Route prefix: /api/academic-years
 *
 * Endpoints:
 *   GET    /              — List all academic years
 *   GET    /:id           — Get a single academic year with terms
 *   POST   /              — Create a new academic year
 *   PATCH  /:id           — Update an academic year
 *   DELETE /:id           — Delete an academic year (admin only)
 */

import { Router } from "express";

import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import {
  listAcademicYears,
  getAcademicYear,
  createAcademicYear,
  updateAcademicYear,
  deleteAcademicYear,
} from "../controllers/academic-years.js";

const router = Router();

// All academic year routes require authentication
router.use(requireAuth);

/** GET /api/academic-years — List all years (newest first) */
router.get(
  "/",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "TEACHER", "STAFF", "STUDENT", "PARENT"),
  listAcademicYears,
);

/** GET /api/academic-years/:id — Get a single year with terms */
router.get(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "TEACHER", "STAFF", "STUDENT", "PARENT"),
  getAcademicYear,
);

/** POST /api/academic-years — Create a new year */
router.post(
  "/",
  requireRole("SUPER_ADMIN", "PRINCIPAL"),
  createAcademicYear,
);

/** PATCH /api/academic-years/:id — Update an existing year */
router.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL"),
  updateAcademicYear,
);

/** DELETE /api/academic-years/:id — Delete a year (SUPER_ADMIN only) */
router.delete(
  "/:id",
  requireRole("SUPER_ADMIN"),
  deleteAcademicYear,
);

export default router;
