/**
 * assignments/detail-dialog — Staff view of an assignment.
 *
 * Shows:
 * - Assignment meta (grade / subject / type / status / due date)
 * - The full question set with answer keys
 * - All student submissions with score & status
 * - Manual grading for QUESTIONS_ONLY (or ungraded) submissions
 */

import { useState, useMemo } from "react";
import {
  XIcon,
  BookOpenIcon,
  GraduationCapIcon,
  UsersIcon,
  LoaderIcon,
  CheckCircle2Icon,
  XCircleIcon,
  SaveIcon,
  CalendarIcon,
  ListChecksIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useAssignment,
  useAssignmentSubmissions,
  useGradeSubmission,
  type Assignment,
  type QuestionFeedback,
} from "@/lib/hooks/use-assignments";
import { Loader } from "@/components/globals/loader";

// ─── Props ──────────────────────────────────────────────────────────────────

interface DetailDialogProps {
  assignment: Assignment;
  onOpenChange: (open: boolean) => void;
}

// ─── Status chip ────────────────────────────────────────────────────────────

function SubmissionStatusChip({ status }: { status: "SUBMITTED" | "GRADED" }) {
  return status === "GRADED" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 ring-1 ring-emerald-500/10 dark:text-emerald-400">
      <CheckCircle2Icon className="size-3" />
      Graded
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 ring-1 ring-amber-500/10 dark:text-amber-400">
      Pending
    </span>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function AssignmentDetailDialog({
  assignment,
  onOpenChange,
}: DetailDialogProps) {
  const { data: detail, isLoading: detailLoading } = useAssignment(assignment.id);
  const { data: submissions, isLoading: submissionsLoading } =
    useAssignmentSubmissions(assignment.id);
  const gradeSubmission = useGradeSubmission();

  // ── Manual grade state ───────────────────────────────────────────────
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeInput, setGradeInput] = useState("");

  const questions = detail?.questions ?? assignment.questions;
  const totalPoints = useMemo(
    () => questions.reduce((s, q) => s + (q.points || 0), 0),
    [questions],
  );

  const handleStartGrade = (submissionId: string, max: number) => {
    setGradingId(submissionId);
    setGradeInput("");
  };

  const handleSaveGrade = async (
    submissionId: string,
    max: number,
  ) => {
    const score = Number(gradeInput);
    if (Number.isNaN(score) || score < 0) return;
    await gradeSubmission.mutateAsync({
      submissionId,
      score: Math.min(score, max),
    });
    setGradingId(null);
  };

  const gradedCount = submissions?.filter((s) => s.status === "GRADED").length ?? 0;
  const avgScore =
    submissions && submissions.filter((s) => s.score != null).length > 0
      ? Math.round(
          (submissions.reduce((sum, s) => sum + (s.score ?? 0), 0) /
            submissions.filter((s) => s.score != null).length) *
            10,
        ) / 10
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border/20 bg-background shadow-2xl shadow-black/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative header */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-violet-500/[0.07] to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 size-32 rounded-full bg-gradient-to-br from-violet-500/10 to-transparent blur-3xl"
        />

        {/* Close */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Close dialog"
          className="absolute right-4 top-4 z-10 flex size-7 items-center justify-center rounded-full text-muted-foreground/40 transition-all duration-200 hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-4" />
        </button>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="relative px-6 pb-4 pt-8">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/20">
              <BookOpenIcon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                {assignment.title}
              </h2>
              {assignment.description && (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground/60">
                  {assignment.description}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-violet-500/20 bg-violet-500/5 px-2 py-0 text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400"
                >
                  {assignment.type === "WITH_ANSWERS" ? "Q&A (Auto-graded)" : "Questions Only"}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "px-2 py-0 text-[10px] font-semibold uppercase tracking-wider",
                    assignment.status === "PUBLISHED"
                      ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                      : assignment.status === "CLOSED"
                        ? "border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400"
                        : "border-slate-500/20 bg-slate-500/5 text-slate-600 dark:text-slate-400",
                  )}
                >
                  {assignment.status.toLowerCase()}
                </Badge>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60">
                  <GraduationCapIcon className="size-3" />
                  {assignment.grade.name} - {assignment.grade.section}
                </span>
                {assignment.subject && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60">
                    <BookOpenIcon className="size-3" />
                    {assignment.subject.name}
                  </span>
                )}
                {assignment.dueDate && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60">
                    <CalendarIcon className="size-3" />
                    Due {assignment.dueDate.split("T")[0]}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats strip */}
          {!submissionsLoading && submissions && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border/15 bg-muted/15 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
                  Submissions
                </p>
                <p className="text-lg font-bold text-foreground">
                  {submissions.length}
                </p>
              </div>
              <div className="rounded-xl border border-border/15 bg-muted/15 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
                  Graded
                </p>
                <p className="text-lg font-bold text-foreground">{gradedCount}</p>
              </div>
              <div className="rounded-xl border border-border/15 bg-muted/15 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
                  Avg Score
                </p>
                <p className="text-lg font-bold text-foreground">
                  {avgScore}
                  <span className="text-xs font-normal text-muted-foreground/50">
                    /{totalPoints}
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div className="relative flex-1 overflow-y-auto px-6 pb-6">
          {detailLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader variant="spinner" text="Loading assignment…" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* ── Questions ─────────────────────────────────────────── */}
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  <ListChecksIcon className="size-3.5" />
                  Questions ({questions.length})
                </h3>
                <div className="space-y-2">
                  {questions.map((q, index) => (
                    <div
                      key={q.id}
                      className="rounded-xl border border-border/20 bg-gradient-to-b from-background/90 to-background/50 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="flex-1 text-sm text-foreground">
                          <span className="mr-1.5 text-muted-foreground/40">
                            {index + 1}.
                          </span>
                          {q.question}
                        </p>
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
                          {q.points} pts
                        </span>
                      </div>
                      {assignment.type === "WITH_ANSWERS" && q.answerKey && (
                        <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-emerald-500/[0.06] px-2 py-0.5 text-xs text-emerald-600 ring-1 ring-emerald-500/10 dark:text-emerald-400">
                          <CheckCircle2Icon className="size-3" />
                          {q.answerKey}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Submissions ────────────────────────────────────────── */}
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  <UsersIcon className="size-3.5" />
                  Submissions ({submissions?.length ?? 0})
                </h3>

                {submissionsLoading ? (
                  <div className="flex h-24 items-center justify-center">
                    <Loader variant="spinner" size="sm" text="Loading submissions…" />
                  </div>
                ) : submissions && submissions.length > 0 ? (
                  <div className="space-y-2">
                    {submissions.map((sub) => (
                      <div
                        key={sub.id}
                        className="rounded-xl border border-border/20 bg-gradient-to-b from-background/90 to-background/50 p-3 transition-all duration-200 hover:border-violet-500/20"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/15 to-violet-500/5 text-xs font-bold text-violet-600 ring-1 ring-violet-500/10 dark:text-violet-400">
                              {sub.student?.user.name
                                .split(" ")
                                .map((w) => w[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {sub.student?.user.name}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground/40">
                                {sub.student?.admissionNumber ?? "—"} ·{" "}
                                {new Date(sub.submittedAt).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {sub.status === "GRADED" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                {sub.score}/{sub.totalPoints}
                              </span>
                            ) : (
                              <span className="text-sm font-medium text-muted-foreground/50">
                                Not graded
                              </span>
                            )}
                            <SubmissionStatusChip status={sub.status} />

                            {gradingId === sub.id ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min={0}
                                  max={sub.totalPoints}
                                  value={gradeInput}
                                  onChange={(e) => setGradeInput(e.target.value)}
                                  placeholder={`0-${sub.totalPoints}`}
                                  className="h-8 w-20 border-border/30 text-sm"
                                />
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  disabled={gradeSubmission.isPending}
                                  onClick={() =>
                                    handleSaveGrade(sub.id, sub.totalPoints)
                                  }
                                  className="text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600"
                                >
                                  <SaveIcon className="size-3.5" />
                                </Button>
                              </div>
                            ) : (
                              sub.status === "SUBMITTED" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleStartGrade(sub.id, sub.totalPoints)
                                  }
                                  className="h-8 border-border/30 text-xs text-muted-foreground/70 hover:border-violet-500/30 hover:text-violet-600"
                                >
                                  Grade
                                </Button>
                              )
                            )}
                          </div>
                        </div>

                        {/* Answers preview when grading */}
                        {gradingId === sub.id && (
                          <div className="mt-3 space-y-1.5 border-t border-border/10 pt-3">
                            {sub.answers?.map((a) => {
                              const q = questions.find(
                                (qq) => qq.id === a.questionId,
                              );
                              return (
                                <p
                                  key={a.questionId}
                                  className="text-xs text-muted-foreground/70"
                                >
                                  <span className="font-medium text-foreground/80">
                                    {q ? q.question : a.questionId}:
                                  </span>{" "}
                                  {a.answer || "—"}
                                </p>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/25 px-6 py-8 text-center">
                    <UsersIcon className="size-8 text-muted-foreground/20" />
                    <p className="text-sm font-medium text-muted-foreground/60">
                      No submissions yet
                    </p>
                    <p className="text-xs text-muted-foreground/40">
                      Students will appear here once they submit.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
