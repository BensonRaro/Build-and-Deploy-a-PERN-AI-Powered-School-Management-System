/**
 * Timetable Routes
 *
 * HTTP endpoints for managing grade timetables.
 * All handler logic lives in the corresponding controller module.
 *
 * Route prefix: /api/timetable
 *
 * Endpoints:
 *   GET    /                  — List timetable slots for a grade (?gradeId=)
 *   POST   /generate          — Trigger AI timetable generation via Inngest
 *   PATCH  /:id               — Update a single timetable slot (admin)
 *   DELETE /:id               — Delete a single timetable slot (admin)
 */

import { Router } from "express";

import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import {
  listTimetableSlots,
  getMyTimetable,
  generateTimetableSlots,
  updateTimetableSlot,
  deleteTimetableSlot,
} from "../controllers/timetable.js";

const router = Router();

// All timetable routes require authentication
router.use(requireAuth);

/** GET /api/timetable — List slots for a grade (?gradeId=) */
router.get(
  "/",
  requireRole(
    "SUPER_ADMIN",
    "PRINCIPAL",
    "VICE_PRINCIPAL",
    "TEACHER",
    "STAFF",
    "STUDENT",
    "PARENT",
  ),
  listTimetableSlots,
);

/** GET /api/timetable/my — Personalized timetable (student grade / teacher classes) */
router.get("/my", getMyTimetable);

/** POST /api/timetable/generate — Trigger AI generation */
router.post(
  "/generate",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"),
  generateTimetableSlots,
);

/** PATCH /api/timetable/:id — Update a single slot (admin edit) */
router.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"),
  updateTimetableSlot,
);

/** DELETE /api/timetable/:id — Delete a single slot (admin) */
router.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"),
  deleteTimetableSlot,
);

export default router;
