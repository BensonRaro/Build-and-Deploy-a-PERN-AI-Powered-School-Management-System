/**
 * Finance Routes
 *
 * Management endpoints for whole-school financial analytics.
 *
 * Route prefix: /api/finance
 *
 * Endpoints:
 *   GET /analytics — Whole-school financial summary (billed/collected/
 *                    outstanding, by term, by grade, by method, trend)
 */

import { Router } from "express";

import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import { getFinanceAnalytics } from "../controllers/finance.js";

const router = Router();

// All finance routes require authentication
router.use(requireAuth);

/**
 * GET /api/finance/analytics
 * Management-only financial dashboard data.
 */
router.get(
  "/analytics",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "ACCOUNTANT"),
  getFinanceAnalytics,
);

export default router;
