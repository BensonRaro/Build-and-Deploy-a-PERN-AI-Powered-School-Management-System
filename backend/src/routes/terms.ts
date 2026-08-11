/**
 * Terms Routes
 *
 * HTTP endpoints for managing academic terms.
 * All handler logic lives in the corresponding controller module.
 *
 * Route prefix: /api/terms
 *
 * Endpoints:
 *   GET    /              — List all terms (optionally filtered by academicYearId)
 *   GET    /:id           — Get a single term
 *   POST   /              — Create a new term
 *   PATCH  /:id           — Update an existing term
 *   DELETE /:id           — Delete a term (admin only)
 */

import { Router } from "express";

import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import {
  listTerms,
  getTerm,
  createTerm,
  updateTerm,
  deleteTerm,
} from "../controllers/terms.js";

const router = Router();

// All term routes require authentication
router.use(requireAuth);

/** GET /api/terms — List all terms (optionally filtered by academicYearId) */
router.get(
  "/",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "TEACHER", "STAFF", "STUDENT", "PARENT"),
  listTerms,
);

/** GET /api/terms/:id — Get a single term */
router.get(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "TEACHER", "STAFF", "STUDENT", "PARENT"),
  getTerm,
);

/** POST /api/terms — Create a new term */
router.post(
  "/",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"),
  createTerm,
);

/** PATCH /api/terms/:id — Update an existing term */
router.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"),
  updateTerm,
);

/** DELETE /api/terms/:id — Delete a term (admin only) */
router.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL"),
  deleteTerm,
);

export default router;
