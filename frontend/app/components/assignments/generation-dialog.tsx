/**
 * assignments/generation-dialog — AI assignment generation & edit dialog.
 *
 * Design ("Aura v2", violet theme):
 * - Two steps: ① configure (grade / year / subject / topic / difficulty / count / type)
 *              ② review & edit the AI-generated questions, then save
 * - Gradient header, animated decorative blobs, segmented type selector
 * - Editable question list (question text, points, answer key)
 */

import { useState, useMemo, useEffect } from "react";
import {
  XIcon,
  SparklesIcon,
  BookOpenIcon,
  GraduationCapIcon,
  CalendarRangeIcon,
  LoaderIcon,
  PlusIcon,
  Trash2Icon,
  CheckCircle2Icon,
  ListChecksIcon,
  SaveIcon,
  ChevronLeftIcon,
  RotateCcwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReusableMultiSelect } from "@/components/globals/ReusableMultiSelect";
import { cn } from "@/lib/utils";
import { useSubjects } from "@/lib/hooks/use-subjects";
import {
  useGenerateAssignment,
  useGenerationJob,
  useCreateAssignment,
  useUpdateAssignment,
  type Assignment,
  type AssignmentQuestion,
  type AssignmentType,
  type AssignmentStatus,
} from "@/lib/hooks/use-assignments";
import type { Grade } from "@/lib/hooks/use-grades";
import type { AcademicYear } from "@/lib/hooks/use-academic-years";

// ─── Constants ──────────────────────────────────────────────────────────────

const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
const COUNT_OPTIONS = [3, 5, 8, 10, 15, 20] as const;

const STATUS_OPTIONS: { value: AssignmentStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "CLOSED", label: "Closed" },
];

// ─── Props ──────────────────────────────────────────────────────────────────

interface GenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grades?: Grade[];
  academicYears?: AcademicYear[];
  editing?: Assignment | null; // when editing an existing assignment
}

// ─── Question Editor List (shared by create-review & edit views) ────────────

function QuestionEditorList({
  questions,
  formType,
  updateQuestion,
  removeQuestion,
  addQuestion,
}: {
  questions: AssignmentQuestion[];
  formType: AssignmentType;
  updateQuestion: (index: number, patch: Partial<AssignmentQuestion>) => void;
  removeQuestion: (index: number) => void;
  addQuestion: () => void;
}) {
  return (
    <div className="space-y-3">
      {questions.map((q, index) => (
        <div
          key={q.id}
          className="group relative overflow-hidden rounded-xl border border-border/25 bg-gradient-to-b from-background/90 to-background/50 p-4 transition-all duration-200 hover:border-violet-500/20"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-violet-600/70 dark:text-violet-400/70">
              <span className="flex size-5 items-center justify-center rounded-md bg-violet-500/10 text-[10px] text-violet-600 dark:text-violet-400">
                {index + 1}
              </span>
              Question
            </span>
            <button
              type="button"
              onClick={() => removeQuestion(index)}
              aria-label="Remove question"
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground/30 opacity-0 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            >
              <Trash2Icon className="size-3.5" />
            </button>
          </div>

          <Textarea
            placeholder="Type the question…"
            value={q.question}
            onChange={(e) => updateQuestion(index, { question: e.target.value })}
            rows={2}
            className="border-border/25 bg-background/50 text-sm transition-all duration-200 focus-visible:border-violet-500/30 focus-visible:ring-2 focus-visible:ring-violet-500/10"
          />

          <div className="mt-2 flex items-start gap-3">
            <div className="w-24 shrink-0">
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
                Points
              </label>
              <Input
                type="number"
                min={1}
                max={100}
                value={q.points}
                onChange={(e) =>
                  updateQuestion(index, {
                    points: Number(e.target.value) || 0,
                  })
                }
                className="h-8 border-border/25 bg-background/50 text-sm transition-all duration-200 focus-visible:border-violet-500/30 focus-visible:ring-2 focus-visible:ring-violet-500/10"
              />
            </div>
            {formType === "WITH_ANSWERS" && (
              <div className="flex-1">
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
                  Answer Key
                </label>
                <Input
                  type="text"
                  placeholder="Concise correct answer…"
                  value={q.answerKey ?? ""}
                  onChange={(e) =>
                    updateQuestion(index, {
                      answerKey: e.target.value,
                    })
                  }
                  className="h-8 border-emerald-500/20 bg-emerald-500/[0.03] text-sm transition-all duration-200 focus-visible:border-emerald-500/30 focus-visible:ring-2 focus-visible:ring-emerald-500/10"
                />
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Add question */}
      <Button
        type="button"
        variant="outline"
        onClick={addQuestion}
        className="w-full border-dashed border-border/40 text-muted-foreground/60 transition-all duration-200 hover:border-violet-500/30 hover:text-violet-600"
      >
        <PlusIcon className="mr-1.5 size-4" />
        Add Question
      </Button>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function GenerationDialog({
  open,
  onOpenChange,
  grades,
  academicYears,
  editing,
}: GenerationDialogProps) {
  // ── Step & config state ──────────────────────────────────────────────
  const [step, setStep] = useState<"configure" | "review">("configure");
  const [formTitle, setFormTitle] = useState(editing?.title ?? "");
  const [formDescription, setFormDescription] = useState(
    editing?.description ?? "",
  );
  const [formType, setFormType] = useState<AssignmentType>(
    editing?.type ?? "WITH_ANSWERS",
  );
  const [formYearId, setFormYearId] = useState(editing?.academicYearId ?? "");
  const [formGradeId, setFormGradeId] = useState(editing?.gradeId ?? "");
  const [formSubjectId, setFormSubjectId] = useState(
    editing?.subjectId ?? "",
  );
  const [formTopic, setFormTopic] = useState("");
  const [formDifficulty, setFormDifficulty] = useState<string>("Medium");
  const [formCount, setFormCount] = useState(5);
  const [formDueDate, setFormDueDate] = useState(
    editing?.dueDate ? editing.dueDate.split("T")[0] : "",
  );
  const [publishOnSave, setPublishOnSave] = useState(false);
  const [formStatus, setFormStatus] = useState<AssignmentStatus>(
    editing?.status ?? "DRAFT",
  );

  // ── AI state ──────────────────────────────────────────────────────────
  const [questions, setQuestions] = useState<AssignmentQuestion[]>(
    editing?.questions ?? [],
  );
  // Active generation job id (null when idle). While set, the dialog polls
  // GET /api/assignments/generate/:jobId until the Inngest job completes.
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const generate = useGenerateAssignment();
  const create = useCreateAssignment();
  const update = useUpdateAssignment();
  const { data: generationJob } = useGenerationJob(
    generationJobId ?? undefined,
  );

  const isSaving = create.isPending || update.isPending;
  const isGenerating = generate.isPending || !!generationJobId;
  const generationFailed = generationJob?.status === "failed";

  // ── Sync form state when the dialog opens or the target changes ───────
  // The dialog stays mounted between opens (assignments.tsx always renders
  // it), so the useState initializers above only run once — without this the
  // edit dialog would keep stale (empty) values instead of the assignment's.
  useEffect(() => {
    setStep("configure");
    setFormTitle(editing?.title ?? "");
    setFormDescription(editing?.description ?? "");
    setFormType(editing?.type ?? "WITH_ANSWERS");
    setFormYearId(editing?.academicYearId ?? "");
    setFormGradeId(editing?.gradeId ?? "");
    setFormSubjectId(editing?.subjectId ?? "");
    setFormTopic("");
    setFormDifficulty("Medium");
    setFormCount(5);
    setFormDueDate(editing?.dueDate ? editing.dueDate.split("T")[0] : "");
    setPublishOnSave(false);
    setFormStatus(editing?.status ?? "DRAFT");
    setQuestions(editing?.questions ?? []);
    setGenerationJobId(null);
  }, [editing, open]);

  // ── Consume the finished generation job ───────────────────────────────
  useEffect(() => {
    if (
      generationJob?.status === "completed" &&
      generationJob.questions?.length
    ) {
      setQuestions(generationJob.questions);
      setGenerationJobId(null);
      setStep("review");
    }
  }, [generationJob]);

  // ── Subjects for the selected grade + year ────────────────────────────
  const { data: subjects } = useSubjects(formGradeId, formYearId);

  // Grades filtered by the selected academic year
  const filteredGrades = useMemo(() => {
    if (!grades) return [];
    if (!formYearId) return grades;
    return grades.filter((g) => g.academicYearId === formYearId);
  }, [grades, formYearId]);

  // Select options (first item is the null-value placeholder — shown before
  // any selection; `value={state || null}` keeps the real state a "" so null
  // never reaches the backend)
  const yearOptions = useMemo(
    () => [
      { label: "Select year", value: null as string | null },
      ...(academicYears ?? []).map((y) => ({
        label: `${y.name}${y.isCurrent ? " (Current)" : ""}`,
        value: y.id,
      })),
    ],
    [academicYears],
  );
  const gradeOptions = useMemo(
    () => [
      { label: "Select grade", value: null as string | null },
      ...filteredGrades.map((g) => ({
        label: `${g.name} - ${g.section}`,
        value: g.id,
      })),
    ],
    [filteredGrades],
  );

  // ── Reset when the dialog opens ───────────────────────────────────────
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      // Reset transient state on close
      setStep("configure");
      setFormTopic("");
      setGenerationJobId(null);
      generate.reset();
      create.reset();
      update.reset();
    }
    onOpenChange(next);
  };

  // ── AI generation (async via Inngest) ────────────────────────────────
  const handleGenerate = async () => {
    if (!formGradeId || !formYearId) return;
    const result = await generate.mutateAsync({
      gradeId: formGradeId,
      academicYearId: formYearId,
      subjectId: formSubjectId || undefined,
      topic: formTopic.trim() || undefined,
      difficulty: formDifficulty,
      questionCount: formCount,
      type: formType,
    });
    if (result?.jobId) {
      setGenerationJobId(result.jobId);
    }
  };

  // ── Question editing ──────────────────────────────────────────────────
  const updateQuestion = (
    index: number,
    patch: Partial<AssignmentQuestion>,
  ) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    );
  };

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: `q${prev.length + 1}`,
        question: "",
        points: 5,
        ...(formType === "WITH_ANSWERS" ? { answerKey: "" } : {}),
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Save (create or update) ───────────────────────────────────────────
  const handleSave = async () => {
    const cleanQuestions = questions
      .map((q, i) => ({
        id: q.id || `q${i + 1}`,
        question: q.question.trim(),
        points: Number(q.points) || 5,
        ...(formType === "WITH_ANSWERS"
          ? { answerKey: (q.answerKey ?? "").trim() }
          : {}),
      }))
      .filter((q) => q.question.length > 0);

    if (!formTitle.trim() || !formGradeId || !formYearId) return;
    if (cleanQuestions.length === 0) return;

    const payload: {
      title: string;
      description?: string;
      type: AssignmentType;
      gradeId: string;
      academicYearId: string;
      subjectId?: string;
      questions: AssignmentQuestion[];
      dueDate?: string;
      status?: AssignmentStatus;
    } = {
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      type: formType,
      gradeId: formGradeId,
      academicYearId: formYearId,
      subjectId: formSubjectId || undefined,
      questions: cleanQuestions,
      dueDate: formDueDate || undefined,
    };

    if (editing) {
      // Editing is manual-only — the teacher picks the status explicitly.
      payload.status = formStatus;
      await update.mutateAsync({ id: editing.id, data: payload });
    } else {
      payload.status = publishOnSave ? "PUBLISHED" : "DRAFT";
      await create.mutateAsync(payload);
    }
    handleOpenChange(false);
  };

  // ── Render nothing when closed ────────────────────────────────────────
  if (!open) return null;

  const totalPoints = questions.reduce((s, q) => s + (Number(q.points) || 0), 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm"
      onClick={() => handleOpenChange(false)}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/20 bg-background shadow-2xl shadow-black/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative gradient header strip */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-violet-500/[0.07] to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 size-32 rounded-full bg-gradient-to-br from-violet-500/10 to-transparent blur-3xl"
        />

        {/* Close button */}
        <button
          type="button"
          onClick={() => handleOpenChange(false)}
          aria-label="Close dialog"
          className="absolute right-4 top-4 z-10 flex size-7 items-center justify-center rounded-full text-muted-foreground/40 transition-all duration-200 hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-4" />
        </button>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="relative px-6 pb-2 pt-8">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 text-violet-600 shadow-sm ring-1 ring-violet-500/10 dark:text-violet-400">
              {editing ? (
                <BookOpenIcon className="size-5" />
              ) : (
                <SparklesIcon className="size-5" />
              )}
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                {editing
                  ? "Edit Assignment"
                  : step === "review"
                    ? "Review Generated Questions"
                    : "Create Assignment with AI"}
              </h2>
              <p className="text-xs text-muted-foreground/60">
                {editing
                  ? `Update "${editing.title}"`
                  : step === "review"
                    ? "Fine-tune the AI draft before saving."
                    : "Gemini generates questions tailored to the grade."}
              </p>
            </div>
          </div>

          {/* Step indicator */}
          {!editing && (
            <div className="mb-5 flex items-center gap-2">
              {(["configure", "review"] as const).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full text-[11px] font-semibold transition-all duration-200",
                      step === s
                        ? "bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-md shadow-violet-500/20"
                        : step === "review" && s === "configure"
                          ? "bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/20"
                          : "bg-muted/40 text-muted-foreground/50",
                    )}
                  >
                    {step === "review" && s === "configure" ? (
                      <CheckCircle2Icon className="size-3.5" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-[11px] font-medium uppercase tracking-wider",
                      step === s
                        ? "text-foreground/80"
                        : "text-muted-foreground/40",
                    )}
                  >
                    {s === "configure" ? "Configure" : "Review & Save"}
                  </span>
                  {i === 0 && (
                    <span className="h-px w-6 bg-border/60" aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Scrollable body ───────────────────────────────────────────── */}
        <div className="relative flex-1 overflow-y-auto px-6 pb-6">
          {editing ? (
            /* ═══════════════════════════════════════════════════════════
               EDIT MODE — manual only, no AI involved
               ═══════════════════════════════════════════════════════════ */
            <div className="space-y-4">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Assignment Title
                </label>
                <div className="relative">
                  <BookOpenIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                  <Input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-violet-500/30 focus-visible:ring-2 focus-visible:ring-violet-500/10"
                  />
                </div>
              </div>

              {/* Type selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Assignment Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType("WITH_ANSWERS")}
                    className={cn(
                      "group relative overflow-hidden rounded-xl border p-3 text-left transition-all duration-200",
                      formType === "WITH_ANSWERS"
                        ? "border-violet-500/40 bg-violet-500/[0.06] shadow-sm shadow-violet-500/10"
                        : "border-border/30 bg-background/40 hover:border-border/60",
                    )}
                  >
                    <CheckCircle2Icon
                      className={cn(
                        "mb-1.5 size-4",
                        formType === "WITH_ANSWERS"
                          ? "text-violet-600 dark:text-violet-400"
                          : "text-muted-foreground/30",
                      )}
                    />
                    <p className="text-xs font-semibold text-foreground">
                      Q&A with Answers
                    </p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground/50">
                      Auto-graded instantly when students submit.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType("QUESTIONS_ONLY")}
                    className={cn(
                      "group relative overflow-hidden rounded-xl border p-3 text-left transition-all duration-200",
                      formType === "QUESTIONS_ONLY"
                        ? "border-amber-500/40 bg-amber-500/[0.06] shadow-sm shadow-amber-500/10"
                        : "border-border/30 bg-background/40 hover:border-border/60",
                    )}
                  >
                    <ListChecksIcon
                      className={cn(
                        "mb-1.5 size-4",
                        formType === "QUESTIONS_ONLY"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground/30",
                      )}
                    />
                    <p className="text-xs font-semibold text-foreground">
                      Questions Only
                    </p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground/50">
                      Teacher grades submissions manually.
                    </p>
                  </button>
                </div>
              </div>

              {/* Grade + Academic Year (read-only) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Academic Year
                  </label>
                  <div className="flex h-9 w-full items-center rounded-md border border-border/30 bg-muted/30 px-3 text-sm text-muted-foreground/60">
                    {editing.academicYear.name}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Grade
                  </label>
                  <div className="flex h-9 w-full items-center rounded-md border border-border/30 bg-muted/30 px-3 text-sm text-muted-foreground/60">
                    {editing.grade.name} - {editing.grade.section}
                  </div>
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Subject{" "}
                  <span className="font-normal normal-case text-muted-foreground/40">
                    (optional)
                  </span>
                </label>
                <ReusableMultiSelect
                  value={formSubjectId}
                  onValueChange={(v) =>
                    setFormSubjectId(v === "__none__" ? "" : v)
                  }
                  options={[
                    { value: "__none__", label: "All subjects" },
                    ...(subjects ?? []).map((s) => ({
                      value: s.id,
                      label: s.name,
                    })),
                  ]}
                  placeholder="All subjects"
                  accent="violet"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Description{" "}
                  <span className="font-normal normal-case text-muted-foreground/40">
                    (optional)
                  </span>
                </label>
                <Textarea
                  placeholder="Brief instructions for students…"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  className="border-border/30 bg-background/60 backdrop-blur-sm transition-all duration-200 focus-visible:border-violet-500/30 focus-visible:ring-2 focus-visible:ring-violet-500/10"
                />
              </div>

              {/* Due date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Due Date{" "}
                  <span className="font-normal normal-case text-muted-foreground/40">
                    (optional)
                  </span>
                </label>
                <Input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="border-border/30 bg-background/60 backdrop-blur-sm transition-all duration-200 focus-visible:border-violet-500/30 focus-visible:ring-2 focus-visible:ring-violet-500/10"
                />
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Status
                </label>
                <Select
                  value={formStatus}
                  onValueChange={(v) => setFormStatus(v as AssignmentStatus)}
                  items={STATUS_OPTIONS}
                >
                  <SelectTrigger className="h-9 w-full border-border/30 bg-background/60 text-sm backdrop-blur-sm transition-all duration-200 focus-visible:border-violet-500/30 focus-visible:ring-2 focus-visible:ring-violet-500/10">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="border-border/30">
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PUBLISHED">Published</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Questions */}
              <div className="pt-1">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Questions
                  </span>
                  <span className="text-[11px] text-muted-foreground/40">
                    {questions.length} questions · {totalPoints} pts
                  </span>
                </div>
                <QuestionEditorList
                  questions={questions}
                  formType={formType}
                  updateQuestion={updateQuestion}
                  removeQuestion={removeQuestion}
                  addQuestion={addQuestion}
                />
              </div>
            </div>
          ) : step === "configure" ? (
            isGenerating ? (
              /* ═══════════════════════════════════════════════════════════
                 GENERATING — async Inngest job in progress
                 ═══════════════════════════════════════════════════════════ */
              <div className="flex flex-col items-center gap-5 py-14 text-center">
                <div className="relative">
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 animate-pulse rounded-full bg-violet-500/15 blur-xl"
                  />
                  <span className="relative flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/25">
                    <SparklesIcon className="size-6 animate-pulse" />
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {generationFailed
                      ? "Generation failed"
                      : "Generating with Gemini…"}
                  </p>
                  <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground/60">
                    {generationFailed
                      ? generationJob?.error ??
                        "The AI didn't return valid questions. Please try again."
                      : `Crafting ${formCount} ${formDifficulty.toLowerCase()} questions${formTopic.trim() ? ` on “${formTopic.trim()}”` : ""} for ${grades?.find((g) => g.id === formGradeId)?.name ?? "your grade"} — this usually takes a few seconds.`}
                  </p>
                </div>
                {generationFailed ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGenerate}
                    className="border-violet-500/30 text-violet-600 transition-all duration-200 hover:bg-violet-500/10 dark:text-violet-400"
                  >
                    <RotateCcwIcon className="mr-1.5 size-3.5" />
                    Try Again
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/40">
                    <LoaderIcon className="size-3 animate-spin" />
                    Preparing your draft…
                  </div>
                )}
              </div>
            ) : (
            /* ═══════════════════════════════════════════════════════════
               STEP 1 — CONFIGURE
               ═══════════════════════════════════════════════════════════ */
            <div className="space-y-4">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Assignment Title
                </label>
                <div className="relative">
                  <BookOpenIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                  <Input
                    type="text"
                    placeholder="e.g. Trigonometry Practice"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-violet-500/30 focus-visible:ring-2 focus-visible:ring-violet-500/10"
                  />
                </div>
              </div>

              {/* Type selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Assignment Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType("WITH_ANSWERS")}
                    className={cn(
                      "group relative overflow-hidden rounded-xl border p-3 text-left transition-all duration-200",
                      formType === "WITH_ANSWERS"
                        ? "border-violet-500/40 bg-violet-500/[0.06] shadow-sm shadow-violet-500/10"
                        : "border-border/30 bg-background/40 hover:border-border/60",
                    )}
                  >
                    <CheckCircle2Icon
                      className={cn(
                        "mb-1.5 size-4",
                        formType === "WITH_ANSWERS"
                          ? "text-violet-600 dark:text-violet-400"
                          : "text-muted-foreground/30",
                      )}
                    />
                    <p className="text-xs font-semibold text-foreground">
                      Q&A with Answers
                    </p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground/50">
                      Auto-graded instantly when students submit.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType("QUESTIONS_ONLY")}
                    className={cn(
                      "group relative overflow-hidden rounded-xl border p-3 text-left transition-all duration-200",
                      formType === "QUESTIONS_ONLY"
                        ? "border-amber-500/40 bg-amber-500/[0.06] shadow-sm shadow-amber-500/10"
                        : "border-border/30 bg-background/40 hover:border-border/60",
                    )}
                  >
                    <ListChecksIcon
                      className={cn(
                        "mb-1.5 size-4",
                        formType === "QUESTIONS_ONLY"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground/30",
                      )}
                    />
                    <p className="text-xs font-semibold text-foreground">
                      Questions Only
                    </p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground/50">
                      Teacher grades submissions manually.
                    </p>
                  </button>
                </div>
              </div>

              {/* Grade + Academic Year */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Academic Year
                  </label>
                  <ReusableMultiSelect
                    value={formYearId}
                    onValueChange={(v) => {
                      setFormYearId(v);
                      setFormGradeId("");
                      setFormSubjectId("");
                    }}
                    options={yearOptions}
                    placeholder="Select year"
                    icon={CalendarRangeIcon}
                    accent="violet"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Grade
                  </label>
                  <ReusableMultiSelect
                    value={formGradeId}
                    onValueChange={(v) => {
                      setFormGradeId(v);
                      setFormSubjectId("");
                    }}
                    options={gradeOptions}
                    placeholder="Select grade"
                    icon={GraduationCapIcon}
                    accent="violet"
                    emptyMessage={
                      formYearId
                        ? "No grades for this academic year"
                        : "Select an academic year first"
                    }
                  />
                </div>
              </div>

              {/* Subject + Topic */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Subject{" "}
                    <span className="font-normal normal-case text-muted-foreground/40">
                      (optional)
                    </span>
                  </label>
                  <ReusableMultiSelect
                    value={formSubjectId}
                    onValueChange={(v) =>
                      setFormSubjectId(v === "__none__" ? "" : v)
                    }
                    options={[
                      { value: "__none__", label: "All subjects" },
                      ...(subjects ?? []).map((s) => ({
                        value: s.id,
                        label: s.name,
                      })),
                    ]}
                    placeholder="All subjects"
                    accent="violet"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Topic{" "}
                    <span className="font-normal normal-case text-muted-foreground/40">
                      (optional)
                    </span>
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Fractions, Photosynthesis"
                    value={formTopic}
                    onChange={(e) => setFormTopic(e.target.value)}
                    className="border-border/30 bg-background/60 backdrop-blur-sm transition-all duration-200 focus-visible:border-violet-500/30 focus-visible:ring-2 focus-visible:ring-violet-500/10"
                  />
                </div>
              </div>

              {/* Difficulty + Count */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Difficulty
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {DIFFICULTIES.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setFormDifficulty(d)}
                        className={cn(
                          "rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-all duration-200",
                          formDifficulty === d
                            ? "border-violet-500/40 bg-violet-500/10 text-violet-600 shadow-sm shadow-violet-500/10 dark:text-violet-400"
                            : "border-border/30 text-muted-foreground/50 hover:border-border/60 hover:text-foreground/70",
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Questions
                  </label>
                  <Select
                    value={String(formCount)}
                    onValueChange={(v) => setFormCount(Number(v))}
                    items={COUNT_OPTIONS.map((c) => ({
                      label: `${c} questions`,
                      value: String(c),
                    }))}
                  >
                    <SelectTrigger className="h-9 w-full border-border/30 bg-background/60 text-sm backdrop-blur-sm transition-all duration-200 focus-visible:border-violet-500/30 focus-visible:ring-2 focus-visible:ring-violet-500/10">
                      <SelectValue placeholder="Select question count" />
                    </SelectTrigger>
                    <SelectContent className="border-border/30">
                      {COUNT_OPTIONS.map((c) => (
                        <SelectItem key={c} value={String(c)}>
                          {c} questions
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Description{" "}
                  <span className="font-normal normal-case text-muted-foreground/40">
                    (optional)
                  </span>
                </label>
                <Textarea
                  placeholder="Brief instructions for students…"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  className="border-border/30 bg-background/60 backdrop-blur-sm transition-all duration-200 focus-visible:border-violet-500/30 focus-visible:ring-2 focus-visible:ring-violet-500/10"
                />
              </div>

              {/* Due date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Due Date{" "}
                  <span className="font-normal normal-case text-muted-foreground/40">
                    (optional)
                  </span>
                </label>
                <Input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="border-border/30 bg-background/60 backdrop-blur-sm transition-all duration-200 focus-visible:border-violet-500/30 focus-visible:ring-2 focus-visible:ring-violet-500/10"
                />
              </div>
            </div>
            )
          ) : (
            /* ═══════════════════════════════════════════════════════════
               STEP 2 — REVIEW QUESTIONS
               ═══════════════════════════════════════════════════════════ */
            <div className="space-y-3">
              {/* Summary chips */}
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/20 bg-muted/20 px-3 py-2.5">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/70">
                  <ListChecksIcon className="size-3.5 text-violet-500" />
                  {questions.length} questions
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/70">
                  <CheckCircle2Icon className="size-3.5 text-emerald-500" />
                  {totalPoints} total points
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/70">
                  {formType === "WITH_ANSWERS" ? (
                    <SparklesIcon className="size-3.5 text-violet-500" />
                  ) : (
                    <ListChecksIcon className="size-3.5 text-amber-500" />
                  )}
                  {formType === "WITH_ANSWERS"
                    ? "Auto-graded on submit"
                    : "Manual grading"}
                </span>
              </div>

              {/* Question editor */}
              <QuestionEditorList
                questions={questions}
                formType={formType}
                updateQuestion={updateQuestion}
                removeQuestion={removeQuestion}
                addQuestion={addQuestion}
              />
            </div>
          )}
        </div>

        {/* ── Footer actions ───────────────────────────────────────────── */}
        <div className="relative border-t border-border/10 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            {editing ? (
              /* Edit mode — manual only, no AI generation */
              <>
                <p className="text-[11px] text-muted-foreground/40">
                  Edits are applied when you save — no AI is used.
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                    disabled={isSaving}
                    className="border-border/30"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={
                      isSaving ||
                      !formTitle.trim() ||
                      questions.filter((q) => q.question.trim()).length === 0
                    }
                    className="bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-md shadow-violet-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/30"
                  >
                    {isSaving ? (
                      <span className="inline-flex items-center gap-2">
                        <LoaderIcon className="size-4 animate-spin" />
                        Saving…
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <SaveIcon className="size-4" />
                        Save Changes
                      </span>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                {step === "review" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("configure")}
                    disabled={isGenerating}
                    className="text-muted-foreground/60 hover:text-foreground"
                  >
                    <ChevronLeftIcon className="mr-1 size-4" />
                    Back
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      id="publish-on-save"
                      type="checkbox"
                      checked={publishOnSave}
                      onChange={(e) => setPublishOnSave(e.target.checked)}
                      className="size-3.5 rounded border-border/40 accent-violet-600"
                    />
                    <label
                      htmlFor="publish-on-save"
                      className="text-[11px] font-medium text-muted-foreground/60"
                    >
                      Publish immediately
                    </label>
                  </div>
                )}

                {step === "configure" ? (
                  <Button
                    type="button"
                    onClick={handleGenerate}
                    disabled={
                      isGenerating || !formGradeId || !formYearId || !formTitle.trim()
                    }
                    className="bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-md shadow-violet-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/30 disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <span className="inline-flex items-center gap-2">
                        <LoaderIcon className="size-4 animate-spin" />
                        Generating with Gemini…
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <SparklesIcon className="size-4" />
                        Generate Questions
                      </span>
                    )}
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleOpenChange(false)}
                      disabled={isSaving}
                      className="border-border/30"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSave}
                      disabled={
                        isSaving ||
                        !formTitle.trim() ||
                        questions.filter((q) => q.question.trim()).length === 0
                      }
                      className="bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-md shadow-violet-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/30"
                    >
                      {isSaving ? (
                        <span className="inline-flex items-center gap-2">
                          <LoaderIcon className="size-4 animate-spin" />
                          Saving…
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <SaveIcon className="size-4" />
                          Create Assignment
                        </span>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
