/**
 * Analytics Routes
 *
 * HTTP endpoints for whole-school analytics.
 *
 * Route prefix: /api/analytics
 *
 * Endpoints:
 *   GET /overview — Whole-school summary (management roles only)
 */

import { Router } from "express";

import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import { getSchoolAnalytics } from "../controllers/analytics.js";

const router = Router();

// All analytics routes require authentication
router.use(requireAuth);

/** GET /api/analytics/overview — Whole-school analytics for management */
router.get(
  "/overview",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "ACCOUNTANT"),
  getSchoolAnalytics,
);

export default router;
