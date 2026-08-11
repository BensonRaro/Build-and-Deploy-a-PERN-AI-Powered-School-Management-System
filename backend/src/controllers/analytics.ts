/**
 * School Analytics Controller
 *
 * Whole-school overview for management roles — the data backing the
 * management dashboard. Aggregates people counts, finance totals,
 * assignment activity, timetable readiness, enrollment per grade, and
 * recent audit activity.
 *
 * All aggregation is done in JS over a few bounded queries, which is
 * appropriate for school-scale data volumes.
 *
 * @module analytics/controller
 */

import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Converts a Prisma Decimal (or string/number) to a JS number. */
const toNum = (value: unknown): number => Number(value ?? 0) || 0;

/** Rounds to 2 decimal places. */
const round2 = (n: number): number => Math.round(n * 100) / 100;

// ─── Controller ──────────────────────────────────────────────────────────────

/**
 * GET /api/analytics/overview
 *
 * Returns the whole-school analytics summary for the management dashboard.
 *
 * Access: SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, ACCOUNTANT
 */
export const getSchoolAnalytics = async (req: Request, res: Response) => {
  try {
    // ── Load every independent aggregate in parallel ───────────────────
    // Each query is an independent database round-trip; batching them into
    // a single Promise.all collapses ~12 sequential round-trips into one
    // (wall time ≈ the slowest query instead of their sum).
    const [
      currentYear,
      userRoleCounts,
      students,
      parents,
      grades,
      subjects,
      items,
      paymentAgg,
      invoiceCount,
      assignmentByStatus,
      pendingGrading,
      timetableRows,
      gradeEnrollments,
      recentActivity,
    ] = await Promise.all([
      // ── Current academic year + term ───────────────────────────────
      prisma.academicYear.findFirst({
        where: { isCurrent: true },
        select: {
          id: true,
          name: true,
          terms: {
            where: { isCurrent: true },
            take: 1,
            select: { id: true, name: true },
          },
        },
      }),
      // ── People counts ──────────────────────────────────────────────
      prisma.user.groupBy({
        by: ["role"],
        _count: { _all: true },
      }),
      prisma.studentProfile.count({ where: { active: true } }),
      prisma.parentProfile.count(),
      prisma.grade.count(),
      prisma.subject.count(),
      // ── Finance (whole school) ─────────────────────────────────────
      prisma.invoiceItem.findMany({
        where: { invoice: { status: { not: "CANCELLED" } } },
        select: { amount: true },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        _count: true,
      }),
      prisma.invoice.count(),
      // ── Assignments ────────────────────────────────────────────────
      prisma.assignment.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.assignmentSubmission.count({
        where: { status: "SUBMITTED" },
      }),
      // ── Timetable readiness ────────────────────────────────────────
      prisma.timetableSlot.findMany({
        select: { gradeId: true },
        distinct: ["gradeId"],
      }),
      // ── Enrollment by grade (active students only) ─────────────────
      prisma.grade.findMany({
        select: {
          id: true,
          name: true,
          section: true,
          _count: { select: { students: { where: { active: true } } } },
        },
        orderBy: [{ name: "asc" }],
      }),
      // ── Recent activity (top 6) ────────────────────────────────────
      prisma.activityLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { user: { select: { name: true } } },
      }),
    ]);

    // ── Derive values from the batch ────────────────────────────────────
    const countOf = (role: string) =>
      userRoleCounts.find((r) => r.role === role)?._count._all ?? 0;

    const billed = round2(items.reduce((sum, i) => sum + toNum(i.amount), 0));
    const collected = round2(toNum(paymentAgg._sum.amount));
    const outstanding = round2(Math.max(billed - collected, 0));
    const collectionRate = billed > 0 ? round2((collected / billed) * 100) : 0;

    // ── Assignments ────────────────────────────────────────────────────
    const assignmentTotal = assignmentByStatus.reduce(
      (sum, r) => sum + r._count._all,
      0,
    );
    const publishedAssignments =
      assignmentByStatus.find((r) => r.status === "PUBLISHED")?._count._all ??
      0;

    // ── Timetable readiness ─────────────────────────────────────────────
    const gradesWithTimetable = timetableRows.length;

    return res.json({
      data: {
        summary: {
          students,
          teachers: countOf("TEACHER"),
          staff: countOf("STAFF"),
          parents,
          grades,
          subjects,
          currentYear: currentYear
            ? { id: currentYear.id, name: currentYear.name }
            : null,
          currentTerm: currentYear?.terms[0]?.name ?? null,
        },
        finance: {
          billed: String(billed),
          collected: String(collected),
          outstanding: String(outstanding),
          collectionRate,
          invoiceCount,
          paymentCount: paymentAgg._count,
        },
        assignments: {
          total: assignmentTotal,
          published: publishedAssignments,
          pendingGrading,
        },
        timetable: {
          totalGrades: grades,
          gradesWithTimetable,
          gradesWithoutTimetable: Math.max(grades - gradesWithTimetable, 0),
        },
        enrollmentByGrade: gradeEnrollments.map((g) => ({
          gradeId: g.id,
          name: g.name,
          section: g.section,
          students: g._count.students,
        })),
        recentActivity: recentActivity.map((log) => ({
          id: log.id,
          activity: log.activity,
          details: log.details,
          createdAt: log.createdAt,
          userName: log.user.name,
        })),
      },
    });
  } catch (error) {
    console.error("[Analytics] Overview error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to compute school analytics.",
      },
    });
  }
};
