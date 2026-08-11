/**
 * Fees Routes
 *
 * HTTP endpoints for managing school fee structures (one fee amount per
 * grade per term). All handler logic lives in the corresponding controller.
 *
 * Route prefix: /api/fees
 *
 * Endpoints:
 *   GET    /              — List fee structures (filter by gradeId/termId/academicYearId)
 *   GET    /:id           — Get a single fee structure
 *   POST   /              — Create a fee structure (grade + term + amount)
 *   PATCH  /:id           — Update a fee structure
 *   DELETE /:id           — Delete a fee structure (admin only)
 */

import { Router } from "express";

import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import {
  listFees,
  getFee,
  createFee,
  updateFee,
  deleteFee,
} from "../controllers/fees.js";

const router = Router();

// All fee routes require authentication
router.use(requireAuth);

/** GET /api/fees — List fee structures (optionally filtered) */
router.get(
  "/",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "ACCOUNTANT"),
  listFees,
);

/** GET /api/fees/:id — Get a single fee structure */
router.get(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "ACCOUNTANT"),
  getFee,
);

/** POST /api/fees — Create a new fee structure */
router.post(
  "/",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT"),
  createFee,
);

/** PATCH /api/fees/:id — Update an existing fee structure */
router.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT"),
  updateFee,
);

/** DELETE /api/fees/:id — Delete a fee structure (admin only) */
router.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL"),
  deleteFee,
);

export default router;
