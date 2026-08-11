/**
 * school-analytics — Whole-school analytics dashboard.
 *
 * Shown to SUPER_ADMIN / PRINCIPAL / VICE_PRINCIPAL / ACCOUNTANT on the
 * dashboard home. Aggregates people counts, finance totals, assignment
 * activity, timetable readiness, enrollment per grade, and recent audit
 * activity — all from GET /api/analytics/overview.
 *
 * Design ("Aura v2" — indigo/violet analytics theme).
 */

import { useMemo } from "react";
import { Link } from "react-router";
import {
  UsersIcon,
  GraduationCapIcon,
  UsersRoundIcon,
  BuildingIcon,
  BookOpenIcon,
  ReceiptTextIcon,
  CreditCardIcon,
  WalletIcon,
  TrendingUpIcon,
  ClipboardCheckIcon,
  CalendarClockIcon,
  ActivityIcon,
  CalendarDaysIcon,
  SparklesIcon,
  ArrowUpRightIcon,
  PieChartIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/globals/loader";
import { StatCard } from "@/components/dashboard/stat-card";
import { useSchoolAnalytics } from "@/lib/hooks/use-school-analytics";
import { cn, formatCurrency } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Relative time, e.g. "2h ago" */
const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

/** Label an activity enum for display */
const activityLabel = (activity: string) =>
  activity.replace(/[:_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Section wrapper with a heading */
function Section({
  title,
  icon: Icon,
  accent,
  children,
  action,
}: {
  title: string;
  icon: React.ElementType;
  accent: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-b from-background/80 to-background/40 shadow-sm shadow-black/[0.02] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border/10 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-lg text-white shadow-sm",
              accent,
            )}
          >
            <Icon className="size-4" />
          </span>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h2>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Mini stat (finance) ────────────────────────────────────────────────────

function MiniStat({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  tone: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl border border-border/10 bg-background/50 px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/40">
        <Icon className="size-3" />
        {label}
      </div>
      <p className={cn("mt-1 text-lg font-bold tabular-nums tracking-tight", tone)}>
        {value}
      </p>
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────

export function SchoolAnalyticsDashboard() {
  const { data, isLoading, isError, refetch } = useSchoolAnalytics();

  const finance = data?.finance;
  const assignments = data?.assignments;
  const timetable = data?.timetable;

  // Enrollment bars normalized to the largest class
  const maxEnrollment = useMemo(
    () =>
      Math.max(
        1,
        ...(data?.enrollmentByGrade ?? []).map((g) => g.students),
      ),
    [data],
  );

  // ── Loading ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-border/30 bg-gradient-to-b from-background/80 to-background/40 backdrop-blur-sm">
        <Loader variant="page" size="md" text="Loading school analytics…" />
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (isError || !data) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-5 rounded-2xl border border-destructive/15 bg-gradient-to-b from-destructive/[0.03] to-transparent p-8">
        <AlertTriangleIcon className="size-12 text-destructive/50" />
        <div className="text-center">
          <p className="text-sm font-medium text-destructive">
            Failed to load school analytics.
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Please try again or contact support.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          Try Again
        </Button>
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
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
          className="pointer-events-none absolute -bottom-20 -right-20 size-48 rounded-full bg-gradient-to-tr from-violet-500/5 via-violet-500/[0.02] to-transparent blur-3xl animate-[blob_10s_ease-in-out_infinite_2s]"
        />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
              <PieChartIcon className="size-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                School Analytics
              </h1>
              <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground/70">
                A live overview of the whole school — people, finances,
                attendance, academics, and timetables.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/15 bg-indigo-500/[0.04] px-3 py-1.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
              <CalendarDaysIcon className="size-3.5" />
              {summary.currentYear?.name ?? "No academic year set"}
              {summary.currentTerm ? ` · ${summary.currentTerm}` : ""}
            </span>
            <Link to="/dashboard/finance-analytics">
              <Button
                variant="outline"
                size="sm"
                className="border-indigo-500/20 text-indigo-600 hover:bg-indigo-500/10 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-400"
              >
                Finance Analytics
                <ArrowUpRightIcon className="ml-1 size-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* ── People stat cards ───────────────────────────────────────── */}
        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={UsersIcon}
            label="Students"
            value={summary.students}
            gradient="bg-gradient-to-br from-indigo-500 to-indigo-600"
          />
          <StatCard
            icon={GraduationCapIcon}
            label="Teachers"
            value={summary.teachers}
            gradient="bg-gradient-to-br from-violet-500 to-violet-600"
          />
          <StatCard
            icon={UsersRoundIcon}
            label="Parents"
            value={summary.parents}
            gradient="bg-gradient-to-br from-fuchsia-500 to-fuchsia-600"
          />
          <StatCard
            icon={BuildingIcon}
            label="Staff"
            value={summary.staff}
            gradient="bg-gradient-to-br from-blue-500 to-blue-600"
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           ROW: Finance + Assignments
           ═══════════════════════════════════════════════════════════════ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Finance ────────────────────────────────────────────────── */}
        <Section
          title="Finance"
          icon={WalletIcon}
          accent="bg-gradient-to-br from-emerald-500 to-emerald-600"
          action={
            <Link to="/dashboard/finance-analytics">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground/50 hover:text-emerald-600"
              >
                Details <ArrowUpRightIcon className="ml-0.5 size-3" />
              </Button>
            </Link>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat
                label="Billed"
                value={formatCurrency(finance?.billed ?? 0)}
                tone="text-foreground"
                icon={ReceiptTextIcon}
              />
              <MiniStat
                label="Collected"
                value={formatCurrency(finance?.collected ?? 0)}
                tone="text-emerald-600 dark:text-emerald-400"
                icon={CreditCardIcon}
              />
              <MiniStat
                label="Outstanding"
                value={formatCurrency(finance?.outstanding ?? 0)}
                tone="text-rose-600 dark:text-rose-400"
                icon={WalletIcon}
              />
              <MiniStat
                label="Collection"
                value={`${finance?.collectionRate ?? 0}%`}
                tone="text-indigo-600 dark:text-indigo-400"
                icon={TrendingUpIcon}
              />
            </div>
            <div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground/50">
                <span>
                  {finance?.invoiceCount ?? 0} invoices ·{" "}
                  {finance?.paymentCount ?? 0} payments
                </span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  {finance?.collectionRate ?? 0}%
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
                  style={{ width: `${finance?.collectionRate ?? 0}%` }}
                />
              </div>
            </div>
          </div>
        </Section>

        {/* ── Assignments ───────────────────────────────────────────── */}
        <Section
          title="Assignments"
          icon={SparklesIcon}
          accent="bg-gradient-to-br from-amber-500 to-orange-600"
          action={
            <Link to="/dashboard/assignments">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground/50 hover:text-amber-600"
              >
                Manage <ArrowUpRightIcon className="ml-0.5 size-3" />
              </Button>
            </Link>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <MiniStat
                label="Total"
                value={assignments?.total ?? 0}
                tone="text-foreground"
                icon={BookOpenIcon}
              />
              <MiniStat
                label="Published"
                value={assignments?.published ?? 0}
                tone="text-emerald-600 dark:text-emerald-400"
                icon={CheckCircle2Icon}
              />
              <MiniStat
                label="To Grade"
                value={assignments?.pendingGrading ?? 0}
                tone="text-amber-600 dark:text-amber-400"
                icon={ClipboardCheckIcon}
              />
            </div>
            <div className="rounded-xl border border-border/10 bg-background/50 px-4 py-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground/70">
                  Submissions awaiting grading
                </span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {assignments?.pendingGrading ?? 0}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground/40">
                Questions-only submissions need a teacher's review.
              </p>
            </div>
          </div>
        </Section>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           ROW: Enrollment by grade + Timetable readiness
           ═══════════════════════════════════════════════════════════════ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Enrollment by grade ───────────────────────────────────── */}
        <Section
          title="Enrollment by Grade"
          icon={GraduationCapIcon}
          accent="bg-gradient-to-br from-violet-500 to-fuchsia-600"
          action={
            <Link to="/dashboard/grades">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground/50 hover:text-violet-600"
              >
                Grades <ArrowUpRightIcon className="ml-0.5 size-3" />
              </Button>
            </Link>
          }
        >
          {data.enrollmentByGrade.length === 0 ? (
            <div className="flex min-h-[140px] items-center justify-center text-sm text-muted-foreground/50">
              No grades configured yet.
            </div>
          ) : (
            <div className="space-y-3">
              {data.enrollmentByGrade.map((grade) => (
                <div key={grade.gradeId}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground/80">
                      {grade.name} - {grade.section}
                    </span>
                    <span className="tabular-nums font-semibold text-foreground">
                      {grade.students}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted/50">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
                      style={{
                        width: `${Math.max(
                          (grade.students / maxEnrollment) * 100,
                          grade.students > 0 ? 4 : 0,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── Timetable readiness ───────────────────────────────────── */}
        <Section
          title="Timetable Readiness"
          icon={CalendarClockIcon}
          accent="bg-gradient-to-br from-sky-500 to-cyan-600"
          action={
            <Link to="/dashboard/timetable">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground/50 hover:text-sky-600"
              >
                Timetable <ArrowUpRightIcon className="ml-0.5 size-3" />
              </Button>
            </Link>
          }
        >
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground/70">
                  Grades with a generated timetable
                </span>
                <span className="font-semibold tabular-nums text-foreground">
                  {timetable?.gradesWithTimetable ?? 0} /{" "}
                  {timetable?.totalGrades ?? 0}
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 transition-all duration-500"
                  style={{
                    width: `${
                      (timetable?.totalGrades ?? 0) > 0
                        ? ((timetable?.gradesWithTimetable ?? 0) /
                            (timetable?.totalGrades ?? 1)) *
                          100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/10 bg-background/50 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/40">
                  With timetable
                </p>
                <p className="mt-0.5 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {timetable?.gradesWithTimetable ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-border/10 bg-background/50 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/40">
                  Missing
                </p>
                <p className="mt-0.5 text-lg font-bold text-amber-600 dark:text-amber-400">
                  {timetable?.gradesWithoutTimetable ?? 0}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/10 bg-background/50 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/40">
                  Grades
                </p>
                <p className="mt-0.5 text-lg font-bold text-foreground">
                  {summary.grades}
                </p>
              </div>
              <div className="rounded-xl border border-border/10 bg-background/50 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/40">
                  Subjects
                </p>
                <p className="mt-0.5 text-lg font-bold text-foreground">
                  {summary.subjects}
                </p>
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           RECENT ACTIVITY
           ═══════════════════════════════════════════════════════════════ */}
      <Section
        title="Recent Activity"
        icon={ActivityIcon}
        accent="bg-gradient-to-br from-slate-500 to-slate-600"
        action={
          <Link to="/dashboard/activity-log">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground/50 hover:text-slate-600"
            >
              Full log <ArrowUpRightIcon className="ml-0.5 size-3" />
            </Button>
          </Link>
        }
      >
        {data.recentActivity.length === 0 ? (
          <div className="flex min-h-[120px] items-center justify-center text-sm text-muted-foreground/50">
            No activity recorded yet.
          </div>
        ) : (
          <ul className="space-y-1">
            {data.recentActivity.map((log, i) => (
              <li
                key={log.id}
                className={cn(
                  // overflow-hidden makes the row a scroll container, so the
                  // nowrap details text (truncate) doesn't inflate the section's
                  // intrinsic min-content width and blow out the page layout.
                  "flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-muted/30",
                  i < data.recentActivity.length - 1 &&
                    "border-b border-border/5",
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <ActivityIcon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {log.details ?? activityLabel(log.activity)}
                  </p>
                  <p className="text-[11px] text-muted-foreground/40">
                    {log.userName}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/40">
                  {timeAgo(log.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
