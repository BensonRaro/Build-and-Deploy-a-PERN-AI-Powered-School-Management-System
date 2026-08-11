/**
 * Payments Controller
 *
 * Request handlers for school-fee payments made via Stripe Checkout.
 *
 * Flow:
 *   1. A student (or parent on their child's behalf) requests a checkout
 *      session for a fee structure → POST /api/payments/checkout.
 *   2. The controller resolves the student profile, ensures an Invoice +
 *      InvoiceItem exist for that fee, and creates a Stripe Checkout session
 *      (one-time payment mode) with our internal IDs in the session metadata.
 *   3. After the customer pays, Stripe fires `checkout.session.completed`
 *      to /api/auth/stripe/webhook — handled by the @better-auth/stripe
 *      plugin's `onEvent` (see lib/stripe-events.ts), which creates the
 *      Payment record and updates the invoice status.
 *
 * @module payments/controller
 */

import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { stripeClient } from "../lib/stripe.js";
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
 * Roles that can view the full payments ledger.
 */
const LEDGER_ROLES = [
  "SUPER_ADMIN",
  "PRINCIPAL",
  "VICE_PRINCIPAL",
  "ACCOUNTANT",
];

/**
 * Generates the next invoice number for an academic year.
 * Format: INV-{firstYear}-{seq} e.g. "INV-2026-0001"
 */
const nextInvoiceNumber = async (academicYearId: string): Promise<string> => {
  const year = await prisma.academicYear.findUnique({
    where: { id: academicYearId },
    select: { name: true },
  });
  const firstYear = year?.name.match(/(\d{4})/)?.[1] ?? new Date().getFullYear().toString();
  const count = await prisma.invoice.count({ where: { academicYearId } });
  return `INV-${firstYear}-${String(count + 1).padStart(4, "0")}`;
};

/**
 * Resolves the student profile(s) the authenticated user may pay for:
 *   - STUDENT  → their own profile
 *   - PARENT   → profiles linked via StudentGuardian
 *   - admins   → any profile (must pass studentProfileId explicitly)
 */
const resolveEligibleStudents = async (
  user: { id: string; role?: string | null },
  requestedStudentId?: string,
): Promise<{ id: string }[]> => {
  const role = user.role ?? "";
  if (role === "STUDENT") {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    return profile ? [profile] : [];
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
    const ids = links.map((l) => l.studentId);
    if (requestedStudentId && ids.includes(requestedStudentId)) {
      return [{ id: requestedStudentId }];
    }
    return ids.map((id) => ({ id }));
  }

  // Admin/accountant — explicit student required
  if (requestedStudentId) return [{ id: requestedStudentId }];
  return [];
};

/**
 * Returns (or lazily creates) the Stripe customer for a user.
 * createCustomerOnSignUp covers new signups; existing users get one here.
 */
const ensureStripeCustomer = async (
  userId: string,
  name: string,
  email: string,
): Promise<string> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (user?.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripeClient.customers.create({
    name,
    email,
    metadata: { userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
};

// ─── Controller Functions ─────────────────────────────────────────────────────

/**
 * GET /api/payments/my
 *
 * Returns the fee bills visible to the current user:
 *   - STUDENT → their own grade's fee structures with payment status
 *   - PARENT  → fee bills for every linked child
 *   - admins  → bills for an explicit ?studentProfileId (used by the ledger)
 *
 * Response shape:
 *   { data: { students: [{ studentProfileId, studentName, admissionNumber,
 *              grade, bills: [{ feeStructureId, term, amount, paidAmount,
 *              status, payments: [...] }] }] } }
 */
export const getMyPayments = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const studentProfileId = asStr(req.query.studentProfileId);

    const students = await resolveEligibleStudents(user, studentProfileId);
    if (students.length === 0) {
      return res.json({ data: { students: [] } });
    }

    // Load full student profiles with grade + user info
    const profiles = await prisma.studentProfile.findMany({
      where: { id: { in: students.map((s) => s.id) } },
      include: {
        user: { select: { name: true } },
        grade: { select: { id: true, name: true, section: true } },
        academicYear: { select: { id: true, name: true } },
      },
      orderBy: { admissionNumber: "asc" },
    });

    const result = await Promise.all(
      profiles.map(async (profile) => {
        // Fee structures for this student's grade (all terms of their year)
        const feeStructures = await prisma.feeStructure.findMany({
          where: {
            gradeId: profile.gradeId,
            term: { academicYearId: profile.academicYearId },
          },
          include: {
            term: { select: { id: true, name: true, startDate: true } },
          },
          orderBy: { term: { startDate: "asc" } },
        });

        const invoices = await prisma.invoice.findMany({
          where: { studentId: profile.id },
          select: {
            id: true,
            status: true,
            payments: {
              select: {
                id: true,
                amount: true,
                paymentDate: true,
                paymentMethod: true,
                referenceNumber: true,
                feeStructureId: true,
              },
              orderBy: { paymentDate: "desc" },
            },
          },
        });

        const bills = feeStructures.map((fee) => {
          // Payments are attributed per fee via Payment.feeStructureId
          const feePayments = invoices.flatMap((inv) =>
            inv.payments.filter((p) => p.feeStructureId === fee.id),
          );
          const paidTotal = feePayments.reduce(
            (sum, p) => sum + Number(p.amount),
            0,
          );

          const amount = Number(fee.amount);
          const status =
            paidTotal <= 0
              ? "UNPAID"
              : paidTotal >= amount
                ? "PAID"
                : "PARTIALLY_PAID";

          return {
            feeStructureId: fee.id,
            term: fee.term.name,
            termId: fee.term.id,
            amount: fee.amount,
            paidAmount: String(paidTotal),
            status,
            payments: feePayments.map(
              ({ feeStructureId: _fs, ...payment }) => payment,
            ),
          };
        });

        return {
          studentProfileId: profile.id,
          studentName: profile.user.name,
          admissionNumber: profile.admissionNumber,
          academicYear: profile.academicYear.name,
          grade: profile.grade,
          bills,
        };
      }),
    );

    return res.json({ data: { students: result } });
  } catch (error) {
    console.error("[Payments] My payments error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve payments.",
      },
    });
  }
};

/**
 * POST /api/payments/checkout
 *
 * Creates a Stripe Checkout session for a school-fee payment.
 *
 * Body:
 *   feeStructureId     (string, required) — the fee being paid
 *   studentProfileId   (string, optional) — required when paying for another
 *                                           student (parent/admin)
 *
 * Response:
 *   { data: { url } } — redirect the browser here to complete payment.
 */
export const createCheckout = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { feeStructureId, studentProfileId } = req.body;

    // ── Validate fee structure ─────────────────────────────────────────
    if (!feeStructureId || typeof feeStructureId !== "string") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "feeStructureId is required and must be a string.",
        },
      });
    }

    const fee = await prisma.feeStructure.findUnique({
      where: { id: feeStructureId },
      include: {
        grade: { select: { id: true, name: true, section: true } },
        term: {
          select: { id: true, name: true, academicYearId: true },
        },
      },
    });

    if (!fee) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Fee structure not found." },
      });
    }

    // ── Resolve the student being billed ───────────────────────────────
    const eligible = await resolveEligibleStudents(user, studentProfileId);
    if (eligible.length === 0) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You are not allowed to pay fees for this student.",
        },
      });
    }

    const targetStudentId =
      (user.role ?? "") === "STUDENT"
        ? eligible[0]!.id
        : (studentProfileId as string);
    if (!targetStudentId) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "studentProfileId is required.",
        },
      });
    }

    const student = await prisma.studentProfile.findUnique({
      where: { id: targetStudentId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        academicYear: { select: { id: true, name: true } },
      },
    });

    if (!student) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Student profile not found." },
      });
    }

    // The fee must belong to the student's grade
    if (fee.gradeId !== student.gradeId) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "This fee does not apply to the selected student's grade.",
        },
      });
    }

    // ── Ensure an invoice + item exist for this fee ────────────────────
    let invoice = await prisma.invoice.findFirst({
      where: {
        studentId: student.id,
        academicYearId: fee.term.academicYearId,
      },
    });

    if (!invoice) {
      invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: await nextInvoiceNumber(fee.term.academicYearId),
          studentId: student.id,
          academicYearId: fee.term.academicYearId,
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
          status: "UNPAID",
        },
      });
    }

    let item = await prisma.invoiceItem.findUnique({
      where: {
        invoiceId_feeStructureId: {
          invoiceId: invoice.id,
          feeStructureId: fee.id,
        },
      },
    });

    if (!item) {
      item = await prisma.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          feeStructureId: fee.id,
          amount: fee.amount,
        },
      });
    }

    // ── Compute the remaining amount (charge only what's still due) ────
    const paid = await prisma.payment.aggregate({
      where: { invoiceId: invoice.id, feeStructureId: fee.id },
      _sum: { amount: true },
    });
    const paidAmount = Number(paid._sum.amount ?? 0);
    const amount = Number(fee.amount);
    const remaining = amount - paidAmount;
    if (remaining <= 0) {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "This fee has already been paid in full.",
        },
      });
    }

    // ── Ensure the payer has a Stripe customer ─────────────────────────
    const customerId = await ensureStripeCustomer(
      user.id,
      user.name ?? "Student",
      user.email ?? "",
    );

    // ── Create the Checkout session ────────────────────────────────────
    const session = await stripeClient.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(remaining * 100), // cents
            product_data: {
              name: `School Fees — ${fee.grade.name} ${fee.grade.section}`,
              description: `${fee.term.name} (${student.academicYear.name})`,
              metadata: { feeStructureId: fee.id },
            },
          },
        },
      ],
      metadata: {
        invoiceId: invoice.id,
        invoiceItemId: item.id,
        feeStructureId: fee.id,
        studentProfileId: student.id,
        userId: user.id,
      },
      success_url: `${process.env.CLIENT_URL}/dashboard/payments?status=success`,
      cancel_url: `${process.env.CLIENT_URL}/dashboard/payments?status=cancelled`,
    });

    if (!session.url) {
      return res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Stripe did not return a checkout URL.",
        },
      });
    }

    // ── Audit log (fire-and-forget — don't block the checkout response) ─
    logActivityAsync({
      userId: user.id,
      activity: "payment:checkout-initiated",
      details: `Initiated Stripe checkout for "${student.user.name}" — ${fee.term.name} ($${amount.toFixed(2)})`,
    });

    return res.json({ data: { url: session.url } });
  } catch (error: any) {
    // Surface Stripe API errors with a friendly message
    if (error?.type?.startsWith("Stripe")) {
      console.error("[Payments] Stripe error:", error.message);
      return res.status(502).json({
        error: {
          code: "STRIPE_ERROR",
          message: error.message ?? "Stripe payment could not be initiated.",
        },
      });
    }

    console.error("[Payments] Checkout error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to initiate payment.",
      },
    });
  }
};

/**
 * GET /api/payments
 *
 * Full payments ledger for management roles. Optionally filtered:
 *   ?studentProfileId=<id> — payments for one student
 *   ?limit=<n>             — max rows (default 100)
 *
 * Access: SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, ACCOUNTANT
 */
export const listPayments = async (req: Request, res: Response) => {
  try {
    const studentProfileId = asStr(req.query.studentProfileId);
    const limit = Math.min(Number(asStr(req.query.limit) ?? 100) || 100, 500);

    const where: Record<string, unknown> = {};
    if (studentProfileId) where.invoice = { studentId: studentProfileId };

    const payments = await prisma.payment.findMany({
      where,
      include: {
        invoice: {
          include: {
            student: {
              include: {
                user: { select: { name: true } },
                grade: { select: { name: true, section: true } },
              },
            },
          },
        },
        feeStructure: {
          include: { term: { select: { name: true } } },
        },
        recordedBy: { select: { name: true } },
      },
      orderBy: { paymentDate: "desc" },
      take: limit,
    });

    return res.json({ data: payments });
  } catch (error) {
    console.error("[Payments] List error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve payments.",
      },
    });
  }
};
