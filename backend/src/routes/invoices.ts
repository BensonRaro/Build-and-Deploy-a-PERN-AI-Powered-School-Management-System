/**
 * Invoices Routes
 *
 * HTTP endpoints for school-fee invoices.
 *
 * Route prefix: /api/invoices
 *
 * Endpoints:
 *   GET /my      — The current user's invoices (student → own, parent → children)
 *   GET /        — Full invoice list for management (?status, ?academicYearId)
 *   GET /:id     — Single invoice with full item + payment breakdown
 */

import { Router } from "express";

import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import {
  listInvoices,
  getMyInvoices,
  getInvoice,
} from "../controllers/invoices.js";

const router = Router();

// All invoice routes require authentication
router.use(requireAuth);

/**
 * GET /api/invoices/my
 * Students see their own invoices; parents see their linked children's.
 * The controller scopes the query to the caller — no role guard needed.
 */
router.get("/my", getMyInvoices);

/**
 * GET /api/invoices
 * Full invoice list for financial oversight (management roles only).
 */
router.get(
  "/",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "ACCOUNTANT"),
  listInvoices,
);

/**
 * GET /api/invoices/:id
 * Single-invoice detail. Management roles can read any invoice; students and
 * parents are restricted to invoices they own (checked in the controller).
 */
router.get("/:id", getInvoice);

export default router;
