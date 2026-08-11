/**
 * Timetable Controller
 *
 * Request handlers for timetable operations:
 *   - List timetable slots for a grade
 *   - Trigger AI generation via Inngest
 *   - Update/delete individual slots (admin edit)
 *
 * @module timetable/controller
 */

import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { logActivityAsync } from "../lib/activity-log.js";
import { inngest } from "../inngest/client.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const asStr = (val: unknown): string | undefined => {
  if (typeof val === "string") return val;
  if (Array.isArray(val) && val.length > 0) return String(val[0]);
  if (val) return String(val);
  return undefined;
};

const getUserId = (req: Request): string | null => req.user?.id ?? null;

/**
 * Shared include for timetable slots — subject + teacher + grade info via the
 * teachergradeSubject relation. Used by the grade list and the "my timetable"
 * endpoint so both return the same shape.
 */
const slotInclude = {
  teachergradeSubject: {
    include: {
      subject: {
        select: { id: true, name: true, code: true },
      },
      teacher: {
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
      },
      grade: {
        select: { id: true, name: true, section: true, roomNumber: true },
      },
    },
  },
} as const;


// ─── Controller Functions ─────────────────────────────────────────────────────

/**
 * GET /api/timetable?gradeId=<id>
 *
 * Returns all timetable slots for a given grade, ordered by dayOfWeek then startTime.
 * Includes related subject and teacher info via the teachergradeSubject relation.
 *
 * Access:
 *   All authenticated users with role-based read access.
 */
export const listTimetableSlots = async (req: Request, res: Response) => {
  try {
    const gradeId = asStr(req.query.gradeId);

    if (!gradeId) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "gradeId query parameter is required.",
        },
      });
    }

    const slots = await prisma.timetableSlot.findMany({
      where: { gradeId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      include: slotInclude,
    });

    return res.json({ data: slots });
  } catch (error) {
    console.error("[Timetable] List error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve timetable slots.",
      },
    });
  }
};

/**
 * GET /api/timetable/my
 *
 * Returns the personalized timetable for the current user:
 *   - STUDENT → their grade's full weekly timetable + grade info
 *   - TEACHER → their own lessons across all classes + their class list
 *   - PARENT  → their linked children (browse per child from Payments/Invoices)
 *   - others  → empty payload
 *
 * Access: all authenticated users (scoped by role inside the controller).
 */
export const getMyTimetable = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const role = (user.role ?? "") as string;

    // ── STUDENT → their grade's timetable ──────────────────────────────
    if (role === "STUDENT") {
      const profile = await prisma.studentProfile.findUnique({
        where: { userId: user.id },
        select: {
          gradeId: true,
          grade: {
            select: { id: true, name: true, section: true, roomNumber: true },
          },
        },
      });

      if (!profile) {
        return res.json({ data: { scope: "STUDENT", grade: null, slots: [] } });
      }

      const slots = await prisma.timetableSlot.findMany({
        where: { gradeId: profile.gradeId },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        include: slotInclude,
      });

      return res.json({ data: { scope: "STUDENT", grade: profile.grade, slots } });
    }

    // ── TEACHER → their lessons + classes ──────────────────────────────
    if (role === "TEACHER") {
      const staff = await prisma.staffProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });

      if (!staff) {
        return res.json({ data: { scope: "TEACHER", classes: [], slots: [] } });
      }

      // NOTE: TimetableSlot.teacherId stores the teacher's USER id
      // (see inngest/functions/timetable.ts — teacherId: slot.teacherUserId).
      const [slots, classes] = await Promise.all([
        prisma.timetableSlot.findMany({
          where: { teacherId: user.id },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
          include: slotInclude,
        }),
        prisma.teachergradeSubject.findMany({
          where: { teacherId: staff.id, academicYear: { isCurrent: true } },
          select: {
            id: true,
            subject: { select: { id: true, name: true, code: true } },
            grade: { select: { id: true, name: true, section: true } },
          },
          orderBy: { grade: { name: "asc" } },
        }),
      ]);

      return res.json({ data: { scope: "TEACHER", classes, slots } });
    }

    // ── PARENT → linked children ───────────────────────────────────────
    if (role === "PARENT") {
      const parent = await prisma.parentProfile.findUnique({
        where: { userId: user.id },
        select: {
          students: {
            select: {
              student: {
                select: {
                  id: true,
                  admissionNumber: true,
                  user: { select: { name: true } },
                  grade: { select: { name: true, section: true } },
                },
              },
            },
          },
        },
      });

      const children = (parent?.students ?? []).map((s) => ({
        studentId: s.student.id,
        name: s.student.user.name,
        admissionNumber: s.student.admissionNumber,
        grade: s.student.grade,
      }));

      return res.json({ data: { scope: "PARENT", children, slots: [] } });
    }

    // ── Everyone else → empty ──────────────────────────────────────────
    return res.json({ data: { scope: "OTHER", slots: [] } });
  } catch (error) {
    console.error("[Timetable] My timetable error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve your timetable.",
      },
    });
  }
};

/**
 * POST /api/timetable/generate
 *
 * Triggers the Inngest function to generate a timetable for a grade using Gemini AI.
 * The function runs asynchronously — this endpoint returns immediately with a
 * reference ID so the client can poll for completion.
 *
 * Body:
 *   gradeId         (string, required)
 *   academicYearId  (string, required)
 *
 * Access:
 *   SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL
 */
export const generateTimetableSlots = async (req: Request, res: Response) => {
  try {
    const { gradeId, academicYearId } = req.body;

    if (!gradeId || !academicYearId) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Both gradeId and academicYearId are required.",
        },
      });
    }

    // Verify grade exists
    const grade = await prisma.grade.findUnique({
      where: { id: gradeId },
      select: { id: true, name: true, section: true },
    });

    if (!grade) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Grade not found." },
      });
    }

    // Send event to Inngest for async processing
    const { ids } = await inngest.send({
      name: "timetable/generate",
      data: { gradeId, academicYearId },
    });

    // Audit log
    const userId = getUserId(req);
    if (userId) {
      logActivityAsync({
        userId,
        activity: "timetable:generate",
        details: `Triggered timetable generation for "${grade.name} - ${grade.section}" (Inngest run: ${ids[0]})`,
      });
    }

    return res.status(202).json({
      data: {
        message: `Timetable generation started for "${grade.name} - ${grade.section}".`,
        runId: ids[0],
        grade: { id: grade.id, name: grade.name, section: grade.section },
      },
    });
  } catch (error) {
    console.error("[Timetable] Generate error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to start timetable generation.",
      },
    });
  }
};

/**
 * PATCH /api/timetable/:id
 *
 * Updates a single timetable slot (lesson). Used by admins to manually
 * edit/override individual slots after AI generation.
 *
 * Body (all optional):
 *   startTime    (number) — minutes since midnight
 *   endTime      (number) — minutes since midnight
 *   dayOfWeek    (number) — 1=Monday … 5=Friday
 *   room         (string) — room number
 *
 * Access:
 *   SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL
 */
export const updateTimetableSlot = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Slot ID is required." },
      });
    }

    // Verify slot exists
    const existing = await prisma.timetableSlot.findUnique({
      where: { id },
      include: {
        teachergradeSubject: {
          include: {
            subject: { select: { name: true } },
            teacher: { include: { user: { select: { name: true } } } },
          },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Timetable slot not found." },
      });
    }

    const { startTime, endTime, dayOfWeek, room } = req.body;

    const data: Record<string, unknown> = {};

    if (startTime !== undefined) {
      if (typeof startTime !== "number" || startTime < 0 || startTime > 1440) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "startTime must be a number between 0 and 1440.",
          },
        });
      }
      data.startTime = startTime;
    }

    if (endTime !== undefined) {
      if (typeof endTime !== "number" || endTime < 0 || endTime > 1440) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "endTime must be a number between 0 and 1440.",
          },
        });
      }
      data.endTime = endTime;
    }

    if (dayOfWeek !== undefined) {
      if (typeof dayOfWeek !== "number" || dayOfWeek < 1 || dayOfWeek > 7) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "dayOfWeek must be a number between 1 and 7.",
          },
        });
      }
      data.dayOfWeek = dayOfWeek;
    }

    if (room !== undefined) {
      data.room = room;
    }

    const updated = await prisma.timetableSlot.update({
      where: { id },
      data,
    });

    // Audit log
    const userId = getUserId(req);
    if (userId) {
      const changes = Object.keys(data)
        .map((k) => `${k}: ${JSON.stringify(data[k])}`)
        .join(", ");
      logActivityAsync({
        userId,
        activity: "timetable:slot-updated",
        details: `Updated slot ${existing.teachergradeSubject.subject.name} (${existing.teachergradeSubject.teacher.user.name}) — ${changes}`,
      });
    }

    return res.json({ data: updated });
  } catch (error) {
    console.error("[Timetable] Update slot error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to update timetable slot.",
      },
    });
  }
};

/**
 * DELETE /api/timetable/:id
 *
 * Deletes a single timetable slot.
 *
 * Access:
 *   SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL
 */
export const deleteTimetableSlot = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Slot ID is required." },
      });
    }

    // Verify slot exists before deleting
    const existing = await prisma.timetableSlot.findUnique({
      where: { id },
      include: {
        teachergradeSubject: {
          include: {
            subject: { select: { name: true } },
            teacher: { include: { user: { select: { name: true } } } },
          },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Timetable slot not found." },
      });
    }

    await prisma.timetableSlot.delete({ where: { id } });

    // Audit log
    const userId = getUserId(req);
    if (userId) {
      logActivityAsync({
        userId,
        activity: "timetable:slot-deleted",
        details: `Deleted slot: ${existing.teachergradeSubject.subject.name} (${existing.teachergradeSubject.teacher.user.name}) on day ${existing.dayOfWeek} at ${existing.startTime}`,
      });
    }

    return res.json({
      message: "Timetable slot deleted successfully.",
    });
  } catch (error) {
    console.error("[Timetable] Delete slot error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to delete timetable slot.",
      },
    });
  }
};
