/**
 * teacher-dashboard — Personalized dashboard for TEACHER roles.
 *
 * Shows the teacher's own weekly timetable (across all their classes), their
 * assigned classes, and their recent assignments. Data comes from
 * GET /api/timetable/my + the role-aware assignments list.
 *
 * Design ("Aura v2" — sky theme, matching the Timetable page).
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
  UserRoundIcon,
  FileTextIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  RefreshCwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/globals/loader";
import { TimetableGrid } from "@/components/dashboard/timetable-grid";
import { StatCard } from "@/components/dashboard/stat-card";
import { useMyTimetable } from "@/lib/hooks/use-timetable";
import { useAssignments } from "@/lib/hooks/use-assignments";
import { authClient } from "@/lib/auth-client";
import { cn, formatDate } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Period duration used for the weekly-hours stat */
const PERIOD_DURATION = 40;

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PUBLISHED: {
    label: "Published",
    className:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  DRAFT: {
    label: "Draft",
    className:
      "border-muted-foreground/20 bg-muted/40 text-muted-foreground/70",
  },
  CLOSED: {
    label: "Closed",
    className:
      "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
};

// ─── Main Dashboard ─────────────────────────────────────────────────────────

export function TeacherDashboard() {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const firstName = user?.name?.split(" ")[0] ?? "Teacher";

  const {
    data: my,
    isLoading,
    isError,
    refetch,
  } = useMyTimetable();
  const { data: assignments } = useAssignments();

  // Assignments authored by this teacher
  const myAssignments = useMemo(
    () =>
      (assignments ?? [])
        .filter((a) => a.createdBy.id === user?.id)
        .slice(0, 4),
    [assignments, user?.id],
  );

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const slots = my?.slots ?? [];
    return {
      classes: my?.classes?.length ?? 0,
      lessons: slots.length,
      subjects: new Set(slots.map((s) => s.subjectName)).size,
      weeklyHours: slots.length * PERIOD_DURATION,
    };
  }, [my]);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* ═══════════════════════════════════════════════════════════════════
           HERO BANNER
           ═══════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-br from-sky-500/[0.05] via-background to-background p-6 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 size-60 rounded-full bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-transparent blur-3xl animate-[blob_8s_ease-in-out_infinite]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 size-48 rounded-full bg-gradient-to-tr from-cyan-500/5 via-cyan-500/[0.02] to-transparent blur-3xl animate-[blob_10s_ease-in-out_infinite_2s]"
        />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-lg shadow-sky-500/20">
              <UserRoundIcon className="size-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Welcome back, {firstName}
              </h1>
              <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground/70">
                Your weekly schedule, classes, and assignments — all in one
                place.
              </p>
            </div>
          </div>

          <Link to="/dashboard/timetable">
            <Button
              variant="outline"
              size="sm"
              className="border-sky-500/20 text-sky-600 hover:bg-sky-500/10 hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-400"
            >
              Full Timetable
              <ArrowRightIcon className="ml-1 size-3.5" />
            </Button>
          </Link>
        </div>

        {/* ── Stat cards ─────────────────────────────────────────────── */}
        {!isLoading && stats.lessons > 0 && (
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={GraduationCapIcon}
              label="My Classes"
              value={stats.classes}
              gradient="bg-gradient-to-br from-sky-500 to-sky-600"
            />
            <StatCard
              icon={CalendarClockIcon}
              label="Weekly Lessons"
              value={stats.lessons}
              gradient="bg-gradient-to-br from-cyan-500 to-cyan-600"
            />
            <StatCard
              icon={BookOpenIcon}
              label="Subjects"
              value={stats.subjects}
              gradient="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <StatCard
              icon={ClockIcon}
              label="Weekly Hours"
              value={stats.weeklyHours}
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
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-sm">
              <CalendarClockIcon className="size-4" />
            </span>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              My Timetable
            </h2>
          </div>
          <span className="text-[11px] text-muted-foreground/40">
            {stats.lessons > 0
              ? `${stats.lessons} lessons across ${stats.classes} classes`
              : "No lessons scheduled"}
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
              Your lessons will appear here once the school generates
              timetables. Contact an administrator if you expected a schedule.
            </p>
          </div>
        ) : (
          <TimetableGrid slots={my!.slots} showGrade />
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
           MY CLASSES + RECENT ASSIGNMENTS
           ═══════════════════════════════════════════════════════════════ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── My classes ────────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-b from-background/80 to-background/40 shadow-sm shadow-black/[0.02] backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-border/10 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm">
                <GraduationCapIcon className="size-4" />
              </span>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                My Classes
              </h2>
            </div>
            <span className="text-[11px] text-muted-foreground/40">
              {stats.classes} total
            </span>
          </div>

          <div className="p-4">
            {(my?.classes?.length ?? 0) === 0 ? (
              <div className="flex min-h-[120px] items-center justify-center text-center text-sm text-muted-foreground/50">
                No classes assigned yet.
              </div>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {my!.classes!.map((cls) => (
                  <div
                    key={cls.id}
                    className="group flex items-center gap-3 rounded-xl border border-border/15 bg-background/50 p-3.5 transition-all duration-200 hover:border-sky-500/20 hover:bg-sky-500/[0.02]"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-500/5 text-blue-600 shadow-sm ring-1 ring-blue-500/10 dark:text-blue-400">
                      <BookOpenIcon className="size-4.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {cls.subject.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground/50">
                        {cls.grade.name} - {cls.grade.section}
                      </p>
                    </div>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground/30">
                      {cls.subject.code}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Recent assignments ────────────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-b from-background/80 to-background/40 shadow-sm shadow-black/[0.02] backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-border/10 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm">
                <FileTextIcon className="size-4" />
              </span>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                My Recent Assignments
              </h2>
            </div>
            <Link to="/dashboard/assignments">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground/50 hover:text-amber-600"
              >
                View all <ArrowRightIcon className="ml-0.5 size-3" />
              </Button>
            </Link>
          </div>

          <div className="p-4">
            {myAssignments.length === 0 ? (
              <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 text-center">
                <SparklesIcon className="size-8 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground/60">
                  No assignments created yet.
                </p>
                <p className="text-xs text-muted-foreground/40">
                  Generate AI-powered assignments from the Assignments page.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {myAssignments.map((assignment) => {
                  const badge = STATUS_BADGE[assignment.status];
                  return (
                    <li
                      key={assignment.id}
                      className="group flex items-center gap-3 rounded-xl border border-border/15 bg-background/50 p-3.5 transition-all duration-200 hover:border-amber-500/20 hover:bg-amber-500/[0.02]"
                    >
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/[0.02]",
                          assignment.status === "PUBLISHED"
                            ? "bg-gradient-to-br from-emerald-500 to-emerald-600"
                            : "bg-gradient-to-br from-muted to-muted-foreground/30",
                        )}
                      >
                        {assignment.status === "PUBLISHED" ? (
                          <CheckCircle2Icon className="size-4.5 text-white" />
                        ) : (
                          <ClipboardCheckIcon className="size-4.5 text-white" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {assignment.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground/50">
                          {assignment.grade.name} - {assignment.grade.section}
                          {assignment.subject ? ` · ${assignment.subject.name}` : ""}
                          {assignment._count.submissions > 0
                            ? ` · ${assignment._count.submissions} submission${assignment._count.submissions > 1 ? "s" : ""}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge
                          variant="outline"
                          className={cn(
                            "border font-medium normal-case tracking-normal",
                            badge.className,
                          )}
                        >
                          {badge.label}
                        </Badge>
                        {assignment.dueDate && (
                          <span className="text-[10px] text-muted-foreground/40">
                            Due {formatDate(assignment.dueDate)}
                          </span>
                        )}
                      </div>
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
