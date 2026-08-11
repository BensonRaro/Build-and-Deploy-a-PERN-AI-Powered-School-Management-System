/**
 * Payments Routes
 *
 * HTTP endpoints for school-fee payments via Stripe Checkout.
 *
 * Route prefix: /api/payments
 *
 * Endpoints:
 *   GET  /my        — Fee bills + payment status for the current user
 *                     (students see their own, parents see their children)
 *   POST /checkout  — Create a Stripe Checkout session for a fee structure
 *   GET  /          — Full payments ledger (management roles only)
 */

import { Router } from "express";

import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import {
  getMyPayments,
  createCheckout,
  listPayments,
} from "../controllers/payments.js";

const router = Router();

// All payment routes require authentication
router.use(requireAuth);

/**
 * GET /api/payments/my
 * Students pay their own fees; parents pay for their linked children;
 * management can query an explicit ?studentProfileId.
 */
router.get("/my", getMyPayments);

/**
 * POST /api/payments/checkout
 * Initiates a Stripe Checkout session for a fee structure.
 * Available to students, parents, and management.
 */
router.post(
  "/checkout",
  requireRole(
    "SUPER_ADMIN",
    "PRINCIPAL",
    "VICE_PRINCIPAL",
    "ACCOUNTANT",
    "STUDENT",
    "PARENT",
  ),
  createCheckout,
);

/**
 * GET /api/payments
 * Full payments ledger for financial oversight.
 */
router.get(
  "/",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "ACCOUNTANT"),
  listPayments,
);

export default router;
