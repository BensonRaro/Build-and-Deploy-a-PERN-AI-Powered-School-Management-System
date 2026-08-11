/**
 * Assignments Controller
 *
 * Request handlers for AI-generated Assignments:
 *   - List / get assignments (role-aware: students only see published ones for their grade)
 *   - Trigger AI question-draft generation via an Inngest function, then poll
 *     the generation job (GET /api/assignments/generate/:jobId) for the result
 *   - Create / update / delete assignments
 *   - Submit answers (WITH_ANSWERS → instant AI grading; QUESTIONS_ONLY → stored for manual grading)
 *   - List submissions & manually grade them
 *
 * The AI model matches the timetable function: google("gemini-3.6-flash").
 * Question generation runs inside the Inngest function; grading runs inline.
 *
 * @module assignments/controller
 */

import type { Request, Response } from "express";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { prisma } from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { logActivityAsync } from "../lib/activity-log.js";
import { inngest } from "../inngest/client.js";
import { assignmentGenerationStore } from "../lib/assignment-generation-store.js";

// ─── Types ──────────────────────────────────────────────────────────────────

/** A single generated question. answerKey only present for WITH_ANSWERS type. */
interface AssignmentQuestion {
  id: string;
  question: string;
  points: number;
  answerKey?: string;
}

/** A student's submitted answer. */
interface StudentAnswer {
  questionId: string;
  answer: string;
}

/** Per-question grading result returned by the AI grader. */
interface GradedQuestion {
  questionId: string;
  earned: number;
  correct: boolean;
  feedback: string;
  correctAnswer?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** AI model shared with the timetable generation function. */
const AI_MODEL = google("gemini-3.6-flash");

// ─── Helpers ────────────────────────────────────────────────────────────────

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

/**
 * Roles allowed to author (create/edit/generate) assignments.
 */
const AUTHOR_ROLES = ["SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "TEACHER"];

/**
 * Extract a JSON array from an AI text response, tolerating markdown fences.
 * Mirrors the timetable function's parsing strategy.
 */
const extractJsonArray = (text: string): unknown[] => {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    throw new Error("AI response did not contain a valid JSON array.");
  }
  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed)) {
    throw new Error("AI response JSON was not an array.");
  }
  return parsed;
};

/**
 * Normalizes a string for lenient deterministic comparison (fallback grader).
 */
const normalize = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "");

/**
 * Deterministic fallback grader used when the AI grading call fails.
 * Awards full points on exact/keyword match, partial on substring overlap.
 */
function deterministicGrade(
  question: AssignmentQuestion,
  answer: string,
): GradedQuestion {
  const a = normalize(answer);
  const key = normalize(question.answerKey ?? "");
  const max = question.points;

  if (!a) {
    return { questionId: question.id, earned: 0, correct: false, feedback: "No answer provided." };
  }
  if (!key) {
    return { questionId: question.id, earned: max, correct: true, feedback: "Answer accepted." };
  }

  const exact = a === key;
  const contains = a.includes(key) || key.includes(a);
  if (exact || contains) {
    return { questionId: question.id, earned: max, correct: true, feedback: "Correct." };
  }

  // Token overlap scoring: give partial credit when half the keywords match.
  const keyTokens = key.split(" ").filter((t) => t.length > 2);
  if (keyTokens.length > 0) {
    const hits = keyTokens.filter((t) => a.includes(t)).length;
    if (hits / keyTokens.length >= 0.5) {
      return {
        questionId: question.id,
        earned: Math.round((max / 2) * 100) / 100,
        correct: false,
        feedback: "Partially correct — missing some key points.",
      };
    }
  }

  return {
    questionId: question.id,
    earned: 0,
    correct: false,
    feedback: "Incorrect — review the expected answer.",
  };
}

// ─── Controller Functions ─────────────────────────────────────────────────────

/**
 * GET /api/assignments
 *
 * Lists assignments, optionally filtered by gradeId / academicYearId / subjectId / status.
 *
 * Role-aware:
 *   - STUDENT → only PUBLISHED assignments for their own grade + academic year.
 *   - PARENT  → only PUBLISHED assignments (across grades their children belong to).
 *   - Others  → all assignments matching the query filters.
 *
 * Access: all authenticated roles.
 */
export const listAssignments = async (req: Request, res: Response) => {
  try {
    const gradeId = asStr(req.query.gradeId);
    const academicYearId = asStr(req.query.academicYearId);
    const subjectId = asStr(req.query.subjectId);
    const status = asStr(req.query.status);

    const role = req.user?.role as string;
    const where: Record<string, unknown> = {};

    // ── Role-aware scoping ────────────────────────────────────────────
    if (role === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: req.user!.id },
        select: { gradeId: true, academicYearId: true },
      });
      if (!studentProfile) {
        return res.json({ data: [] });
      }
      where.gradeId = studentProfile.gradeId;
      where.academicYearId = studentProfile.academicYearId;
      where.status = "PUBLISHED";
    } else if (role === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: req.user!.id },
        select: {
          students: { select: { student: { select: { gradeId: true } } } },
        },
      });
      const gradeIds = [
        ...new Set(parentProfile?.students.map((s) => s.student.gradeId) ?? []),
      ];
      if (gradeIds.length > 0) where.gradeId = { in: gradeIds };
      where.status = "PUBLISHED";
    } else {
      if (gradeId) where.gradeId = gradeId;
      if (academicYearId) where.academicYearId = academicYearId;
      if (subjectId) where.subjectId = subjectId;
      if (status) where.status = status;
    }

    const assignments = await prisma.assignment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        grade: { select: { id: true, name: true, section: true } },
        academicYear: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { submissions: true } },
      },
    });

    // ── Security: non-staff viewers must NOT receive answer keys ─────
    // The list endpoint returns the full record (including the questions
    // JSON), so strip answerKey for students/parents before responding.
    const isStaffViewer = AUTHOR_ROLES.includes(role);
    const safeAssignments = isStaffViewer
      ? assignments
      : assignments.map((a) => ({
          ...a,
          questions: (a.questions as unknown as AssignmentQuestion[]).map(
            (q) => ({ id: q.id, question: q.question, points: q.points }),
          ),
        }));

    return res.json({ data: safeAssignments });
  } catch (error) {
    console.error("[Assignments] List error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to retrieve assignments." },
    });
  }
};

/**
 * GET /api/assignments/:id
 *
 * Returns a single assignment.
 * Students/parents get the questions with answerKeys stripped (so they can't
 * peek before submitting); staff get the full question set.
 *
 * Access: all authenticated roles.
 */
export const getAssignment = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Assignment ID is required." },
      });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        grade: { select: { id: true, name: true, section: true } },
        academicYear: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { submissions: true } },
      },
    });

    if (!assignment) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Assignment not found." },
      });
    }

    const role = req.user?.role as string;
    const isStaff = AUTHOR_ROLES.includes(role) || role === "SUPER_ADMIN";

    // Students can only open published assignments of their own grade.
    if (role === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: req.user!.id },
        select: { gradeId: true, academicYearId: true },
      });
      if (
        !studentProfile ||
        studentProfile.gradeId !== assignment.gradeId ||
        studentProfile.academicYearId !== assignment.academicYearId ||
        assignment.status !== "PUBLISHED"
      ) {
        return res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "This assignment is not available to you.",
          },
        });
      }
    }

    // Strip answer keys for non-staff viewers.
    const questions = (assignment.questions as unknown as AssignmentQuestion[]).map(
      (q) =>
        isStaff
          ? q
          : { id: q.id, question: q.question, points: q.points },
    );

    // Students get their own submission attached so the UI can show
    // previous attempts / results.
    let mySubmission = null;
    if (role === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: req.user!.id },
        select: { id: true },
      });
      if (studentProfile) {
        mySubmission = await prisma.assignmentSubmission.findUnique({
          where: {
            assignmentId_studentId: {
              assignmentId: id,
              studentId: studentProfile.id,
            },
          },
          select: {
            id: true,
            status: true,
            score: true,
            totalPoints: true,
            feedback: true,
            answers: true,
            submittedAt: true,
            gradedAt: true,
          },
        });
      }
    }

    return res.json({ data: { ...assignment, questions, mySubmission } });
  } catch (error) {
    console.error("[Assignments] Get error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to retrieve assignment." },
    });
  }
};

/**
 * POST /api/assignments/generate
 *
 * Triggers the Inngest function to generate a question draft for a grade using
 * Gemini. The function runs asynchronously — this endpoint returns immediately
 * with a jobId so the client can poll GET /api/assignments/generate/:jobId for
 * the generated questions (which are NOT persisted until the teacher saves).
 *
 * Body:
 *   gradeId        (string, required)
 *   academicYearId (string, required)
 *   subjectId      (string, optional) — focus on one subject; else across the grade's subjects
 *   topic          (string, optional) — e.g. "Fractions", "Photosynthesis"
 *   difficulty     (string, optional) — Easy | Medium | Hard (default Medium)
 *   questionCount  (number, optional) — 1–20 (default 5)
 *   type           (string, optional) — WITH_ANSWERS | QUESTIONS_ONLY (default WITH_ANSWERS)
 *
 * Access: SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, TEACHER
 */
export const generateAssignmentQuestions = async (req: Request, res: Response) => {
  try {
    const {
      gradeId,
      academicYearId,
      subjectId,
      topic,
      difficulty,
      questionCount,
      type,
    } = req.body;

    // ── Validate required fields ──────────────────────────────────────
    if (!gradeId || typeof gradeId !== "string") {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "gradeId is required." },
      });
    }
    if (!academicYearId || typeof academicYearId !== "string") {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "academicYearId is required." },
      });
    }

    const count =
      typeof questionCount === "number"
        ? Math.min(Math.max(Math.round(questionCount), 1), 20)
        : 5;
    const typeValue =
      type === "QUESTIONS_ONLY" ? "QUESTIONS_ONLY" : "WITH_ANSWERS";
    const difficultyValue =
      difficulty === "Easy" || difficulty === "Hard" ? difficulty : "Medium";

    // ── Verify grade & academic year exist (fail fast, don't queue) ──
    const [grade, academicYear] = await Promise.all([
      prisma.grade.findUnique({
        where: { id: gradeId },
        select: { id: true, name: true, section: true },
      }),
      prisma.academicYear.findUnique({
        where: { id: academicYearId },
        select: { id: true, name: true },
      }),
    ]);

    if (!grade) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Grade not found." },
      });
    }
    if (!academicYear) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Academic year not found." },
      });
    }

    // ── Create the job & fire the Inngest event ──────────────────────
    const jobId = assignmentGenerationStore.create();

    await inngest.send({
      name: "assignments/generate",
      data: {
        jobId,
        gradeId,
        academicYearId,
        subjectId: subjectId || undefined,
        topic: topic || undefined,
        difficulty: difficultyValue,
        questionCount: count,
        type: typeValue,
      },
    });

    // ── Audit log ─────────────────────────────────────────────────────
    const userId = getUserId(req);
    if (userId) {
      logActivityAsync({
        userId,
        activity: "assignment:generated",
        details: `Triggered AI question generation for "${grade.name} - ${grade.section}" (Inngest job: ${jobId})`,
      });
    }

    return res.status(202).json({
      data: {
        jobId,
        message: `Question generation started for "${grade.name} - ${grade.section}".`,
      },
    });
  } catch (error) {
    console.error("[Assignments] Generate error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to start assignment generation.",
      },
    });
  }
};

/**
 * GET /api/assignments/generate/:jobId
 *
 * Returns the state of an async question-generation job:
 *   { status: "pending" | "completed" | "failed", questions?, error? }
 *
 * Access: SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, TEACHER
 */
export const getGenerationJob = async (req: Request, res: Response) => {
  try {
    const jobId = asStr(req.params.jobId);
    if (!jobId) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Job ID is required." },
      });
    }

    const job = assignmentGenerationStore.get(jobId);
    if (!job) {
      return res.status(404).json({
        error: {
          code: "JOB_NOT_FOUND",
          message: "Generation job not found or expired.",
        },
      });
    }

    return res.json({ data: job });
  } catch (error) {
    console.error("[Assignments] Generation job error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve generation job.",
      },
    });
  }
};

/**
 * POST /api/assignments
 *
 * Creates a new assignment (after AI generation or fully manual).
 *
 * Body:
 *   title          (string, required)
 *   description    (string, optional)
 *   type           (string, required) — WITH_ANSWERS | QUESTIONS_ONLY
 *   status         (string, optional) — DRAFT | PUBLISHED (default DRAFT)
 *   gradeId        (string, required)
 *   academicYearId (string, required)
 *   subjectId      (string, optional)
 *   questions      (array, required) — [{ id, question, points, answerKey? }]
 *   dueDate        (string, optional) — ISO 8601
 *
 * Access: SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, TEACHER
 */
export const createAssignment = async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      type,
      status,
      gradeId,
      academicYearId,
      subjectId,
      questions,
      dueDate,
    } = req.body;

    // ── Validate required fields ──────────────────────────────────────
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Title is required and must be a non-empty string.",
        },
      });
    }

    if (type !== "WITH_ANSWERS" && type !== "QUESTIONS_ONLY") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "type must be WITH_ANSWERS or QUESTIONS_ONLY.",
        },
      });
    }

    if (!gradeId || typeof gradeId !== "string") {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "gradeId is required." },
      });
    }
    if (!academicYearId || typeof academicYearId !== "string") {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "academicYearId is required." },
      });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "questions must be a non-empty array.",
        },
      });
    }

    // Validate each question
    const validatedQuestions: AssignmentQuestion[] = questions.map(
      (q: Record<string, unknown>, index: number) => {
        if (typeof q.question !== "string" || !q.question.trim()) {
          throw new Error(`Question ${index + 1} is missing text.`);
        }
        const item: AssignmentQuestion = {
          id: typeof q.id === "string" && q.id ? q.id : `q${index + 1}`,
          question: q.question.trim(),
          points: typeof q.points === "number" && q.points > 0 ? q.points : 5,
        };
        if (type === "WITH_ANSWERS" && typeof q.answerKey === "string") {
          item.answerKey = q.answerKey.trim();
        }
        return item;
      },
    );

    // ── Verify grade & academic year exist ────────────────────────────
    const [grade, academicYear] = await Promise.all([
      prisma.grade.findUnique({
        where: { id: gradeId },
        select: { id: true, name: true, section: true },
      }),
      prisma.academicYear.findUnique({
        where: { id: academicYearId },
        select: { id: true, name: true },
      }),
    ]);

    if (!grade) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Grade not found." },
      });
    }
    if (!academicYear) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Academic year not found." },
      });
    }

    // ── Verify optional subject belongs to the grade ──────────────────
    if (subjectId) {
      const subject = await prisma.subject.findFirst({
        where: { id: subjectId, gradeId },
        select: { id: true, name: true },
      });
      if (!subject) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Subject does not belong to the selected grade.",
          },
        });
      }
    }

    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Authentication required." },
      });
    }

    // ── Create the assignment ─────────────────────────────────────────
    const assignment = await prisma.assignment.create({
      data: {
        title: title.trim(),
        description: (description as string | null | undefined) ?? null,
        type: type as "WITH_ANSWERS" | "QUESTIONS_ONLY",
        status: status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
        gradeId,
        academicYearId,
        subjectId: subjectId ?? null,
        questions: validatedQuestions as unknown as object,
        dueDate: dueDate ? new Date(dueDate) : null,
        createdById: userId,
      },
      include: {
        grade: { select: { id: true, name: true, section: true } },
        academicYear: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
    });

    // ── Audit log ─────────────────────────────────────────────────────
    logActivityAsync({
      userId,
      activity: "assignment:created",
      details: `Created assignment "${assignment.title}" (${validatedQuestions.length} questions) for "${grade.name} - ${grade.section}"`,
    });

    return res.status(201).json({ data: assignment });
  } catch (error: any) {
    if (error?.message?.includes("missing text")) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: error.message },
      });
    }
    console.error("[Assignments] Create error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to create assignment." },
    });
  }
};

/**
 * PATCH /api/assignments/:id
 *
 * Updates an existing assignment (title, description, questions, status, dueDate…).
 *
 * Body (all optional):
 *   title, description, type, status, subjectId, questions, dueDate
 *
 * Access: SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, TEACHER
 */
export const updateAssignment = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Assignment ID is required." },
      });
    }

    const existing = await prisma.assignment.findUnique({
      where: { id },
      select: { id: true, title: true, type: true },
    });

    if (!existing) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Assignment not found." },
      });
    }

    const {
      title,
      description,
      type,
      status,
      subjectId,
      questions,
      dueDate,
    } = req.body;

    const data: Record<string, unknown> = {};

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Title must be a non-empty string.",
          },
        });
      }
      data.title = title.trim();
    }

    if (description !== undefined) data.description = description;

    if (type !== undefined) {
      if (type !== "WITH_ANSWERS" && type !== "QUESTIONS_ONLY") {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "type must be WITH_ANSWERS or QUESTIONS_ONLY.",
          },
        });
      }
      data.type = type;
    }

    if (status !== undefined) {
      if (!["DRAFT", "PUBLISHED", "CLOSED"].includes(status)) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "status must be DRAFT, PUBLISHED, or CLOSED.",
          },
        });
      }
      data.status = status;
    }

    if (subjectId !== undefined) data.subjectId = subjectId || null;

    if (questions !== undefined) {
      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "questions must be a non-empty array.",
          },
        });
      }
      const targetType = (type ?? existing.type) as "WITH_ANSWERS" | "QUESTIONS_ONLY";
      const validated: AssignmentQuestion[] = questions.map(
        (q: Record<string, unknown>, index: number) => {
          if (typeof q.question !== "string" || !q.question.trim()) {
            throw new Error(`Question ${index + 1} is missing text.`);
          }
          const item: AssignmentQuestion = {
            id: typeof q.id === "string" && q.id ? q.id : `q${index + 1}`,
            question: q.question.trim(),
            points: typeof q.points === "number" && q.points > 0 ? q.points : 5,
          };
          if (targetType === "WITH_ANSWERS" && typeof q.answerKey === "string") {
            item.answerKey = q.answerKey.trim();
          }
          return item;
        },
      );
      data.questions = validated as unknown as object;
    }

    if (dueDate !== undefined) {
      data.dueDate = dueDate ? new Date(dueDate) : null;
    }

    const updated = await prisma.assignment.update({
      where: { id },
      data,
      include: {
        grade: { select: { id: true, name: true, section: true } },
        academicYear: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
    });

    // ── Audit log ─────────────────────────────────────────────────────
    const userId = getUserId(req);
    if (userId) {
      const changes = Object.keys(data)
        .map((k) => `${k}: ${JSON.stringify(data[k])}`.slice(0, 120))
        .join(", ");
      logActivityAsync({
        userId,
        activity: "assignment:updated",
        details: `Updated assignment "${existing.title}" — ${changes}`,
      });
    }

    return res.json({ data: updated });
  } catch (error: any) {
    if (error?.message?.includes("missing text")) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: error.message },
      });
    }
    console.error("[Assignments] Update error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to update assignment." },
    });
  }
};

/**
 * DELETE /api/assignments/:id
 *
 * Permanently deletes an assignment (and its submissions via cascade).
 * SUPER_ADMIN or PRINCIPAL only.
 */
export const deleteAssignment = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Assignment ID is required." },
      });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      select: { id: true, title: true },
    });

    if (!assignment) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Assignment not found." },
      });
    }

    await prisma.assignment.delete({ where: { id } });

    // ── Audit log ─────────────────────────────────────────────────────
    const userId = getUserId(req);
    if (userId) {
      logActivityAsync({
        userId,
        activity: "assignment:deleted",
        details: `Deleted assignment "${assignment.title}"`,
      });
    }

    return res.json({
      message: `Assignment "${assignment.title}" deleted successfully.`,
    });
  } catch (error) {
    console.error("[Assignments] Delete error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to delete assignment." },
    });
  }
};

/**
 * POST /api/assignments/:id/submit
 *
 * Student submits their answers.
 *
 * Body:
 *   answers (array, required) — [{ questionId, answer }]
 *
 * Behavior:
 *   - WITH_ANSWERS → instantly AI-graded. Returns the submission with score,
 *     per-question feedback, and correct answers. (Deterministic fallback if the AI call fails.)
 *   - QUESTIONS_ONLY → stored as SUBMITTED; a teacher grades it manually later.
 *
 * Access: STUDENT (of the assignment's grade + academic year)
 */
export const submitAssignment = async (req: Request, res: Response) => {
  try {
    const assignmentId = asStr(req.params.id);
    if (!assignmentId) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Assignment ID is required." },
      });
    }

    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Authentication required." },
      });
    }

    // ── Verify student profile ────────────────────────────────────────
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true, gradeId: true, academicYearId: true },
    });

    if (!studentProfile) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "Only students can submit assignments." },
      });
    }

    // ── Fetch assignment ──────────────────────────────────────────────
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        grade: { select: { id: true, name: true, section: true } },
      },
    });

    if (!assignment) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Assignment not found." },
      });
    }

    if (assignment.status !== "PUBLISHED") {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "This assignment is not open for submission.",
        },
      });
    }

    if (
      assignment.gradeId !== studentProfile.gradeId ||
      assignment.academicYearId !== studentProfile.academicYearId
    ) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "This assignment is not available to your grade.",
        },
      });
    }

    // ── Validate answers ──────────────────────────────────────────────
    const { answers } = req.body;
    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "answers must be a non-empty array.",
        },
      });
    }

    const questions = assignment.questions as unknown as AssignmentQuestion[];
    const answerMap = new Map<string, string>();
    for (const a of answers as StudentAnswer[]) {
      if (a?.questionId && typeof a.answer === "string") {
        answerMap.set(a.questionId, a.answer);
      }
    }

    const normalizedAnswers = questions.map((q) => ({
      questionId: q.id,
      answer: answerMap.get(q.id) ?? "",
    }));

    // ── Block re-submission after grading ─────────────────────────────
    const existing = await prisma.assignmentSubmission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId: studentProfile.id,
        },
      },
      select: { id: true, status: true },
    });

    if (existing?.status === "GRADED") {
      return res.status(409).json({
        error: {
          code: "ALREADY_GRADED",
          message: "This assignment has already been submitted and graded.",
        },
      });
    }

    let score: number | null = null;
    let feedback: GradedQuestion[] | null = null;
    let submissionStatus: "SUBMITTED" | "GRADED" = "SUBMITTED";
    let gradedAt: Date | null = null;

    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);

    // ── WITH_ANSWERS → instant AI grading ─────────────────────────────
    if (assignment.type === "WITH_ANSWERS") {
      try {
        const gradingPrompt = JSON.stringify({
          questions: questions.map((q) => ({
            questionId: q.id,
            question: q.question,
            points: q.points,
            answerKey: q.answerKey ?? "",
          })),
          answers: normalizedAnswers,
        });

        const aiGrade = await generateText({
          model: AI_MODEL,
          system:
            "You are a fair, strict school teacher grading a student's assignment answers against the official answer keys. " +
            "Return ONLY a valid JSON array (no markdown, no commentary). Each item: " +
            '{"questionId": string, "earned": number (0 to the question\'s points, allow partial credit for reasonable answers), "correct": boolean, "feedback": string (one short encouraging sentence)}. ' +
            "earned must never exceed the question's points.",
          prompt: `Grade these answers:\n${gradingPrompt}`,
          temperature: 0.2,
        });

        const rawGrading = extractJsonArray(aiGrade.text);
        const pointsById = new Map(questions.map((q) => [q.id, q.points || 0]));
        const keyById = new Map(
          questions.map((q) => [q.id, q.answerKey ?? ""]),
        );

        feedback = rawGrading
          .map((raw): GradedQuestion | null => {
            const g = raw as Record<string, unknown>;
            const questionId =
              typeof g.questionId === "string" ? g.questionId : "";
            if (!questionId) return null;
            const max = pointsById.get(questionId) ?? 0;
            const earned =
              typeof g.earned === "number"
                ? Math.min(Math.max(g.earned, 0), max)
                : 0;
            return {
              questionId,
              earned,
              correct: earned >= max && max > 0,
              feedback:
                typeof g.feedback === "string"
                  ? g.feedback
                  : earned >= max
                    ? "Correct!"
                    : "Incorrect.",
              correctAnswer: keyById.get(questionId),
            };
          })
          .filter((f): f is GradedQuestion => f !== null);

        // Ensure every question got a grade (fallback for missing entries)
        for (const q of questions) {
          if (!feedback.some((f) => f.questionId === q.id)) {
            feedback.push(deterministicGrade(q, answerMap.get(q.id) ?? ""));
          }
        }

        score = Math.round(feedback.reduce((s, f) => s + f.earned, 0) * 100) / 100;
        submissionStatus = "GRADED";
        gradedAt = new Date();
      } catch (aiError) {
        console.warn("[Assignments] AI grading failed, using fallback:", aiError);
        // Deterministic fallback so students always get instant results
        feedback = questions.map((q) =>
          deterministicGrade(q, answerMap.get(q.id) ?? ""),
        );
        score = Math.round(feedback.reduce((s, f) => s + f.earned, 0) * 100) / 100;
        submissionStatus = "GRADED";
        gradedAt = new Date();
      }
    }

    // ── Upsert the submission ─────────────────────────────────────────
    const submission = await prisma.assignmentSubmission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId: studentProfile.id,
        },
      },
      create: {
        assignmentId,
        studentId: studentProfile.id,
        answers: normalizedAnswers as unknown as object,
        score,
        totalPoints,
        feedback: feedback
          ? (feedback as unknown as object)
          : Prisma.JsonNull,
        status: submissionStatus,
        submittedAt: new Date(),
        gradedAt,
      },
      update: {
        answers: normalizedAnswers as unknown as object,
        score,
        totalPoints,
        feedback: feedback
          ? (feedback as unknown as object)
          : Prisma.JsonNull,
        status: submissionStatus,
        submittedAt: new Date(),
        gradedAt,
      },
      include: {
        assignment: {
          select: {
            id: true,
            title: true,
            type: true,
            grade: { select: { name: true, section: true } },
          },
        },
      },
    });

    // ── Audit log ─────────────────────────────────────────────────────
    logActivityAsync({
      userId,
      activity: "assignment:submitted",
      details:
        submissionStatus === "GRADED"
          ? `Submitted & auto-graded "${assignment.title}" (${score}/${totalPoints})`
          : `Submitted "${assignment.title}" — awaiting teacher grading`,
    });

    return res.status(201).json({ data: submission });
  } catch (error) {
    console.error("[Assignments] Submit error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to submit assignment." },
    });
  }
};

/**
 * GET /api/assignments/:id/submissions
 *
 * Returns all submissions for an assignment with student info.
 *
 * Access: SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, TEACHER, COUNSELOR
 */
export const listAssignmentSubmissions = async (req: Request, res: Response) => {
  try {
    const assignmentId = asStr(req.params.id);
    if (!assignmentId) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Assignment ID is required." },
      });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, title: true },
    });

    if (!assignment) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Assignment not found." },
      });
    }

    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignmentId },
      orderBy: { submittedAt: "desc" },
      include: {
        student: {
          select: {
            id: true,
            admissionNumber: true,
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
      },
    });

    return res.json({ data: submissions });
  } catch (error) {
    console.error("[Assignments] Submissions list error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve submissions.",
      },
    });
  }
};

/**
 * PATCH /api/assignments/submissions/:submissionId
 *
 * Manually grades a submission (used for QUESTIONS_ONLY assignments or to
 * override an auto-grade).
 *
 * Body:
 *   score    (number, required) — awarded points (0 … totalPoints)
 *   feedback (array, optional)  — per-question [{ questionId, earned, correct, feedback }]
 *
 * Access: SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, TEACHER
 */
export const gradeSubmission = async (req: Request, res: Response) => {
  try {
    const submissionId = asStr(req.params.submissionId);
    if (!submissionId) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Submission ID is required." },
      });
    }

    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      select: { id: true, totalPoints: true, assignment: { select: { title: true } } },
    });

    if (!submission) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Submission not found." },
      });
    }

    const { score, feedback } = req.body;

    if (typeof score !== "number" || score < 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "score must be a non-negative number.",
        },
      });
    }

    if (score > submission.totalPoints) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: `score cannot exceed the total points (${submission.totalPoints}).`,
        },
      });
    }

    const userId = getUserId(req);
    const updated = await prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        score,
        feedback:
          feedback === undefined
            ? undefined
            : feedback
              ? (feedback as unknown as object)
              : Prisma.JsonNull,
        status: "GRADED",
        gradedAt: new Date(),
        gradedById: userId,
      },
      include: {
        student: {
          select: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    // ── Audit log ─────────────────────────────────────────────────────
    if (userId) {
      logActivityAsync({
        userId,
        activity: "assignment:graded",
        details: `Graded "${submission.assignment.title}" for ${updated.student.user.name}: ${score}/${submission.totalPoints}`,
      });
    }

    return res.json({ data: updated });
  } catch (error) {
    console.error("[Assignments] Grade error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to grade submission." },
    });
  }
};
