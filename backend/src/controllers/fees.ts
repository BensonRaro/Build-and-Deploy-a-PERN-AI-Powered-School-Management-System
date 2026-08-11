/**
 * Fees Controller
 *
 * Request handlers for school fee structure CRUD operations.
 * A fee structure defines the school fees payable by a Grade for a
 * specific Term — e.g. "Grade 10 — Term 1 — 250.00". Each grade/term
 * combination can have exactly one fee amount (enforced by the
 * @@unique([gradeId, termId]) constraint in the Prisma schema).
 *
 * @module fees/controller
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

/**
 * Parses and validates a fee amount. Returns the numeric value (as a string
 * so it can be passed straight to Prisma's Decimal field) or null if invalid.
 * Amounts must be finite and greater than zero.
 */
const parseAmount = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return String(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return String(num);
  }
  return null;
};

/**
 * Verifies that the given grade and term exist and belong to the same
 * academic year (a fee only makes sense within one academic cycle).
 * Returns the parent grade + term or a tuple with an error response.
 */
const validateGradeAndTerm = async (
  gradeId: string,
  termId: string,
  res: Response,
): Promise<{
  grade: { id: string; name: string; section: string; academicYearId: string };
  term: { id: string; name: string; academicYearId: string };
} | null> => {
  const [grade, term] = await Promise.all([
    prisma.grade.findUnique({
      where: { id: gradeId },
      select: { id: true, name: true, section: true, academicYearId: true },
    }),
    prisma.term.findUnique({
      where: { id: termId },
      select: { id: true, name: true, academicYearId: true },
    }),
  ]);

  if (!grade) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Grade not found." },
    });
    return null;
  }

  if (!term) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Term not found." },
    });
    return null;
  }

  if (term.academicYearId !== grade.academicYearId) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message:
          "The selected term does not belong to the same academic year as the selected grade.",
      },
    });
    return null;
  }

  return { grade, term };
};

// ─── Controller Functions ─────────────────────────────────────────────────────

/**
 * GET /api/fees
 *
 * Returns all fee structures, ordered by grade name ascending.
 * Optionally filtered via query params:
 *   ?gradeId=<id>       — only fees for a specific grade
 *   ?termId=<id>        — only fees for a specific term
 *   ?academicYearId=<id> — only fees whose grade belongs to an academic year
 *
 * Access:
 *   SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, ACCOUNTANT — read access
 */
export const listFees = async (req: Request, res: Response) => {
  try {
    const gradeId = asStr(req.query.gradeId);
    const termId = asStr(req.query.termId);
    const academicYearId = asStr(req.query.academicYearId);

    const where: Record<string, unknown> = {};
    if (gradeId) where.gradeId = gradeId;
    if (termId) where.termId = termId;
    if (academicYearId) {
      where.grade = { academicYearId };
    }

    const fees = await prisma.feeStructure.findMany({
      where,
      orderBy: { grade: { name: "asc" } },
      include: {
        grade: {
          select: { id: true, name: true, section: true, academicYearId: true },
        },
        term: {
          select: { id: true, name: true, academicYearId: true },
        },
      },
    });

    return res.json({ data: fees });
  } catch (error) {
    console.error("[Fees] List error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve fee structures.",
      },
    });
  }
};

/**
 * GET /api/fees/:id
 *
 * Returns a single fee structure with its grade and term.
 */
export const getFee = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Fee structure ID is required." },
      });
    }

    const fee = await prisma.feeStructure.findUnique({
      where: { id },
      include: {
        grade: {
          select: { id: true, name: true, section: true, academicYearId: true },
        },
        term: {
          select: { id: true, name: true, academicYearId: true },
        },
      },
    });

    if (!fee) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Fee structure not found.",
        },
      });
    }

    return res.json({ data: fee });
  } catch (error) {
    console.error("[Fees] Get error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve fee structure.",
      },
    });
  }
};

/**
 * POST /api/fees
 *
 * Creates a new fee structure for a grade within a term.
 *
 * Body:
 *   gradeId  (string, required) — ID of the grade this fee applies to
 *   termId   (string, required) — ID of the term this fee applies to
 *   amount   (number|string, required) — fee amount, must be > 0
 */
export const createFee = async (req: Request, res: Response) => {
  try {
    const { gradeId, termId, amount } = req.body;

    // ── Validate required fields ──────────────────────────────────────
    if (!gradeId || typeof gradeId !== "string") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "gradeId is required and must be a string.",
        },
      });
    }

    if (!termId || typeof termId !== "string") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "termId is required and must be a string.",
        },
      });
    }

    const parsedAmount = parseAmount(amount);
    if (!parsedAmount) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Amount is required and must be a positive number.",
        },
      });
    }

    // ── Verify grade & term exist and share an academic year ──────────
    const validated = await validateGradeAndTerm(gradeId, termId, res);
    if (!validated) return;
    const { grade, term } = validated;

    // ── Check for a duplicate fee on this grade/term pair ─────────────
    const existing = await prisma.feeStructure.findUnique({
      where: { gradeId_termId: { gradeId, termId } },
      select: { id: true },
    });

    if (existing) {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: `A fee structure for \"${grade.name} - ${grade.section}\" in \"${term.name}\" already exists. Edit or delete it instead.`,
        },
      });
    }

    // ── Create the fee structure ──────────────────────────────────────
    // Include grade + term so the response matches the GET shape
    // (frontend relies on these relations for display/toasts).
    const fee = await prisma.feeStructure.create({
      data: {
        gradeId,
        termId,
        amount: parsedAmount,
      },
      include: {
        grade: {
          select: { id: true, name: true, section: true, academicYearId: true },
        },
        term: {
          select: { id: true, name: true, academicYearId: true },
        },
      },
    });

    // ── Audit log ─────────────────────────────────────────────────────
    const userId = getUserId(req);
    if (userId) {
      logActivityAsync({
        userId,
        activity: "fee:created",
        details: `Created school fee of ${parsedAmount} for \"${grade.name} - ${grade.section}\" in \"${term.name}\"`,
      });
    }

    return res.status(201).json({ data: fee });
  } catch (error: any) {
    // Handle Prisma unique constraint violations (gradeId + termId pair)
    if (error?.code === "P2002") {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "A fee structure for this grade and term already exists.",
        },
      });
    }

    console.error("[Fees] Create error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to create fee structure.",
      },
    });
  }
};

/**
 * PATCH /api/fees/:id
 *
 * Updates an existing fee structure.
 *
 * Body (all optional):
 *   gradeId  (string) — new grade this fee applies to
 *   termId   (string) — new term this fee applies to
 *   amount   (number|string) — new fee amount, must be > 0
 */
export const updateFee = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Fee structure ID is required." },
      });
    }

    // ── Verify fee exists & fetch current data ────────────────────────
    const existing = await prisma.feeStructure.findUnique({
      where: { id },
      include: {
        grade: { select: { id: true, name: true, section: true } },
        term: { select: { id: true, name: true } },
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Fee structure not found.",
        },
      });
    }

    const { gradeId, termId, amount } = req.body;

    // ── Build update payload ──────────────────────────────────────────
    const data: Record<string, unknown> = {};

    if (amount !== undefined) {
      const parsedAmount = parseAmount(amount);
      if (!parsedAmount) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Amount must be a positive number.",
          },
        });
      }
      data.amount = parsedAmount;
    }

    // ── Validate grade/term changes (if any) ──────────────────────────
    const effectiveGradeId = (gradeId as string | undefined) ?? existing.gradeId;
    const effectiveTermId = (termId as string | undefined) ?? existing.termId;

    if (gradeId !== undefined) {
      if (typeof gradeId !== "string") {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "gradeId must be a string.",
          },
        });
      }
      data.gradeId = gradeId;
    }

    if (termId !== undefined) {
      if (typeof termId !== "string") {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "termId must be a string.",
          },
        });
      }
      data.termId = termId;
    }

    if (gradeId !== undefined || termId !== undefined) {
      const validated = await validateGradeAndTerm(
        effectiveGradeId,
        effectiveTermId,
        res,
      );
      if (!validated) return;

      // ── Duplicate check against other fees (exclude self) ──────────
      const duplicate = await prisma.feeStructure.findFirst({
        where: {
          id: { not: id },
          gradeId: effectiveGradeId,
          termId: effectiveTermId,
        },
        select: { id: true },
      });

      if (duplicate) {
        return res.status(409).json({
          error: {
            code: "CONFLICT",
            message: `A fee structure for \"${validated.grade.name} - ${validated.grade.section}\" in \"${validated.term.name}\" already exists.`,
          },
        });
      }
    }

    // ── Update ────────────────────────────────────────────────────────
    // Include grade + term so the response matches the GET shape.
    const updated = await prisma.feeStructure.update({
      where: { id },
      data,
      include: {
        grade: {
          select: { id: true, name: true, section: true, academicYearId: true },
        },
        term: {
          select: { id: true, name: true, academicYearId: true },
        },
      },
    });

    // ── Audit log ─────────────────────────────────────────────────────
    const userId = getUserId(req);
    if (userId) {
      const changes = Object.keys(data)
        .map((k) => `${k}: ${JSON.stringify(data[k])}`)
        .join(", ");
      logActivityAsync({
        userId,
        activity: "fee:updated",
        details: `Updated school fee for \"${existing.grade.name} - ${existing.grade.section}\" in \"${existing.term.name}\" — ${changes}`,
      });
    }

    return res.json({ data: updated });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "A fee structure for this grade and term already exists.",
        },
      });
    }

    console.error("[Fees] Update error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to update fee structure.",
      },
    });
  }
};

/**
 * DELETE /api/fees/:id
 *
 * Permanently deletes a fee structure. Blocked if it is already referenced
 * by invoice items (financial history must be preserved).
 * SUPER_ADMIN or PRINCIPAL only.
 */
export const deleteFee = async (req: Request, res: Response) => {
  try {
    const id = asStr(req.params.id);
    if (!id) {
      return res.status(400).json({
        error: { code: "INVALID_ID", message: "Fee structure ID is required." },
      });
    }

    // ── Verify existence & check for references ───────────────────────
    const fee = await prisma.feeStructure.findUnique({
      where: { id },
      include: {
        grade: { select: { id: true, name: true, section: true } },
        term: { select: { id: true, name: true } },
        _count: { select: { invoiceItems: true } },
      },
    });

    if (!fee) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Fee structure not found.",
        },
      });
    }

    if (fee._count.invoiceItems > 0) {
      return res.status(409).json({
        error: {
          code: "HAS_ASSOCIATIONS",
          message: `Cannot delete this fee structure: it is referenced by ${fee._count.invoiceItems} invoice item(s).`,
        },
      });
    }

    await prisma.feeStructure.delete({ where: { id } });

    // ── Audit log ─────────────────────────────────────────────────────
    const userId = getUserId(req);
    if (userId) {
      logActivityAsync({
        userId,
        activity: "fee:deleted",
        details: `Deleted school fee for \"${fee.grade.name} - ${fee.grade.section}\" in \"${fee.term.name}\"`,
      });
    }

    return res.json({
      message: `Fee structure for \"${fee.grade.name} - ${fee.grade.section}\" (${fee.term.name}) deleted successfully.`,
    });
  } catch (error) {
    console.error("[Fees] Delete error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to delete fee structure.",
      },
    });
  }
};
