/**
 * Grades Controller
 *
 * Request handlers for Grade CRUD operations.
 * Grades (e.g. "Grade 10", "Grade 11") are classes/cohorts within an
 * academic year. Each grade has a section (e.g. "Alpha", "Beta") and
 * houses students, subjects, and fee structures.
 *
 * @module grades/controller
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
 * GET /api/grades
 *
 * Returns all grades, ordered by name ascending.
 * Optionally filtered to a specific academic year via `?academicYearId=<id>`.
 *
 * Access:
 *   SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL — full read access
 *   TEACHER, STAFF, STUDENT, PARENT — can also read
 */
export const listGrades = async (req: Request, res: Response) => {
  try {
    const academicYearId = asStr(req.query.academicYearId);

    const where: Record<string, unknown> = {};
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    const grades = await prisma.grade.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        academicYear: {
          select: { id: true, name: true },
        },
        // Fee structures set for this grade, ordered by their term
        fees: {
          select: {
            id: true,
            termId: true,
            amount: true,
            term: { select: { id: true, name: true } },
          },
          orderBy: { term: { startDate: "asc" } },
        },
        _count: {
          select: {
            students: true,
            subjects: true,
          },
        },
      },
    });

    return res.json({ data: grades });
  } catch (error) {
    console.error("[Grades] List error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve grades.",
      },
    });
  }
};

/**
 * GET /api/grades/:id
 *
 * Returns a single grade with its academic year, subject count, and student count.
 */
export const getGrade = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Grade ID is required." },
      });
    }

    const grade = await prisma.grade.findUnique({
      where: { id },
      include: {
        academicYear: {
          select: { id: true, name: true },
        },
        // Fee structures set for this grade, ordered by their term
        fees: {
          select: {
            id: true,
            termId: true,
            amount: true,
            term: { select: { id: true, name: true } },
          },
          orderBy: { term: { startDate: "asc" } },
        },
        _count: {
          select: {
            students: true,
            subjects: true,
            assignments: true,
            fees: true,
          },
        },
      },
    });

    if (!grade) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Grade not found.",
        },
      });
    }

    return res.json({ data: grade });
  } catch (error) {
    console.error("[Grades] Get error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve grade.",
      },
    });
  }
};

/**
 * POST /api/grades
 *
 * Creates a new grade within an academic year.
 *
 * Body:
 *   name            (string, required)  — e.g. "Grade 10" (unique globally)
 *   section         (string, required)  — e.g. "Alpha" (unique globally)
 *   academicYearId  (string, required)  — ID of the parent academic year
 *   roomNumber      (string, optional)  — e.g. "B-201"
 *   capacity        (number, optional)  — max students, defaults to 30
 */
export const createGrade = async (req: Request, res: Response) => {
  try {
    const { name, section, academicYearId, roomNumber, capacity } = req.body;

    // ── Validate required fields ──────────────────────────────────────
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Name is required and must be a non-empty string.",
        },
      });
    }

    if (!section || typeof section !== "string" || !section.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Section is required and must be a non-empty string.",
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

    if (capacity !== undefined && (typeof capacity !== "number" || capacity < 1)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Capacity must be a positive integer if provided.",
        },
      });
    }

    const trimmedName = name.trim();
    const trimmedSection = section.trim();

    // ── Verify the parent academic year exists ────────────────────────
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: { id: true, name: true },
    });

    if (!academicYear) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Academic year not found.",
        },
      });
    }

    // ── Create the grade ──────────────────────────────────────────────
    const grade = await prisma.grade.create({
      data: {
        name: trimmedName,
        section: trimmedSection,
        academicYearId,
        roomNumber: roomNumber ?? null,
        capacity: capacity ?? 30,
      },
    });

    // ── Audit log ─────────────────────────────────────────────────────
    const userId = getUserId(req);
    if (userId) {
      logActivityAsync({
        userId,
        activity: "grade:created",
        details: `Created grade "${trimmedName} - ${trimmedSection}" for academic year "${academicYear.name}"`,
      });
    }

    return res.status(201).json({ data: grade });
  } catch (error: any) {
    // Handle Prisma unique constraint violations (name or section)
    if (error?.code === "P2002") {
      const target = error?.meta?.target as string[] | undefined;
      const field = target?.join(", ") ?? "unknown";
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: `A grade with this ${field} already exists.`,
        },
      });
    }

    console.error("[Grades] Create error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to create grade.",
      },
    });
  }
};

/**
 * PATCH /api/grades/:id
 *
 * Updates an existing grade.
 *
 * Body (all optional):
 *   name        (string) — new name (unique globally)
 *   section     (string) — new section (unique globally)
 *   roomNumber  (string) — new room number
 *   capacity    (number) — new max capacity
 */
export const updateGrade = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Grade ID is required." },
      });
    }

    // ── Verify grade exists ───────────────────────────────────────────
    const existing = await prisma.grade.findUnique({
      where: { id },
      include: {
        academicYear: { select: { id: true, name: true } },
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Grade not found.",
        },
      });
    }

    const { name, section, roomNumber, capacity } = req.body;

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

    if (section !== undefined) {
      if (typeof section !== "string" || !section.trim()) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Section must be a non-empty string.",
          },
        });
      }
      data.section = section.trim();
    }

    if (roomNumber !== undefined) {
      data.roomNumber = roomNumber;
    }

    if (capacity !== undefined) {
      if (typeof capacity !== "number" || capacity < 1) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Capacity must be a positive integer.",
          },
        });
      }
      data.capacity = capacity;
    }

    // ── Update ────────────────────────────────────────────────────────
    const updated = await prisma.grade.update({
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
        activity: "grade:updated",
        details: `Updated grade "${existing.name} - ${existing.section}" (${existing.academicYear.name}) — ${changes}`,
      });
    }

    return res.json({ data: updated });
  } catch (error: any) {
    if (error?.code === "P2002") {
      const target = error?.meta?.target as string[] | undefined;
      const field = target?.join(", ") ?? "unknown";
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: `A grade with this ${field} already exists.`,
        },
      });
    }

    console.error("[Grades] Update error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to update grade.",
      },
    });
  }
};

/**
 * DELETE /api/grades/:id
 *
 * Permanently deletes a grade. Only allowed if no students, subjects,
 * fee structures, teacher assignments, or attendance records are associated.
 * SUPER_ADMIN or PRINCIPAL only.
 */
export const deleteGrade = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Grade ID is required." },
      });
    }

    // ── Verify existence & check associated records ──────────────────
    const grade = await prisma.grade.findUnique({
      where: { id },
      include: {
        academicYear: { select: { name: true } },
        _count: {
          select: {
            students: true,
            subjects: true,
            fees: true,
            assignments: true,
          },
        },
      },
    });

    if (!grade) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Grade not found.",
        },
      });
    }

    // Prevent deletion if there are associated records
    const { students, subjects, fees, assignments } = grade._count;
    if (students > 0 || subjects > 0 || fees > 0 || assignments > 0) {
      const associations: string[] = [];
      if (students > 0) associations.push(`${students} student(s)`);
      if (subjects > 0) associations.push(`${subjects} subject(s)`);
      if (fees > 0) associations.push(`${fees} fee structure(s)`);
      if (assignments > 0) associations.push(`${assignments} teacher assignment(s)`);

      return res.status(409).json({
        error: {
          code: "HAS_ASSOCIATIONS",
          message: `Cannot delete grade "${grade.name} - ${grade.section}": it has ${associations.join(", ")}. Remove these associations first.`,
        },
      });
    }

    await prisma.grade.delete({ where: { id } });

    // ── Audit log ─────────────────────────────────────────────────────
    const userId = getUserId(req);
    if (userId) {
      logActivityAsync({
        userId,
        activity: "grade:deleted",
        details: `Deleted grade "${grade.name} - ${grade.section}" from academic year "${grade.academicYear.name}"`,
      });
    }

    return res.json({
      message: `Grade "${grade.name} - ${grade.section}" deleted successfully.`,
    });
  } catch (error) {
    console.error("[Grades] Delete error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to delete grade.",
      },
    });
  }
};
