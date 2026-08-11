/**
 * student-dashboard — Personalized dashboard for STUDENT roles.
 *
 * Shows the student's grade timetable, upcoming assignments (published, their
 * grade), and fee-bill status. Data comes from GET /api/timetable/my, the
 * role-aware assignments list, and the payments "my bills" endpoint.
 *
 * Design ("Aura v2" — indigo/emerald theme).
 */

import { useMemo } from "react";
import { Link } from "react-router";
import {
  CalendarClockIcon,
  GraduationCapIcon,
  BookOpenIcon,
  ClockIcon,
  SparklesIcon,
  ArrowRightIcon,
  WalletIcon,
  ReceiptTextIcon,
  CheckCircle2Icon,
  CalendarDaysIcon,
  LockIcon,
  FileTextIcon,
  RefreshCwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/globals/loader";
import { TimetableGrid } from "@/components/dashboard/timetable-grid";
import { StatCard } from "@/components/dashboard/stat-card";
import { useMyTimetable } from "@/lib/hooks/use-timetable";
import { useAssignments } from "@/lib/hooks/use-assignments";
import { useMyPayments, type FeeBill } from "@/lib/hooks/use-payments";
import { authClient } from "@/lib/auth-client";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Period duration used for the weekly-hours stat */
const PERIOD_DURATION = 40;

/** Fee bill status badge */
function FeeStatusBadge({ status }: { status: FeeBill["status"] }) {
  const config = {
    PAID: {
      label: "Paid",
      className:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      dot: "bg-emerald-500",
    },
    PARTIALLY_PAID: {
      label: "Partially Paid",
      className:
        "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      dot: "bg-amber-500",
    },
    UNPAID: {
      label: "Unpaid",
      className:
        "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
      dot: "bg-rose-500",
    },
  }[status];

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 border font-medium normal-case tracking-normal",
        config.className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", config.dot)} />
      {config.label}
    </Badge>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────

export function StudentDashboard() {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const firstName = user?.name?.split(" ")[0] ?? "Student";

  const {
    data: my,
    isLoading,
    isError,
    refetch,
  } = useMyTimetable();
  const { data: assignments } = useAssignments();
  const { data: myPayments } = useMyPayments();

  const grade = my?.grade;
  const myBills = useMemo(
    () => (myPayments?.students ?? []).flatMap((s) => s.bills),
    [myPayments],
  );

  // Upcoming assignments — due soonest first, cap at 4
  const upcomingAssignments = useMemo(
    () =>
      (assignments ?? [])
        .filter((a) => a.status === "PUBLISHED")
        .sort((a, b) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        })
        .slice(0, 4),
    [assignments],
  );

  const stats = useMemo(() => {
    const slots = my?.slots ?? [];
    const totalDue = myBills.reduce((sum, b) => {
      return sum + Math.max(Number(b.amount) - Number(b.paidAmount), 0);
    }, 0);
    return {
      lessons: slots.length,
      subjects: new Set(slots.map((s) => s.subjectName)).size,
      weeklyHours: slots.length * PERIOD_DURATION,
      outstandingFees: totalDue,
      unpaidCount: myBills.filter((b) => b.status !== "PAID").length,
    };
  }, [my, myBills]);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* ═══════════════════════════════════════════════════════════════════
           HERO BANNER
           ═══════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-br from-indigo-500/[0.05] via-background to-background p-6 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 size-60 rounded-full bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent blur-3xl animate-[blob_8s_ease-in-out_infinite]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 size-48 rounded-full bg-gradient-to-tr from-emerald-500/5 via-emerald-500/[0.02] to-transparent blur-3xl animate-[blob_10s_ease-in-out_infinite_2s]"
        />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
              <GraduationCapIcon className="size-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Welcome back, {firstName}
              </h1>
              <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground/70">
                Your class schedule, assignments, and fees — all in one place.
              </p>
              {grade && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/15 bg-indigo-500/[0.04] px-3 py-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                    <GraduationCapIcon className="size-3.5" />
                    {grade.name} - {grade.section}
                  </span>
                  {grade.roomNumber && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/15 bg-background/50 px-3 py-1 text-[11px] font-medium text-muted-foreground/70">
                      <CalendarDaysIcon className="size-3.5" />
                      Room {grade.roomNumber}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <Link to="/dashboard/timetable">
            <Button
              variant="outline"
              size="sm"
              className="border-indigo-500/20 text-indigo-600 hover:bg-indigo-500/10 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-400"
            >
              Full Timetable
              <ArrowRightIcon className="ml-1 size-3.5" />
            </Button>
          </Link>
        </div>

        {/* ── Stat cards ─────────────────────────────────────────────── */}
        {!isLoading && my && (
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={CalendarClockIcon}
              label="Weekly Lessons"
              value={stats.lessons}
              gradient="bg-gradient-to-br from-indigo-500 to-indigo-600"
            />
            <StatCard
              icon={FileTextIcon}
              label="Assignments"
              value={upcomingAssignments.length}
              gradient="bg-gradient-to-br from-violet-500 to-violet-600"
            />
            <StatCard
              icon={WalletIcon}
              label="Outstanding Fees"
              value={formatCurrency(stats.outstandingFees)}
              gradient="bg-gradient-to-br from-rose-500 to-rose-600"
            />
            <StatCard
              icon={BookOpenIcon}
              label="Subjects"
              value={stats.subjects}
              gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           MY TIMETABLE
           ═══════════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
              <CalendarClockIcon className="size-4" />
            </span>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              My Timetable
            </h2>
          </div>
          <span className="text-[11px] text-muted-foreground/40">
            {grade
              ? `${grade.name} - ${grade.section} · ${stats.lessons} lessons`
              : ""}
          </span>
        </div>

        {isLoading ? (
          <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-border/30 bg-gradient-to-b from-background/80 to-background/40 backdrop-blur-sm">
            <Loader variant="page" size="md" text="Loading your timetable…" />
          </div>
        ) : isError ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-2xl border border-destructive/15 bg-destructive/[0.03] p-8 text-center">
            <RefreshCwIcon className="size-10 text-destructive/50" />
            <p className="text-sm font-medium text-destructive">
              Failed to load your timetable.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try Again
            </Button>
          </div>
        ) : (my?.slots?.length ?? 0) === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/25 p-10 text-center">
            <CalendarClockIcon className="size-12 text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground/80">
              No timetable yet
            </p>
            <p className="max-w-sm text-xs text-muted-foreground/50">
              Your class timetable will appear here once the school generates
              it.
            </p>
          </div>
        ) : (
          <TimetableGrid slots={my!.slots} />
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
           UPCOMING ASSIGNMENTS + FEE STATUS
           ═══════════════════════════════════════════════════════════════ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Upcoming assignments ──────────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-b from-background/80 to-background/40 shadow-sm shadow-black/[0.02] backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-border/10 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-sm">
                <SparklesIcon className="size-4" />
              </span>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Upcoming Assignments
              </h2>
            </div>
            <Link to="/dashboard/assignments">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground/50 hover:text-violet-600"
              >
                View all <ArrowRightIcon className="ml-0.5 size-3" />
              </Button>
            </Link>
          </div>

          <div className="p-4">
            {upcomingAssignments.length === 0 ? (
              <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 text-center">
                <FileTextIcon className="size-8 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground/60">
                  No published assignments right now.
                </p>
                <p className="text-xs text-muted-foreground/40">
                  New assignments from your teachers will show up here.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {upcomingAssignments.map((assignment) => {
                  const isDueSoon =
                    assignment.dueDate &&
                    new Date(assignment.dueDate).getTime() -
                      Date.now() <
                      3 * 24 * 60 * 60 * 1000 &&
                    new Date(assignment.dueDate).getTime() - Date.now() > 0;
                  return (
                    <li
                      key={assignment.id}
                      className="group flex items-center gap-3 rounded-xl border border-border/15 bg-background/50 p-3.5 transition-all duration-200 hover:border-violet-500/20 hover:bg-violet-500/[0.02]"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/15 to-violet-500/5 text-violet-600 shadow-sm ring-1 ring-violet-500/10 dark:text-violet-400">
                        <BookOpenIcon className="size-4.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {assignment.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground/50">
                          {assignment.subject?.name ?? "General"}
                          {assignment.dueDate
                            ? ` · Due ${formatDate(assignment.dueDate)}`
                            : ""}
                        </p>
                      </div>
                      {isDueSoon && (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-amber-500/20 bg-amber-500/10 text-amber-600 font-medium normal-case tracking-normal dark:text-amber-400"
                        >
                          Due soon
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* ── Fee status ────────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-b from-background/80 to-background/40 shadow-sm shadow-black/[0.02] backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-border/10 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm">
                <ReceiptTextIcon className="size-4" />
              </span>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Fee Status
              </h2>
            </div>
            <Link to="/dashboard/payments">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground/50 hover:text-emerald-600"
              >
                Payments <ArrowRightIcon className="ml-0.5 size-3" />
              </Button>
            </Link>
          </div>

          <div className="p-4">
            {myBills.length === 0 ? (
              <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 text-center">
                <ReceiptTextIcon className="size-8 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground/60">
                  No fee bills yet.
                </p>
                <p className="text-xs text-muted-foreground/40">
                  Fee structures configured for your grade will appear here.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {myBills.map((bill) => {
                  const remaining = Math.max(
                    Number(bill.amount) - Number(bill.paidAmount),
                    0,
                  );
                  const isPaid = bill.status === "PAID";
                  return (
                    <li
                      key={bill.feeStructureId}
                      className="group flex items-center gap-3 rounded-xl border border-border/15 bg-background/50 p-3.5 transition-all duration-200 hover:border-emerald-500/20 hover:bg-emerald-500/[0.02]"
                    >
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/[0.02]",
                          isPaid
                            ? "bg-gradient-to-br from-emerald-500 to-emerald-600"
                            : "bg-gradient-to-br from-indigo-500 to-indigo-600",
                        )}
                      >
                        {isPaid ? (
                          <CheckCircle2Icon className="size-4.5 text-white" />
                        ) : (
                          <ReceiptTextIcon className="size-4.5 text-white" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {bill.term}
                          </p>
                          <FeeStatusBadge status={bill.status} />
                        </div>
                        <p className="text-[11px] text-muted-foreground/50">
                          {isPaid
                            ? "Fully settled"
                            : `${formatCurrency(remaining)} remaining of ${formatCurrency(bill.amount)}`}
                        </p>
                      </div>
                      {isPaid ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          <LockIcon className="size-3.5" />
                          Settled
                        </span>
                      ) : (
                        <Link to="/dashboard/payments" className="shrink-0">
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/30"
                          >
                            Pay
                            <ArrowRightIcon className="ml-1 size-3.5" />
                          </Button>
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
