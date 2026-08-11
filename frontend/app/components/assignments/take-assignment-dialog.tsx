/**
 * assignments/take-assignment-dialog — Student takes an assignment.
 *
 * Flow:
 *  1. Loads the published assignment (questions without answer keys).
 *  2. Student types answers into textareas.
 *  3. Submit → backend returns instant results (WITH_ANSWERS → AI-graded
 *     score + per-question feedback; QUESTIONS_ONLY → awaiting teacher grade).
 *  4. Results screen shows score ring, per-question verdicts, and correct answers.
 */

import { useState, useEffect, useMemo } from "react";
import {
  XIcon,
  BookOpenIcon,
  LoaderIcon,
  SendIcon,
  CheckCircle2Icon,
  XCircleIcon,
  GraduationCapIcon,
  CalendarIcon,
  ListChecksIcon,
  RotateCcwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useAssignment,
  useSubmitAssignment,
  type AssignmentSubmission,
  type QuestionFeedback,
} from "@/lib/hooks/use-assignments";
import { Loader } from "@/components/globals/loader";

// ─── Props ──────────────────────────────────────────────────────────────────

interface TakeAssignmentDialogProps {
  assignmentId: string;
  onOpenChange: (open: boolean) => void;
}

// ─── Score Ring ─────────────────────────────────────────────────────────────

function ScoreRing({ score, total }: { score: number; total: number }) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const color =
    pct >= 80
      ? "text-emerald-500"
      : pct >= 50
        ? "text-amber-500"
        : "text-red-500";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex size-28 items-center justify-center">
        <svg className="size-28 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            strokeWidth="8"
            className="stroke-muted/30"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 264} 264`}
            className={cn(
              "transition-all duration-1000 ease-out",
              color,
            )}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className={cn("text-2xl font-bold tracking-tight", color)}>
            {score}
          </span>
          <span className="text-[10px] text-muted-foreground/50">
            / {total} pts
          </span>
        </div>
      </div>
      <span className="text-sm font-semibold text-foreground/80">{pct}%</span>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function TakeAssignmentDialog({
  assignmentId,
  onOpenChange,
}: TakeAssignmentDialogProps) {
  const { data: assignment, isLoading } = useAssignment(assignmentId);
  const submit = useSubmitAssignment();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AssignmentSubmission | null>(null);
  // True when a student with a pending submission opts to edit & re-submit.
  const [editing, setEditing] = useState(false);

  // Reset answers when the assignment changes
  useEffect(() => {
    setAnswers({});
    setResult(null);
    setEditing(false);
    submit.reset();
  }, [assignmentId]);

  // If the student already submitted, show their previous result instead of
  // the answer form (re-submission is blocked server-side once graded).
  const previousSubmission = assignment?.mySubmission;
  const alreadySubmitted = !!previousSubmission;

  // Derive what the dialog should show: a fresh submit result beats a past one.
  const displayResult =
    result ??
    (previousSubmission && previousSubmission.status === "GRADED"
      ? (previousSubmission as AssignmentSubmission)
      : null);

  const feedbackMap = useMemo(() => {
    if (!displayResult?.feedback) return new Map<string, QuestionFeedback>();
    return new Map(displayResult.feedback.map((f) => [f.questionId, f]));
  }, [displayResult]);

  const allAnswered =
    !!assignment &&
    assignment.questions.every((q) => (answers[q.id] ?? "").trim().length > 0);

  const handleSubmit = async () => {
    if (!assignment || !allAnswered) return;
    const submission = await submit.mutateAsync({
      id: assignment.id,
      answers: assignment.questions.map((q) => ({
        questionId: q.id,
        answer: answers[q.id] ?? "",
      })),
    });
    setResult(submission);
    setEditing(false);
  };

  const handleEdit = () => {
    // Prefill the form with the latest submission (fresh result or stored one).
    const submission = result ?? previousSubmission;
    if (submission?.answers) {
      const prefilled: Record<string, string> = {};
      for (const a of submission.answers) {
        prefilled[a.questionId] = a.answer;
      }
      setAnswers(prefilled);
    }
    setEditing(true);
  };

  const handleClose = () => {
    submit.reset();
    onOpenChange(false);
  };

  if (!assignmentId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/20 bg-background shadow-2xl shadow-black/10"
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
          onClick={handleClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 z-10 flex size-7 items-center justify-center rounded-full text-muted-foreground/40 transition-all duration-200 hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-4" />
        </button>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="relative px-6 pb-4 pt-8">
          {isLoading || !assignment ? (
            <div className="flex h-40 items-center justify-center">
              <Loader variant="spinner" text="Loading assignment…" />
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/20">
                <BookOpenIcon className="size-5" />
              </span>
              <div className="min-w-0">
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
                    {assignment.type === "WITH_ANSWERS" ? "Q&A" : "Questions"}
                  </Badge>
                  {assignment.subject && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60">
                      <BookOpenIcon className="size-3" />
                      {assignment.subject.name}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60">
                    <GraduationCapIcon className="size-3" />
                    {assignment.grade.name} - {assignment.grade.section}
                  </span>
                  {assignment.dueDate && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60">
                      <CalendarIcon className="size-3" />
                      Due {assignment.dueDate.split("T")[0]}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60">
                    <ListChecksIcon className="size-3" />
                    {assignment.questions.length} questions ·{" "}
                    {assignment.questions.reduce(
                      (s, q) => s + (q.points || 0),
                      0,
                    )}{" "}
                    pts
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        {!isLoading && assignment && (
          <div className="relative flex-1 overflow-y-auto px-6 pb-6">
            {alreadySubmitted &&
            !result &&
            previousSubmission?.status !== "GRADED" &&
            !editing ? (
              /* ═════════════════════════════════════════════════════════
                 ALREADY SUBMITTED (awaiting teacher grading)
                 ═════════════════════════════════════════════════════════ */
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/10 dark:text-amber-400">
                  <SendIcon className="size-6" />
                </span>
                <div>
                  <p className="text-base font-semibold text-foreground">
                    Assignment submitted
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground/60">
                    You already submitted this assignment. Your teacher will
                    grade it shortly.
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleEdit}
                    variant="outline"
                    className="border-violet-500/30 text-violet-600 transition-all duration-200 hover:bg-violet-500/10 dark:text-violet-400"
                  >
                    <RotateCcwIcon className="mr-1.5 size-3.5" />
                    Edit & Re-submit
                  </Button>
                  <Button
                    type="button"
                    onClick={handleClose}
                    className="bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-md shadow-violet-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/30"
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : displayResult && !editing ? (
              /* ═════════════════════════════════════════════════════════
                 RESULTS VIEW
                 ═════════════════════════════════════════════════════════ */
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/20 bg-gradient-to-b from-background/90 to-background/40 p-6">
                  {displayResult.status === "GRADED" &&
                  displayResult.score != null ? (
                    <ScoreRing
                      score={displayResult.score}
                      total={displayResult.totalPoints}
                    />
                  ) : (
                    <span className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/10 dark:text-amber-400">
                      <SendIcon className="size-6" />
                    </span>
                  )}
                  <p className="text-sm font-medium text-foreground/80">
                    {displayResult.status === "GRADED" ? (
                      "Great job! Here's your instant result."
                    ) : (
                      "Submitted! Your teacher will grade it shortly."
                    )}
                  </p>
                  {displayResult.status !== "GRADED" && (
                    <Button
                      type="button"
                      onClick={handleEdit}
                      variant="outline"
                      className="border-violet-500/30 text-violet-600 transition-all duration-200 hover:bg-violet-500/10 dark:text-violet-400"
                    >
                      <RotateCcwIcon className="mr-1.5 size-3.5" />
                      Edit & Re-submit
                    </Button>
                  )}
                  {displayResult.status === "GRADED" &&
                    displayResult.feedback &&
                    displayResult.feedback.length > 0 && (
                      <p className="text-xs text-muted-foreground/50">
                        {displayResult.feedback.filter((f) => f.correct).length}{" "}
                        of {displayResult.feedback.length} questions correct
                      </p>
                    )}
                </div>

                {/* Per-question breakdown */}
                {displayResult.feedback && displayResult.feedback.length > 0 && (
                  <div className="space-y-3">
                    {assignment.questions.map((q, index) => {
                      const fb = feedbackMap.get(q.id);
                      const studentAnswer =
                        displayResult.answers?.find((a) => a.questionId === q.id)
                          ?.answer ?? "";
                      return (
                        <div
                          key={q.id}
                          className="overflow-hidden rounded-xl border border-border/25 bg-gradient-to-b from-background/90 to-background/50 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="flex-1 text-sm font-medium text-foreground">
                              <span className="mr-1.5 text-muted-foreground/40">
                                {index + 1}.
                              </span>
                              {q.question}
                            </p>
                            {fb && (
                              <span
                                className={cn(
                                  "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                  fb.correct
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    : "bg-red-500/15 text-red-600 dark:text-red-400",
                                )}
                              >
                                {fb.correct ? (
                                  <CheckCircle2Icon className="size-3" />
                                ) : (
                                  <XCircleIcon className="size-3" />
                                )}
                                {fb.earned}/{q.points || 0}
                              </span>
                            )}
                          </div>
                          <div className="mt-3 space-y-2">
                            <div>
                              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
                                Your answer
                              </p>
                              <p
                                className={cn(
                                  "rounded-lg border border-border/15 bg-muted/20 px-3 py-2 text-sm",
                                  fb?.correct
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-red-600/90 dark:text-red-400/90",
                                )}
                              >
                                {studentAnswer || "—"}
                              </p>
                            </div>
                            {fb?.correctAnswer && !fb.correct && (
                              <div>
                                <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
                                  Correct answer
                                </p>
                                <p className="rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
                                  {fb.correctAnswer}
                                </p>
                              </div>
                            )}
                            {fb?.feedback && (
                              <p className="text-xs italic text-muted-foreground/60">
                                {fb.feedback}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Button
                  type="button"
                  onClick={handleClose}
                  className="w-full bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-md shadow-violet-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/30"
                >
                  Close
                </Button>
              </div>
            ) : (
              /* ═════════════════════════════════════════════════════════
                 QUESTIONS VIEW
                 ═════════════════════════════════════════════════════════ */
              <div className="space-y-4">
                {alreadySubmitted && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                    <RotateCcwIcon className="size-3.5 shrink-0" />
                    You can update your answers and re-submit before the
                    teacher grades them.
                  </div>
                )}
                {assignment.questions.map((q, index) => (
                  <div
                    key={q.id}
                    className="overflow-hidden rounded-xl border border-border/25 bg-gradient-to-b from-background/90 to-background/50 p-4 transition-all duration-200 hover:border-violet-500/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="flex-1 text-sm font-medium text-foreground">
                        <span className="mr-1.5 inline-flex size-5 items-center justify-center rounded-md bg-violet-500/10 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                          {index + 1}
                        </span>
                        {q.question}
                      </p>
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
                        {q.points || 0} pts
                      </span>
                    </div>
                    <Textarea
                      placeholder="Type your answer…"
                      rows={2}
                      value={answers[q.id] ?? ""}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [q.id]: e.target.value,
                        }))
                      }
                      className="mt-3 border-border/25 bg-background/50 text-sm transition-all duration-200 focus-visible:border-violet-500/30 focus-visible:ring-2 focus-visible:ring-violet-500/10"
                    />
                  </div>
                ))}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <p className="text-xs text-muted-foreground/50">
                    {assignment.type === "WITH_ANSWERS"
                      ? "You'll get instant results after submitting."
                      : "Your teacher will grade this submission."}
                  </p>
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submit.isPending || !allAnswered}
                    className="bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-md shadow-violet-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/30 disabled:opacity-50"
                  >
                    {submit.isPending ? (
                      <span className="inline-flex items-center gap-2">
                        <LoaderIcon className="size-4 animate-spin" />
                        Grading…
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <SendIcon className="size-4" />
                        Submit Assignment
                      </span>
                    )}
                  </Button>
                </div>
                {!allAnswered && (
                  <p className="text-center text-[11px] text-amber-600/70 dark:text-amber-400/70">
                    Answer all questions before submitting.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
