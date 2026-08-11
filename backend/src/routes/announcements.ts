/**
 * Announcements Routes
 *
 * HTTP endpoints for managing announcements.
 * All handler logic lives in the corresponding controller module.
 *
 * Route prefix: /api/announcements
 *
 * Endpoints:
 *   GET    /              — List all announcements (optionally filtered)
 *   GET    /:id           — Get a single announcement
 *   POST   /              — Create a new announcement
 *   PATCH  /:id           — Update an existing announcement
 *   DELETE /:id           — Delete an announcement (admin only)
 */

import { Router } from "express";

import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import {
  listAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "../controllers/announcements.js";

const router = Router();

// All announcement routes require authentication
router.use(requireAuth);

/** GET /api/announcements — List all announcements (optionally filtered) */
router.get(
  "/",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "TEACHER", "LIBRARIAN", "ACCOUNTANT", "COUNSELOR", "STAFF", "STUDENT", "PARENT"),
  listAnnouncements,
);

/** GET /api/announcements/:id — Get a single announcement */
router.get(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "TEACHER", "LIBRARIAN", "ACCOUNTANT", "COUNSELOR", "STAFF", "STUDENT", "PARENT"),
  getAnnouncement,
);

/** POST /api/announcements — Create a new announcement */
router.post(
  "/",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"),
  createAnnouncement,
);

/** PATCH /api/announcements/:id — Update an existing announcement */
router.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"),
  updateAnnouncement,
);

/** DELETE /api/announcements/:id — Delete an announcement (admin only) */
router.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL"),
  deleteAnnouncement,
);

export default router;
