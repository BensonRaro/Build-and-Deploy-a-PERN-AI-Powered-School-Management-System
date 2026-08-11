/**
 * requireAuth — Express middleware for Better Auth session verification
 *
 * Verifies every incoming request has a valid Better Auth session before
 * allowing access to protected routes. Attaches the authenticated user
 * and session data to the request object for downstream handlers.
 *
 * Usage:
 *   import { requireAuth } from "./middlewares/requireAuth.js";
 *
 *   // Protect a single route
 *   app.get("/api/students", requireAuth, studentsController.list);
 *
 *   // Protect an entire router
 *   router.use(requireAuth);
 *
 * Response on failure (401):
 *   { error: { code: "UNAUTHORIZED", message: "..." } }
 */

import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";

import { auth } from "../lib/auth.js";

// ─── Type Augmentation ─────────────────────────────────────────────────────────
//
// Extends Express's Request interface so downstream handlers can access
// `req.user` and `req.session` without manual casting.

declare global {
  namespace Express {
    interface Request {
      /** The authenticated user's profile (id, name, email, role, etc.). */
      user?: typeof auth.$Infer.Session.user;
      /** The active session metadata (expiry, token, ip, etc.). */
      session?: typeof auth.$Infer.Session.session;
    }
  }
}

// ─── Middleware ────────────────────────────────────────────────────────────────

/**
 * Middleware that verifies a valid Better Auth session exists for the request.
 *
 * - On success: attaches `req.user` and `req.session`, then calls `next()`.
 * - On failure: responds with 401 and a consistent error shape.
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Convert Express/node headers to the standard Headers API format
    // that Better Auth's getSession expects.
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    // No session means the request is unauthenticated
    if (!session) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message:
            "Authentication required. Please sign in to access this resource.",
        },
      });
    }

    // Attach session data so downstream handlers can access the user
    req.user = session.user;
    req.session = session.session;

    next();
  } catch (error) {
    // Defensive: if getSession throws (e.g. malformed cookie, crypto error),
    // treat it as an authentication failure rather than crashing the server.
    console.error("[requireAuth] Session verification error:", error);

    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or expired session. Please sign in again.",
      },
    });
  }
};
