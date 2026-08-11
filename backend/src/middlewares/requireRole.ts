/**
 * requireRole — Express middleware for role-based access control
 *
 * Checks that the authenticated user (populated by `requireAuth`) has one of
 * the specified roles. Must be used AFTER `requireAuth` on a route, since it
 * depends on `req.user` being populated by the auth middleware.
 *
 * Usage:
 *   import { requireAuth } from "./middlewares/requireAuth.js";
 *   import { requireRole } from "./middlewares/requireRole.js";
 *
 *   // Only SUPER_ADMIN and PRINCIPAL can access this route
 *   app.get(
 *     "/api/students",
 *     requireAuth,
 *     requireRole("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"),
 *     studentsController.list,
 *   );
 *
 * Response on failure (403):
 *   { error: { code: "FORBIDDEN", message: "..." } }
 */

import type { NextFunction, Request, Response } from "express";
import type { Role } from "../lib/permissions.js";
import { logActivityAsync } from "../lib/activity-log.js";

// ─── Middleware Factory ───────────────────────────────────────────────────────

/**
 * Creates an Express middleware that restricts access to users with one of the
 * specified roles. Returns 403 if the user's role is not in the allowed list.
 *
 * @param allowedRoles - One or more role names (e.g. "SUPER_ADMIN", "TEACHER")
 *                       that are permitted to access the route.
 */
export const requireRole =
  (...allowedRoles: Role[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    // Ensure authentication middleware has run first
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message:
            "Authentication required. Use requireAuth middleware before requireRole.",
        },
      });
    }

    // Check if the user's role is in the allowed list.
    // req.user.role comes from Better Auth's session as a string;
    // we assert it to Role (our custom union) since it maps directly
    // to the Prisma Role enum values.
    if (!allowedRoles.includes(req.user.role as Role)) {
      // Fire-and-forget — don't add a DB round-trip to the denial path
      logActivityAsync({
        userId: req.user.id,
        activity: `${req.user.name} tried to access UNAUTHORIZED route`,
      });

      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message:
            "You do not have permission to access this resource. Contact your administrator if you believe this is a mistake.",
        },
      });
    }

    next();
  };
