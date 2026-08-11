/**
 * Student Guardians Controller
 *
 * Request handlers for StudentGuardian CRUD operations.
 * StudentGuardian records link a StudentProfile to a ParentProfile,
 * establishing the guardian relationship (e.g. father, mother, guardian).
 *
 * @module student-guardians/controller
 */

import type { Request, Response } from "express";

// GuardianRelation enum values for validation — imported from Prisma's generated client
const GUARDIAN_RELATIONS = ["FATHER", "MOTHER", "GUARDIAN", "OTHER"] as const;
type GuardianRelation = (typeof GUARDIAN_RELATIONS)[number];

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
 * GET /api/student-guardians
 *
 * Returns all student-guardian links.
 * Optionally filtered via query params:
 *   ?studentId=<id>  — filter by student
 *   ?parentId=<id>   — filter by parent
 *
 * Access:
 *   SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL — full read access
 *   TEACHER, STAFF — can also read
 */
export const listStudentGuardians = async (req: Request, res: Response) => {
  try {
    const studentId = asStr(req.query.studentId);
    const parentId = asStr(req.query.parentId);

    const where: Record<string, unknown> = {};
    if (studentId) where.studentId = studentId;
    if (parentId) where.parentId = parentId;

    const links = await prisma.studentGuardian.findMany({
      where,
      include: {
        student: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            grade: { select: { id: true, name: true, section: true } },
          },
        },
        parent: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ data: links });
  } catch (error) {
    console.error("[StudentGuardians] List error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve student-guardian links.",
      },
    });
  }
};

/**
 * POST /api/student-guardians
 *
 * Creates a new student-guardian link.
 *
 * Body:
 *   studentId          (string, required)  — ID of the StudentProfile
 *   parentId           (string, required)  — ID of the ParentProfile
 *   relation           (string, required)  — FATHER | MOTHER | GUARDIAN | OTHER
 *   isPrimaryContact   (boolean, optional) — default false
 *   isEmergencyContact (boolean, optional) — default false
 */
export const createStudentGuardian = async (req: Request, res: Response) => {
  try {
    const { studentId, parentId, relation, isPrimaryContact, isEmergencyContact } = req.body;

    // ── Validate required fields ──────────────────────────────────────
    if (!studentId || typeof studentId !== "string") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "studentId is required and must be a string.",
        },
      });
    }

    if (!parentId || typeof parentId !== "string") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "parentId is required and must be a string.",
        },
      });
    }

    if (!relation || typeof relation !== "string") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "relation is required (FATHER, MOTHER, GUARDIAN, or OTHER).",
        },
      });
    }

    if (!(GUARDIAN_RELATIONS as readonly string[]).includes(relation)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: `relation must be one of: ${GUARDIAN_RELATIONS.join(", ")}.`,
        },
      });
    }

    // ── Verify both profiles exist ────────────────────────────────────
    const [studentProfile, parentProfile] = await Promise.all([
      prisma.studentProfile.findUnique({
        where: { id: studentId },
        select: {
          id: true,
          user: { select: { name: true } },
        },
      }),
      prisma.parentProfile.findUnique({
        where: { id: parentId },
        select: {
          id: true,
          user: { select: { name: true } },
        },
      }),
    ]);

    if (!studentProfile) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Student profile not found.",
        },
      });
    }

    if (!parentProfile) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Parent profile not found.",
        },
      });
    }

    // ── Create the link ───────────────────────────────────────────────
    const link = await prisma.studentGuardian.create({
      data: {
        studentId,
        parentId,
        relation: relation as GuardianRelation,
        isPrimaryContact: isPrimaryContact ?? false,
        isEmergencyContact: isEmergencyContact ?? false,
      },
      include: {
        student: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        parent: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    // ── Audit log ─────────────────────────────────────────────────────
    const userId = getUserId(req);
    if (userId) {
      logActivityAsync({
        userId,
        activity: "student-guardian:created",
        details: `Linked ${relation.toLowerCase()} "${parentProfile.user.name}" to student "${studentProfile.user.name}"`,
      });
    }

    return res.status(201).json({ data: link });
  } catch (error: any) {
    // Handle duplicate link
    if (error?.code === "P2002") {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "This student-guardian link already exists.",
        },
      });
    }

    console.error("[StudentGuardians] Create error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to create student-guardian link.",
      },
    });
  }
};

/**
 * DELETE /api/student-guardians/:id
 *
 * Removes a student-guardian link.
 */
export const deleteStudentGuardian = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Student-guardian ID is required." },
      });
    }

    const link = await prisma.studentGuardian.findUnique({
      where: { id },
      include: {
        student: { select: { user: { select: { name: true } } } },
        parent: { select: { user: { select: { name: true } } } },
      },
    });

    if (!link) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Student-guardian link not found.",
        },
      });
    }

    await prisma.studentGuardian.delete({ where: { id } });

    // ── Audit log ─────────────────────────────────────────────────────
    const userId = getUserId(req);
    if (userId) {
      logActivityAsync({
        userId,
        activity: "student-guardian:deleted",
        details: `Removed guardian link: "${link.parent.user.name}" from student "${link.student.user.name}"`,
      });
    }

    return res.json({
      message: "Student-guardian link removed successfully.",
    });
  } catch (error) {
    console.error("[StudentGuardians] Delete error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to delete student-guardian link.",
      },
    });
  }
};
