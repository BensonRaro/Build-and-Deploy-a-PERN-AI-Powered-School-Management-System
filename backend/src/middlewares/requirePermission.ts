import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { logActivityAsync } from "../lib/activity-log.js";
import type { Permission, Resource } from "../lib/permissions.js";

// ---------------------------------------------------------------------------
// requirePermission
// ---------------------------------------------------------------------------

/**
 * Fine-grained permission guard.
 *
 * Checks whether the authenticated user's role has the given `action`
 * on the given `resource` via better-auth's access-control engine.
 *
 * Stack this after `requireAuth` OR use it standalone (it re-fetches the
 * session internally so the double fetch is intentional — keeps the
 * middleware independent and composable).
 *
 * @example
 * // Only users who can `publish` grades may hit this endpoint
 * router.post(
 *   "/grades/:id/publish",
 *   requirePermission("grade", "publish"),
 *   publishGrade,
 * );
 */
export const requirePermission = (resource: Resource, action: Permission) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Verify the session
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      if (!session || !session.user) {
        return res.status(401).json({ error: "Unauthorized: Please log in." });
      }

      // 2. Ask better-auth whether this user's role has the required permission
      const permissionResponse = await auth.api.userHasPermission({
        headers: fromNodeHeaders(req.headers),
        body: {
          permissions: {
            [resource]: [action],
          },
        },
      });

      if (permissionResponse.error) {
        console.error("Permission check error:", permissionResponse.error);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      if (permissionResponse.success) {
        (req as any).user = session.user;
        (req as any).session = session.session;
        return next();
      }

      // 3. Log the denied attempt (fire-and-forget — don't delay the 403)
      logActivityAsync({
        userId: session.user.id,
        activity: `${resource}:${action} — denied`,
        details: `User ${session.user.id} (role: ${(session.user as any).role ?? "unknown"}) attempted ${resource}:${action}`,
      });

      return res.status(403).json({
        error: `Forbidden: Missing '${action}' permission on '${resource}'.`,
      });
    } catch (error) {
      console.error("Authorization Error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };
};
