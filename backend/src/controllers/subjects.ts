/**
 * Subjects Controller
 *
 * Request handlers for Subject CRUD operations.
 * Subjects (e.g. "Mathematics", "English Language") belong to a specific
 * grade within an academic year. Each subject has a unique code (e.g. "MATH-101").
 *
 * @module subjects/controller
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
 * GET /api/subjects
 *
 * Returns all subjects, ordered by name ascending.
 * Optionally filtered via query params:
 *   ?gradeId=<id>         — filter by grade
 *   ?academicYearId=<id>  — filter by academic year
 *
 * Access:
 *   SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL — full read access
 *   TEACHER, STAFF, STUDENT, PARENT — can also read
 */
export const listSubjects = async (req: Request, res: Response) => {
  try {
    const gradeId = asStr(req.query.gradeId);
    const academicYearId = asStr(req.query.academicYearId);

    const where: Record<string, unknown> = {};
    if (gradeId) where.gradeId = gradeId;
    if (academicYearId) where.academicYearId = academicYearId;

    const subjects = await prisma.subject.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        grade: {
          select: { id: true, name: true, section: true },
        },
        academicYear: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            teachers: true,
          },
        },
      },
    });

    return res.json({ data: subjects });
  } catch (error) {
    console.error("[Subjects] List error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve subjects.",
      },
    });
  }
};

/**
 * GET /api/subjects/:id
 *
 * Returns a single subject with its grade, academic year, and teacher count.
 */
export const getSubject = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Subject ID is required." },
      });
    }

    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        grade: {
          select: { id: true, name: true, section: true },
        },
        academicYear: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            teachers: true,
          },
        },
      },
    });

    if (!subject) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Subject not found.",
        },
      });
    }

    return res.json({ data: subject });
  } catch (error) {
    console.error("[Subjects] Get error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve subject.",
      },
    });
  }
};

/**
 * POST /api/subjects
 *
 * Creates a new subject within a grade and academic year.
 *
 * Body:
 *   name            (string, required)  — e.g. "Mathematics"
 *   code            (string, required)  — unique code, e.g. "MATH-101"
 *   gradeId         (string, required)  — ID of the parent grade
 *   academicYearId  (string, required)  — ID of the parent academic year
 *   description     (string, optional)  — brief description
 */
export const createSubject = async (req: Request, res: Response) => {
  try {
    const { name, code, gradeId, academicYearId, description } = req.body;

    // ── Validate required fields ──────────────────────────────────────
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Name is required and must be a non-empty string.",
        },
      });
    }

    if (!code || typeof code !== "string" || !code.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Code is required and must be a non-empty string.",
        },
      });
    }

    if (!gradeId || typeof gradeId !== "string") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "gradeId is required and must be a string.",
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

    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();

    // ── Verify the parent grade exists ────────────────────────────────
    const grade = await prisma.grade.findUnique({
      where: { id: gradeId },
      select: { id: true, name: true, section: true, academicYearId: true },
    });

    if (!grade) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Grade not found.",
        },
      });
    }

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

    // ── Ensure the grade belongs to the given academic year ────────────
    if (grade.academicYearId !== academicYearId) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: `Grade "${grade.name} - ${grade.section}" does not belong to academic year "${academicYear.name}".`,
        },
      });
    }

    // ── Create the subject ────────────────────────────────────────────
    const subject = await prisma.subject.create({
      data: {
        name: trimmedName,
        code: trimmedCode,
        description: description ?? null,
        gradeId,
        academicYearId,
      },
    });

    // ── Audit log ─────────────────────────────────────────────────────
    const userId = getUserId(req);
    if (userId) {
      logActivityAsync({
        userId,
        activity: "subject:created",
        details: `Created subject "${trimmedName}" (${trimmedCode}) for grade "${grade.name} - ${grade.section}" (${academicYear.name})`,
      });
    }

    return res.status(201).json({ data: subject });
  } catch (error: any) {
    // Handle Prisma unique constraint violations (code)
    if (error?.code === "P2002") {
      const target = error?.meta?.target as string[] | undefined;
      const field = target?.join(", ") ?? "unknown";
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: `A subject with this ${field} already exists.`,
        },
      });
    }

    console.error("[Subjects] Create error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to create subject.",
      },
    });
  }
};

/**
 * PATCH /api/subjects/:id
 *
 * Updates an existing subject.
 *
 * Body (all optional):
 *   name         (string) — new name
 *   code         (string) — new code (unique globally)
 *   description  (string) — new description
 */
export const updateSubject = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Subject ID is required." },
      });
    }

    // ── Verify subject exists ─────────────────────────────────────────
    const existing = await prisma.subject.findUnique({
      where: { id },
      include: {
        grade: { select: { name: true, section: true } },
        academicYear: { select: { name: true } },
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Subject not found.",
        },
      });
    }

    const { name, code, description } = req.body;

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

    if (code !== undefined) {
      if (typeof code !== "string" || !code.trim()) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Code must be a non-empty string.",
          },
        });
      }
      data.code = code.trim().toUpperCase();
    }

    if (description !== undefined) {
      data.description = description;
    }

    // ── Update ────────────────────────────────────────────────────────
    const updated = await prisma.subject.update({
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
        activity: "subject:updated",
        details: `Updated subject "${existing.name}" (${existing.academicYear.name}, ${existing.grade.name} - ${existing.grade.section}) — ${changes}`,
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
          message: `A subject with this ${field} already exists.`,
        },
      });
    }

    console.error("[Subjects] Update error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to update subject.",
      },
    });
  }
};

/**
 * DELETE /api/subjects/:id
 *
 * Permanently deletes a subject. Only allowed if no teacher assignments
 * exist for this subject. SUPER_ADMIN or PRINCIPAL only.
 */
export const deleteSubject = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Subject ID is required." },
      });
    }

    // ── Verify existence & check teacher assignments ──────────────────
    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        grade: { select: { name: true, section: true } },
        academicYear: { select: { name: true } },
        _count: {
          select: {
            teachers: true,
          },
        },
      },
    });

    if (!subject) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Subject not found.",
        },
      });
    }

    // Prevent deletion if teachers are assigned to this subject
    if (subject._count.teachers > 0) {
      return res.status(409).json({
        error: {
          code: "HAS_ASSOCIATIONS",
          message: `Cannot delete subject "${subject.name}" (${subject.code}): it has ${subject._count.teachers} teacher assignment(s). Remove these assignments first.`,
        },
      });
    }

    await prisma.subject.delete({ where: { id } });

    // ── Audit log ─────────────────────────────────────────────────────
    const userId = getUserId(req);
    if (userId) {
      logActivityAsync({
        userId,
        activity: "subject:deleted",
        details: `Deleted subject "${subject.name}" (${subject.code}) from grade "${subject.grade.name} - ${subject.grade.section}" (${subject.academicYear.name})`,
      });
    }

    return res.json({
      message: `Subject "${subject.name}" (${subject.code}) deleted successfully.`,
    });
  } catch (error) {
    console.error("[Subjects] Delete error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to delete subject.",
      },
    });
  }
};
