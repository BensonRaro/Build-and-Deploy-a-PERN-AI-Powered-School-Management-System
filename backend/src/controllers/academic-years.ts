/**
 * Academic Years Controller
 *
 * Request handlers for Academic Year CRUD operations.
 * Academic Years are the foundational academic structure — terms, grades,
 * subjects, and enrollments all reference them.
 *
 * @module academic-years/controller
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
const getUserId = (req: Request): string | null =>
  req.user?.id ?? null;

// ─── Controller Functions ─────────────────────────────────────────────────────

/**
 * GET /api/academic-years
 *
 * Returns all academic years, ordered by startDate descending (newest first).
 * Optionally filtered to only the current year via `?current=true`.
 *
 * Access:
 *   SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL — full read access
 *   TEACHER, STAFF, STUDENT, PARENT — can also read
 */
export const listAcademicYears = async (req: Request, res: Response) => {
  try {
    const currentOnly = req.query.current === "true";

    const where: Record<string, unknown> = {};
    if (currentOnly) {
      where.isCurrent = true;
    }

    const years = await prisma.academicYear.findMany({
      where,
      orderBy: { startDate: "desc" },
      include: {
        _count: {
          select: {
            terms: true,
            gradees: true,
            subjects: true,
            students: true,
          },
        },
      },
    });

    return res.json({ data: years });
  } catch (error) {
    console.error("[AcademicYears] List error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve academic years.",
      },
    });
  }
};

/**
 * GET /api/academic-years/:id
 *
 * Returns a single academic year with its associated terms.
 */
export const getAcademicYear = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Academic year ID is required." },
      });
    }

    const year = await prisma.academicYear.findUnique({
      where: { id },
      include: {
        terms: { orderBy: { startDate: "asc" } },
        _count: {
          select: {
            terms: true,
            gradees: true,
            subjects: true,
            students: true,
          },
        },
      },
    });

    if (!year) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Academic year not found.",
        },
      });
    }

    return res.json({ data: year });
  } catch (error) {
    console.error("[AcademicYears] Get error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve academic year.",
      },
    });
  }
};

/**
 * POST /api/academic-years
 *
 * Creates a new academic year.
 *
 * Body:
 *   name       (string, required) — e.g. "2026-2027"
 *   startDate  (string, required) — ISO 8601 date
 *   endDate    (string, required) — ISO 8601 date
 *   isCurrent  (boolean, optional) — if true, all other years are unset
 */
export const createAcademicYear = async (req: Request, res: Response) => {
  try {
    const { name, startDate, endDate, isCurrent } = req.body;

    // ── Validate required fields ──────────────────────────────────────
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Name is required and must be a non-empty string.",
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

    // ── Check for duplicate name ──────────────────────────────────────
    const existing = await prisma.academicYear.findUnique({
      where: { name: trimmedName },
      select: { id: true },
    });

    if (existing) {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: `An academic year with the name "${trimmedName}" already exists.`,
        },
      });
    }

    // ── Create the academic year ──────────────────────────────────────
    // If setting as current, unset all other years first
    if (isCurrent) {
      await prisma.academicYear.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
    }

    const year = await prisma.academicYear.create({
      data: {
        name: trimmedName,
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
        activity: "academic-year:created",
        details: `Created academic year "${trimmedName}" (${parsedStart.toISOString().split("T")[0]} — ${parsedEnd.toISOString().split("T")[0]})`,
      });
    }

    return res.status(201).json({ data: year });
  } catch (error: any) {
    // Handle Prisma unique constraint violations
    if (error?.code === "P2002") {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "An academic year with this name already exists.",
        },
      });
    }

    console.error("[AcademicYears] Create error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to create academic year.",
      },
    });
  }
};

/**
 * PATCH /api/academic-years/:id
 *
 * Updates an existing academic year.
 *
 * Body (all optional):
 *   name       (string) — new name
 *   startDate  (string) — new ISO 8601 start date
 *   endDate    (string) — new ISO 8601 end date
 *   isCurrent  (boolean) — if true, all other years are unset
 */
export const updateAcademicYear = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Academic year ID is required." },
      });
    }

    // ── Verify existence & fetch current dates ───────────────────────
    const existing = await prisma.academicYear.findUnique({
      where: { id },
      select: { id: true, name: true, startDate: true, endDate: true },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Academic year not found.",
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

    // Validate startDate < endDate: use incoming values, fall back to existing
    const effectiveStart = data.startDate ?? existing.startDate;
    const effectiveEnd = data.endDate ?? existing.endDate;
    if (effectiveStart && effectiveEnd && effectiveStart >= effectiveEnd) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "startDate must be before endDate.",
        },
      });
    }

    // If setting as current, unset all other years first
    if (isCurrent === true) {
      await prisma.academicYear.updateMany({
        where: { isCurrent: true, id: { not: id } },
        data: { isCurrent: false },
      });
    }
    if (isCurrent !== undefined) {
      data.isCurrent = isCurrent;
    }

    // ── Update ────────────────────────────────────────────────────────
    const updated = await prisma.academicYear.update({
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
        activity: "academic-year:updated",
        details: `Updated academic year "${existing.name}" — ${changes}`,
      });
    }

    return res.json({ data: updated });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "An academic year with this name already exists.",
        },
      });
    }

    console.error("[AcademicYears] Update error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to update academic year.",
      },
    });
  }
};

/**
 * DELETE /api/academic-years/:id
 *
 * Permanently deletes an academic year. Only allowed if no terms, grades,
 * subjects, or students are associated with it (cascading deletes would
 * destroy too much data). SUPER_ADMIN only.
 */
export const deleteAcademicYear = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Academic year ID is required." },
      });
    }

    // ── Verify existence & check associated records ──────────────────
    const year = await prisma.academicYear.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            terms: true,
            gradees: true,
            subjects: true,
            students: true,
          },
        },
      },
    });

    if (!year) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Academic year not found.",
        },
      });
    }

    // Prevent deletion if there are associated records
    const { terms, gradees, subjects, students } = year._count;
    if (terms > 0 || gradees > 0 || subjects > 0 || students > 0) {
      const associations: string[] = [];
      if (terms > 0) associations.push(`${terms} term(s)`);
      if (gradees > 0) associations.push(`${gradees} grade(s)`);
      if (subjects > 0) associations.push(`${subjects} subject(s)`);
      if (students > 0) associations.push(`${students} student(s)`);

      return res.status(409).json({
        error: {
          code: "HAS_ASSOCIATIONS",
          message: `Cannot delete academic year "${year.name}": it has ${associations.join(", ")}. Remove these associations first.`,
        },
      });
    }

    await prisma.academicYear.delete({ where: { id } });

    // ── Audit log ─────────────────────────────────────────────────────
    const userId = getUserId(req);
    if (userId) {
      logActivityAsync({
        userId,
        activity: "academic-year:deleted",
        details: `Deleted academic year "${year.name}"`,
      });
    }

    return res.json({
      message: `Academic year "${year.name}" deleted successfully.`,
    });
  } catch (error) {
    console.error("[AcademicYears] Delete error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to delete academic year.",
      },
    });
  }
};
