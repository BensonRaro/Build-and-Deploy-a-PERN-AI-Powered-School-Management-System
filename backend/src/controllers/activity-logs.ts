/**
 * Activity Logs Controller
 *
 * Request handlers for activity log CRUD operations.
 * Controllers are thin — they parse the request, call the service layer
 * (in this case directly Prisma for simplicity), and shape the HTTP response.
 *
 * @module activity-logs/controller
 */

import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Safely extracts a string value from Express v5's multi-type params/query.
 * Express v5 types for query values include `ParsedQs` (nested objects)
 * which we safely coerce using `String()` when needed.
 */
const asStr = (val: unknown): string | undefined => {
  if (typeof val === "string") return val;
  if (Array.isArray(val) && val.length > 0) return String(val[0]);
  if (val) return String(val);
  return undefined;
};

// ─── Controller Functions ─────────────────────────────────────────────────────

/**
 * GET /api/activity-logs
 *
 * Returns a paginated, filterable list of activity logs, newest first.
 *
 * Query parameters:
 *   page     - Page number (default: 1)
 *   limit    - Results per page (default: 50, max: 100)
 *   userId   - Filter by user ID
 *   activity - Filter by activity type (partial match, case-insensitive)
 *   from     - Start date (ISO 8601) for date-range filter
 *   to       - End date (ISO 8601) for date-range filter
 */
export const listActivityLogs = async (req: Request, res: Response) => {
  try {
    // ── Parse query parameters ──────────────────────────────────────────
    const page = Math.max(1, parseInt(asStr(req.query.page) ?? "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(asStr(req.query.limit) ?? "50", 10)),
    );
    const skip = (page - 1) * limit;

    const userId = asStr(req.query.userId);
    const activity = asStr(req.query.activity);
    const fromDate = asStr(req.query.from);
    const toDate = asStr(req.query.to);

    // ── Build where clause ──────────────────────────────────────────────
    const where: Record<string, unknown> = {};

    if (userId) {
      where.userId = userId;
    }

    if (activity) {
      where.activity = {
        contains: activity,
        mode: "insensitive",
      };
    }

    if (fromDate || toDate) {
      const createdAt: Record<string, Date> = {};
      if (fromDate) {
        createdAt.gte = new Date(fromDate);
      }
      if (toDate) {
        createdAt.lte = new Date(toDate);
      }
      where.createdAt = createdAt;
    }

    // ── Execute query ───────────────────────────────────────────────────
    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              image: true,
            },
          },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    // ── Response ────────────────────────────────────────────────────────
    return res.json({
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: skip + limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("[ActivityLogs] List error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve activity logs.",
      },
    });
  }
};

/**
 * GET /api/activity-logs/:id
 *
 * Returns a single activity log by its ID, including the associated user info.
 */
export const getActivityLog = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: {
          code: "INVALID_ID",
          message: "Activity log ID is required.",
        },
      });
    }

    const log = await prisma.activityLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            image: true,
          },
        },
      },
    });

    if (!log) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Activity log not found.",
        },
      });
    }

    return res.json({ data: log });
  } catch (error) {
    console.error("[ActivityLogs] Get error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve activity log.",
      },
    });
  }
};

/**
 * DELETE /api/activity-logs/:id
 *
 * Permanently deletes an activity log entry. Use sparingly — audit logs
 * should generally be immutable. Reserved for SUPER_ADMIN cleanup or
 * data-privacy erasure requests.
 */
export const deleteActivityLog = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: {
          code: "INVALID_ID",
          message: "Activity log ID is required.",
        },
      });
    }

    // Verify the log exists before attempting deletion
    const existing = await prisma.activityLog.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Activity log not found.",
        },
      });
    }

    await prisma.activityLog.delete({ where: { id } });

    return res.json({
      message: "Activity log deleted successfully.",
    });
  } catch (error) {
    console.error("[ActivityLogs] Delete error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to delete activity log.",
      },
    });
  }
};
