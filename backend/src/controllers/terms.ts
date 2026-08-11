/**
 * Terms Controller
 *
 * Request handlers for Term CRUD operations.
 * Terms belong to an Academic Year and represent distinct academic periods
 * (e.g. "Term 1", "Term 2", "Term 3") within that year.
 *
 * @module terms/controller
 */

import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { logActivityAsync } from "../lib/activity-log.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Safely extracts a string value from Express v5's multi-type params/query.
 */
const asStr = (val: unknown): string | undefined => {
  if (typeof val === "string") return val;
  if (Array.isArray(val) && val.length > 0) return String(val[0]);
  if (val) return String(val);
  return undefined;
};

/**
 * Returns the authenticated user's ID from the request.
 * `req.user` is attached by the `requireAuth` middleware.
 */
const getUserId = (req: Request): string | null => req.user?.id ?? null;

// ─── Controller Functions ─────────────────────────────────────────────────────

/**
 * GET /api/terms
 *
 * Returns all terms, ordered by startDate ascending.
 * Optionally filtered to a specific academic year via `?academicYearId=<id>`.
 * Optionally filtered to only current terms via `?current=true`.
 *
 * Access:
 *   SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL — full read access
 *   TEACHER, STAFF, STUDENT, PARENT — can also read
 */
export const listTerms = async (req: Request, res: Response) => {
  try {
    const academicYearId = asStr(req.query.academicYearId);
    const currentOnly = req.query.current === "true";

    const where: Record<string, unknown> = {};
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }
    if (currentOnly) {
      where.isCurrent = true;
    }

    const terms = await prisma.term.findMany({
      where,
      orderBy: { startDate: "asc" },
      include: {
        academicYear: {
          select: { id: true, name: true },
        },
      },
    });

    return res.json({ data: terms });
  } catch (error) {
    console.error("[Terms] List error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve terms.",
      },
    });
  }
};

/**
 * GET /api/terms/:id
 *
 * Returns a single term with its parent academic year.
 */
export const getTerm = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Term ID is required." },
      });
    }

    const term = await prisma.term.findUnique({
      where: { id },
      include: {
        academicYear: {
          select: { id: true, name: true, startDate: true, endDate: true },
        },
      },
    });

    if (!term) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Term not found.",
        },
      });
    }

    return res.json({ data: term });
  } catch (error) {
    console.error("[Terms] Get error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve term.",
      },
    });
  }
};

/**
 * POST /api/terms
 *
 * Creates a new term within an academic year.
 *
 * Body:
 *   name            (string, required)  — e.g. "Term 1"
 *   academicYearId  (string, required)  — ID of the parent academic year
 *   startDate       (string, required)  — ISO 8601 date
 *   endDate         (string, required)  — ISO 8601 date
 *   isCurrent       (boolean, optional) — if true, all other terms in the same year are unset
 */
export const createTerm = async (req: Request, res: Response) => {
  try {
    const { name, academicYearId, startDate, endDate, isCurrent } = req.body;

    // ── Validate required fields ──────────────────────────────────────
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Name is required and must be a non-empty string.",
        },
      });
    }

    if (!academicYearId || typeof academicYearId !== "string") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "academicYearId is required and must be a string.",
        },
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Both startDate and endDate are required.",
        },
      });
    }

    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);

    if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "startDate and endDate must be valid ISO 8601 dates.",
        },
      });
    }

    if (parsedStart >= parsedEnd) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "startDate must be before endDate.",
        },
      });
    }

    const trimmedName = name.trim();

    // ── Verify the parent academic year exists ────────────────────────
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: { id: true, name: true, startDate: true, endDate: true },
    });

    if (!academicYear) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Academic year not found.",
        },
      });
    }

    // ── Validate term dates fall within the academic year's range ─────
    if (parsedStart < academicYear.startDate || parsedEnd > academicYear.endDate) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: `Term dates must fall within the academic year "${academicYear.name}" (${academicYear.startDate.toISOString().split("T")[0]} — ${academicYear.endDate.toISOString().split("T")[0]}).`,
        },
      });
    }

    // ── Check for overlapping terms within the same academic year ─────
    const overlapping = await prisma.term.findFirst({
      where: {
        academicYearId,
        OR: [
          { startDate: { lt: parsedEnd }, endDate: { gt: parsedStart } },
        ],
      },
      select: { id: true, name: true },
    });

    if (overlapping) {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: `The term dates overlap with an existing term "${overlapping.name}" in this academic year.`,
        },
      });
    }

    // ── If setting as current, unset all other terms in this year ─────
    if (isCurrent) {
      await prisma.term.updateMany({
        where: { academicYearId, isCurrent: true },
        data: { isCurrent: false },
      });
    }

    // ── Create the term ───────────────────────────────────────────────
    const term = await prisma.term.create({
      data: {
        name: trimmedName,
        academicYearId,
        startDate: parsedStart,
        endDate: parsedEnd,
        isCurrent: isCurrent ?? false,
      },
    });

    // ── Audit log ─────────────────────────────────────────────────────
    const userId = getUserId(req);
    if (userId) {
      logActivityAsync({
        userId,
        activity: "term:created",
        details: `Created term "${trimmedName}" for academic year "${academicYear.name}" (${parsedStart.toISOString().split("T")[0]} — ${parsedEnd.toISOString().split("T")[0]})`,
      });
    }

    return res.status(201).json({ data: term });
  } catch (error) {
    console.error("[Terms] Create error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to create term.",
      },
    });
  }
};

/**
 * PATCH /api/terms/:id
 *
 * Updates an existing term.
 *
 * Body (all optional):
 *   name       (string)  — new name
 *   startDate  (string)  — new ISO 8601 start date
 *   endDate    (string)  — new ISO 8601 end date
 *   isCurrent  (boolean) — if true, all other terms in the same year are unset
 */
export const updateTerm = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Term ID is required." },
      });
    }

    // ── Verify term exists & fetch current data ───────────────────────
    const existing = await prisma.term.findUnique({
      where: { id },
      include: {
        academicYear: {
          select: { id: true, name: true, startDate: true, endDate: true },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Term not found.",
        },
      });
    }

    const { name, startDate, endDate, isCurrent } = req.body;

    // ── Build update payload ──────────────────────────────────────────
    const data: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Name must be a non-empty string.",
          },
        });
      }
      data.name = name.trim();
    }

    if (startDate !== undefined) {
      const parsed = new Date(startDate);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "startDate must be a valid ISO 8601 date.",
          },
        });
      }
      data.startDate = parsed;
    }

    if (endDate !== undefined) {
      const parsed = new Date(endDate);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "endDate must be a valid ISO 8601 date.",
          },
        });
      }
      data.endDate = parsed;
    }

    // ── Validate startDate < endDate ──────────────────────────────────
    const effectiveStart: Date = (data.startDate as Date) ?? existing.startDate;
    const effectiveEnd: Date = (data.endDate as Date) ?? existing.endDate;
    if (effectiveStart >= effectiveEnd) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "startDate must be before endDate.",
        },
      });
    }

    // ── Validate dates are within the academic year's range ───────────
    if (
      effectiveStart < existing.academicYear.startDate ||
      effectiveEnd > existing.academicYear.endDate
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: `Term dates must fall within the academic year "${existing.academicYear.name}" (${existing.academicYear.startDate.toISOString().split("T")[0]} — ${existing.academicYear.endDate.toISOString().split("T")[0]}).`,
        },
      });
    }

    // ── Check for overlapping terms (exclude the current term) ────────
    const overlapping = await prisma.term.findFirst({
      where: {
        id: { not: id },
        academicYearId: existing.academicYearId,
        OR: [
          { startDate: { lt: effectiveEnd }, endDate: { gt: effectiveStart } },
        ],
      },
      select: { id: true, name: true },
    });

    if (overlapping) {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: `The updated dates overlap with an existing term "${overlapping.name}" in this academic year.`,
        },
      });
    }

    // ── If setting as current, unset all other terms in this year ─────
    if (isCurrent === true) {
      await prisma.term.updateMany({
        where: { academicYearId: existing.academicYearId, isCurrent: true, id: { not: id } },
        data: { isCurrent: false },
      });
    }
    if (isCurrent !== undefined) {
      data.isCurrent = isCurrent;
    }

    // ── Update ────────────────────────────────────────────────────────
    const updated = await prisma.term.update({
      where: { id },
      data,
    });

    // ── Audit log ─────────────────────────────────────────────────────
    const userId = getUserId(req);
    if (userId) {
      const changes = Object.keys(data)
        .map((k) => `${k}: ${JSON.stringify(data[k])}`)
        .join(", ");
      logActivityAsync({
        userId,
        activity: "term:updated",
        details: `Updated term "${existing.name}" (${existing.academicYear.name}) — ${changes}`,
      });
    }

    return res.json({ data: updated });
  } catch (error) {
    console.error("[Terms] Update error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to update term.",
      },
    });
  }
};

/**
 * DELETE /api/terms/:id
 *
 * Permanently deletes a term. SUPER_ADMIN, PRINCIPAL, or VICE_PRINCIPAL only.
 */
export const deleteTerm = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Term ID is required." },
      });
    }

    // ── Verify existence ──────────────────────────────────────────────
    const term = await prisma.term.findUnique({
      where: { id },
      include: {
        academicYear: { select: { name: true } },
      },
    });

    if (!term) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Term not found.",
        },
      });
    }

    await prisma.term.delete({ where: { id } });

    // ── Audit log ─────────────────────────────────────────────────────
    const userId = getUserId(req);
    if (userId) {
      logActivityAsync({
        userId,
        activity: "term:deleted",
        details: `Deleted term "${term.name}" from academic year "${term.academicYear.name}"`,
      });
    }

    return res.json({
      message: `Term "${term.name}" deleted successfully.`,
    });
  } catch (error) {
    console.error("[Terms] Delete error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to delete term.",
      },
    });
  }
};
