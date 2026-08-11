/**
 * Users Routes
 *
 * HTTP endpoints for managing users and their profiles.
 * All handler logic lives in the corresponding controller module.
 *
 * Route prefix: /api/users
 *
 * Endpoints:
 *   GET    /              — List all users (optionally filtered)
 *   GET    /:id           — Get a single user with profile
 *   POST   /              — Create a new user with profile
 *   PATCH  /:id           — Update an existing user
 *   DELETE /:id           — Soft-delete a user (admin only)
 */

import { Router } from "express";

import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
} from "../controllers/users.js";

const router = Router();

// All user routes require authentication
router.use(requireAuth);

/** GET /api/users — List all users (optionally filtered) */
router.get(
  "/",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "TEACHER", "STAFF"),
  listUsers,
);

/** GET /api/users/:id — Get a single user */
router.get(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "TEACHER", "STAFF"),
  getUser,
);

/** POST /api/users — Create a new user with profile */
router.post(
  "/",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"),
  createUser,
);

/** PATCH /api/users/:id — Update an existing user */
router.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"),
  updateUser,
);

/** DELETE /api/users/:id — Soft-delete a user (admin only) */
router.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "PRINCIPAL"),
  deleteUser,
);

export default router;
