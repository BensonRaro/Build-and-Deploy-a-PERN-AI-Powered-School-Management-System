/**
 * Finance Analytics Controller
 *
 * Whole-school financial summary for management. Computes billed vs. collected
 * totals, outstanding balance, collection rate, and breakdowns by academic
 * term, grade, and payment method — plus a 12-month collection trend and the
 * most recent payments.
 *
 * All aggregation is done in JS over a few bounded queries (invoice items +
 * payments), which is appropriate for school-scale data volumes.
 *
 * @module finance/controller
 */

import type { Request, Response } from "express";
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

/** Formats a Date as "YYYY-MM" for monthly grouping. */
const monthKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Builds a zero-filled series for the last N months (oldest → newest). */
const lastMonths = (count: number): { key: string; label: string }[] => {
  const months: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: monthKey(d),
      label: d.toLocaleString("en-US", { month: "short", year: "2-digit" }),
    });
  }
  return months;
};

// ─── Controller ──────────────────────────────────────────────────────────────

/**
 * GET /api/finance/analytics
 *
 * Returns the whole-school financial summary.
 *
 * Query params:
 *   ?academicYearId=<id> — scope the summary to one academic year
 *
 * Access: SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, ACCOUNTANT
 */
export const getFinanceAnalytics = async (req: Request, res: Response) => {
  try {
    const academicYearId = asStr(req.query.academicYearId);

    // ── Invoice items = money billed ────────────────────────────────────
    // Canceled invoices are excluded from billed totals.
    const items = await prisma.invoiceItem.findMany({
      where: academicYearId
        ? { invoice: { academicYearId, status: { not: "CANCELLED" } } }
        : { invoice: { status: { not: "CANCELLED" } } },
      select: {
        amount: true,
        invoice: { select: { studentId: true, status: true } },
        feeStructure: {
          select: {
            term: { select: { id: true, name: true, academicYearId: true } },
            grade: {
              select: { id: true, name: true, section: true },
            },
          },
        },
      },
    });

    // ── Payments = money collected ──────────────────────────────────────
    const payments = await prisma.payment.findMany({
      where: academicYearId
        ? { invoice: { academicYearId } }
        : undefined,
      select: {
        id: true,
        amount: true,
        paymentDate: true,
        paymentMethod: true,
        feeStructure: {
          select: {
            term: { select: { id: true, name: true, academicYearId: true } },
            grade: { select: { id: true, name: true, section: true } },
          },
        },
        invoice: {
          select: {
            student: {
              select: {
                user: { select: { name: true } },
                grade: { select: { name: true, section: true } },
              },
            },
          },
        },
      },
      orderBy: { paymentDate: "desc" },
    });

    // ── Totals ───────────────────────────────────────────────────────────
    const totalBilled = round2(items.reduce((sum, i) => sum + toNum(i.amount), 0));
    const totalCollected = round2(
      payments.reduce((sum, p) => sum + toNum(p.amount), 0),
    );
    const totalOutstanding = round2(totalBilled - totalCollected);
    const collectionRate =
      totalBilled > 0 ? round2((totalCollected / totalBilled) * 100) : 0;

    const studentIds = new Set(items.map((i) => i.invoice.studentId));
    const invoiceStatuses = new Map<
      string,
      { status: string; count: number; amount: number }
    >();
    for (const item of items) {
      const entry =
        invoiceStatuses.get(item.invoice.status) ??
        { status: item.invoice.status, count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += toNum(item.amount);
      invoiceStatuses.set(item.invoice.status, entry);
    }

    // ── By term ─────────────────────────────────────────────────────────
    const byTermMap = new Map<
      string,
      { termId: string; termName: string; billed: number; collected: number }
    >();
    for (const item of items) {
      const t = item.feeStructure?.term;
      if (!t) continue;
      const entry =
        byTermMap.get(t.id) ??
        { termId: t.id, termName: t.name, billed: 0, collected: 0 };
      entry.billed += toNum(item.amount);
      byTermMap.set(t.id, entry);
    }
    for (const p of payments) {
      const t = p.feeStructure?.term;
      if (!t) continue;
      const entry =
        byTermMap.get(t.id) ??
        { termId: t.id, termName: t.name, billed: 0, collected: 0 };
      entry.collected += toNum(p.amount);
      byTermMap.set(t.id, entry);
    }
    const byTerm = [...byTermMap.values()]
      .map((t) => ({
        ...t,
        billed: round2(t.billed),
        collected: round2(t.collected),
        outstanding: round2(t.billed - t.collected),
        rate:
          t.billed > 0 ? round2((t.collected / t.billed) * 100) : 0,
      }))
      .sort((a, b) => b.billed - a.billed);

    // ── By grade ────────────────────────────────────────────────────────
    const byGradeMap = new Map<
      string,
      {
        gradeId: string;
        gradeName: string;
        section: string;
        billed: number;
        collected: number;
      }
    >();
    for (const item of items) {
      const g = item.feeStructure?.grade;
      if (!g) continue;
      const entry =
        byGradeMap.get(g.id) ??
        { gradeId: g.id, gradeName: g.name, section: g.section, billed: 0, collected: 0 };
      entry.billed += toNum(item.amount);
      byGradeMap.set(g.id, entry);
    }
    for (const p of payments) {
      const g = p.feeStructure?.grade;
      if (!g) continue;
      const entry =
        byGradeMap.get(g.id) ??
        { gradeId: g.id, gradeName: g.name, section: g.section, billed: 0, collected: 0 };
      entry.collected += toNum(p.amount);
      byGradeMap.set(g.id, entry);
    }
    const byGrade = [...byGradeMap.values()]
      .map((g) => ({
        ...g,
        billed: round2(g.billed),
        collected: round2(g.collected),
        outstanding: round2(g.billed - g.collected),
        rate: g.billed > 0 ? round2((g.collected / g.billed) * 100) : 0,
      }))
      .sort((a, b) => b.billed - a.billed);

    // ── By payment method ───────────────────────────────────────────────
    const byMethodMap = new Map<
      string,
      { method: string; count: number; amount: number }
    >();
    for (const p of payments) {
      const entry =
        byMethodMap.get(p.paymentMethod) ??
        { method: p.paymentMethod, count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += toNum(p.amount);
      byMethodMap.set(p.paymentMethod, entry);
    }
    const byMethod = [...byMethodMap.values()]
      .map((m) => ({ ...m, amount: round2(m.amount) }))
      .sort((a, b) => b.amount - a.amount);

    // ── 12-month collection trend (zero-filled) ─────────────────────────
    const months = lastMonths(12);
    const monthlyMap = new Map<string, number>();
    for (const p of payments) {
      const key = monthKey(new Date(p.paymentDate));
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + toNum(p.amount));
    }
    const monthly = months.map((m) => ({
      month: m.key,
      label: m.label,
      collected: round2(monthlyMap.get(m.key) ?? 0),
    }));

    // ── Recent payments (top 10) ────────────────────────────────────────
    const recentPayments = payments.slice(0, 10).map((p) => ({
      id: p.id,
      amount: String(toNum(p.amount)),
      paymentDate: p.paymentDate,
      paymentMethod: p.paymentMethod,
      studentName: p.invoice?.student?.user?.name ?? "Unknown",
      grade: p.invoice?.student?.grade
        ? `${p.invoice.student.grade.name} - ${p.invoice.student.grade.section}`
        : p.feeStructure?.grade
          ? `${p.feeStructure.grade.name} - ${p.feeStructure.grade.section}`
          : "—",
      term: p.feeStructure?.term?.name ?? "—",
    }));

    return res.json({
      data: {
        summary: {
          totalBilled: String(totalBilled),
          totalCollected: String(totalCollected),
          totalOutstanding: String(totalOutstanding),
          collectionRate,
          itemCount: items.length,
          studentCount: studentIds.size,
          paymentCount: payments.length,
        },
        invoiceStatuses: [...invoiceStatuses.values()].sort((a, b) =>
          a.status.localeCompare(b.status),
        ),
        byTerm,
        byGrade,
        byMethod,
        monthly,
        recentPayments,
      },
    });
  } catch (error) {
    console.error("[Finance] Analytics error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to compute finance analytics.",
      },
    });
  }
};
