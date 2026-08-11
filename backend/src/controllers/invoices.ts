/**
 * Invoices Controller
 *
 * Request handlers for school-fee invoices.
 *
 * Invoices are generated automatically when a student (or parent on their
 * child's behalf) pays a fee structure via Stripe Checkout — see the Payments
 * controller. Each invoice carries one InvoiceItem per fee structure (term),
 * and payments are attached to it as they come in.
 *
 * Endpoints:
 *   GET /api/invoices      — Full invoice list for management with filters
 *                            (?status, ?academicYearId) + scoped totals
 *   GET /api/invoices/my   — The current user's invoices (student → their own,
 *                            parent → their linked children's)
 *   GET /api/invoices/:id  — Single invoice with full item + payment breakdown
 *
 * @module invoices/controller
 */

import type { Request, Response } from "express";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

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

/** Converts a Prisma Decimal (or string/number) to a JS number. */
const toNum = (value: unknown): number => Number(value ?? 0) || 0;

/** Rounds to 2 decimal places. */
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * The shared include for invoice rows — items (with their term) and payments,
 * plus the student (user + grade) and academic year. Used by the list and
 * detail endpoints so the response shape stays consistent.
 */
const invoiceInclude = {
  academicYear: { select: { id: true, name: true } },
  student: {
    select: {
      id: true,
      admissionNumber: true,
      user: { select: { name: true } },
      grade: { select: { id: true, name: true, section: true } },
    },
  },
  items: {
    select: {
      id: true,
      amount: true,
      feeStructureId: true,
      feeStructure: {
        select: {
          term: { select: { id: true, name: true } },
          grade: { select: { id: true, name: true, section: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  payments: {
    select: {
      id: true,
      amount: true,
      paymentDate: true,
      paymentMethod: true,
      referenceNumber: true,
      stripeCheckoutSessionId: true,
      recordedBy: { select: { name: true } },
    },
    orderBy: { paymentDate: "desc" as const },
  },
} as const;

/** The Prisma result type inferred from the shared include. */
type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: typeof invoiceInclude;
}>;

/**
 * Maps a Prisma invoice (with the shared include) into the API response shape:
 * flattened items/payments plus computed billed / paid / balance totals.
 */
const invoiceShape = (inv: NonNullable<InvoiceWithRelations>) => {
  const billed = inv.items.reduce((sum, i) => sum + toNum(i.amount), 0);
  const paid = inv.payments.reduce((sum, p) => sum + toNum(p.amount), 0);

  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    dueDate: inv.dueDate,
    status: inv.status,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
    academicYear: inv.academicYear
      ? { id: inv.academicYear.id, name: inv.academicYear.name }
      : undefined,
    student: inv.student
      ? {
          id: inv.student.id,
          admissionNumber: inv.student.admissionNumber,
          user: { name: inv.student.user?.name ?? "Unknown" },
          grade: inv.student.grade
            ? {
                id: inv.student.grade.id,
                name: inv.student.grade.name,
                section: inv.student.grade.section,
              }
            : undefined,
        }
      : undefined,
    items: inv.items.map((i) => ({
      id: i.id,
      amount: String(toNum(i.amount)),
      feeStructureId: i.feeStructureId,
      term: i.feeStructure?.term
        ? { id: i.feeStructure.term.id, name: i.feeStructure.term.name }
        : undefined,
      grade: i.feeStructure?.grade
        ? {
            id: i.feeStructure.grade.id,
            name: i.feeStructure.grade.name,
            section: i.feeStructure.grade.section,
          }
        : undefined,
    })),
    payments: inv.payments.map((p) => ({
      id: p.id,
      amount: String(toNum(p.amount)),
      paymentDate: p.paymentDate,
      paymentMethod: p.paymentMethod,
      referenceNumber: p.referenceNumber,
      stripeCheckoutSessionId: p.stripeCheckoutSessionId,
      recordedBy: p.recordedBy ?? null,
    })),
    totals: {
      billed: round2(billed),
      paid: round2(paid),
      balance: round2(Math.max(billed - paid, 0)),
    },
  };
};

/**
 * Computes the scoped summary totals + per-status counts for a set of invoices.
 * Billed excludes CANCELLED invoices (they never need collecting); collected
 * counts every payment recorded within the scope.
 */
const computeTotals = (invoices: NonNullable<InvoiceWithRelations>[]) => {
  const active = invoices.filter((inv) => inv.status !== "CANCELLED");
  const billed = active.reduce(
    (sum, inv) => sum + inv.items.reduce((s, i) => s + toNum(i.amount), 0),
    0,
  );
  const collected = invoices.reduce(
    (sum, inv) => sum + inv.payments.reduce((s, p) => s + toNum(p.amount), 0),
    0,
  );
  const outstanding = Math.max(billed - collected, 0);

  return {
    count: invoices.length,
    billed: round2(billed),
    collected: round2(collected),
    outstanding: round2(outstanding),
    collectionRate: billed > 0 ? round2((collected / billed) * 100) : 0,
    statusCounts: {
      UNPAID: invoices.filter((i) => i.status === "UNPAID").length,
      PARTIALLY_PAID: invoices.filter((i) => i.status === "PARTIALLY_PAID").length,
      PAID: invoices.filter((i) => i.status === "PAID").length,
      CANCELLED: invoices.filter((i) => i.status === "CANCELLED").length,
    },
  };
};

/**
 * Resolves the student profile IDs the authenticated user "owns":
 *   - STUDENT → their own profile
 *   - PARENT  → profiles linked via StudentGuardian
 *   - everyone else → none (management uses the unscoped list endpoint)
 */
const ownedStudentIds = async (user: {
  id: string;
  role?: string | null;
}): Promise<string[]> => {
  const role = user.role ?? "";
  if (role === "STUDENT") {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    return profile ? [profile.id] : [];
  }

  if (role === "PARENT") {
    const parent = await prisma.parentProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!parent) return [];
    const links = await prisma.studentGuardian.findMany({
      where: { parentId: parent.id },
      select: { studentId: true },
    });
    return links.map((l) => l.studentId);
  }

  return [];
};

// ─── Controller Functions ─────────────────────────────────────────────────────

/**
 * GET /api/invoices
 *
 * Full invoice list for management roles. Optional filters:
 *   ?status=<InvoiceStatus>  — UNPAID | PARTIALLY_PAID | PAID | CANCELLED
 *   ?academicYearId=<id>     — scope to one academic year
 *
 * Response: { data: { invoices, totals, statusCounts } } where totals are
 * scoped to the active filters.
 */
export const listInvoices = async (req: Request, res: Response) => {
  try {
    const status = asStr(req.query.status);
    const academicYearId = asStr(req.query.academicYearId);

    // Fetch the full scoped set ONCE. Rows are then filtered by status in
    // memory, while totals/status chips always reflect the entire scoped set —
    // this avoids a second (identical, potentially large) query whenever a
    // status filter is active.
    const invoices = await prisma.invoice.findMany({
      where: academicYearId ? { academicYearId } : {},
      include: invoiceInclude,
      orderBy: { createdAt: "desc" },
    });

    const rows = status
      ? invoices.filter((inv) => inv.status === status)
      : invoices;
    const shaped = rows.map((inv) => invoiceShape(inv));

    return res.json({
      data: {
        invoices: shaped,
        totals: computeTotals(invoices),
      },
    });
  } catch (error) {
    console.error("[Invoices] List error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve invoices.",
      },
    });
  }
};

/**
 * GET /api/invoices/my
 *
 * The current user's invoices:
 *   - STUDENT → their own invoices
 *   - PARENT  → invoices for every linked child
 *   - others  → empty list
 *
 * Supports the same ?status / ?academicYearId filters as the management list.
 */
export const getMyInvoices = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const status = asStr(req.query.status);
    const academicYearId = asStr(req.query.academicYearId);

    const studentIds = await ownedStudentIds(user);
    if (studentIds.length === 0) {
      return res.json({
        data: {
          invoices: [],
          totals: {
            count: 0,
            billed: 0,
            collected: 0,
            outstanding: 0,
            collectionRate: 0,
            statusCounts: {
              UNPAID: 0,
              PARTIALLY_PAID: 0,
              PAID: 0,
              CANCELLED: 0,
            },
          },
        },
      });
    }

    // Fetch the user's full scoped set ONCE; filter rows by status in memory
    // while totals/chips keep reflecting the entire scoped set — no second
    // query when a status filter is active.
    const invoices = await prisma.invoice.findMany({
      where: {
        studentId: { in: studentIds },
        ...(academicYearId ? { academicYearId } : {}),
      },
      include: invoiceInclude,
      orderBy: { createdAt: "desc" },
    });

    const rows = status
      ? invoices.filter((inv) => inv.status === status)
      : invoices;
    const shaped = rows.map((inv) => invoiceShape(inv));

    return res.json({
      data: {
        invoices: shaped,
        totals: computeTotals(invoices),
      },
    });
  } catch (error) {
    console.error("[Invoices] My invoices error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve your invoices.",
      },
    });
  }
};

/**
 * GET /api/invoices/:id
 *
 * Full detail for a single invoice — items (per term) and the complete
 * payment breakdown (method, reference, recorder). Access is granted to
 * management roles and to the student / parent who owns the invoice.
 */
export const getInvoice = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const role = user.role ?? "";
    const management =
      role === "SUPER_ADMIN" ||
      role === "PRINCIPAL" ||
      role === "VICE_PRINCIPAL" ||
      role === "ACCOUNTANT";

    const invoice = await prisma.invoice.findUnique({
      where: { id: asStr(req.params.id) ?? "" },
      include: invoiceInclude,
    });

    if (!invoice) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Invoice not found." },
      });
    }

    // Ownership check for non-management users
    if (!management) {
      const studentIds = await ownedStudentIds(user);
      if (!studentIds.includes(invoice.studentId)) {
        return res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "You do not have access to this invoice.",
          },
        });
      }
    }

    return res.json({ data: invoiceShape(invoice) });
  } catch (error) {
    console.error("[Invoices] Detail error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve the invoice.",
      },
    });
  }
};
