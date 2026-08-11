/**
 * Activity Logs Routes
 *
 * HTTP endpoints for querying and managing audit/activity log entries.
 * All handler logic lives in the corresponding controller module.
 *
 * Route prefix: /api/activity-logs
 *
 * Endpoints:
 *   GET   /              — List activity logs (paginated, filterable)
 *   GET   /:id           — Get a single activity log
 *   DELETE /:id          — Delete an activity log (admin only)
 */

import { Router } from "express";

import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import {
  listActivityLogs,
  getActivityLog,
} from "../controllers/activity-logs.js";

const router = Router();

// All activity log routes require authentication
router.use(requireAuth);

/** GET /api/activity-logs — List logs (paginated, filterable) */
router.get(
  "/",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"),
  listActivityLogs,
);

/** GET /api/activity-logs/:id — Get a single log */
router.get(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"),
  getActivityLog,
);

export default router;
