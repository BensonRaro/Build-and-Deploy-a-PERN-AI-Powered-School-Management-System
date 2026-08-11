/**
 * Subjects Page — /dashboard/subjects
 *
 * Design ("Aura v2") — mirrors the Grades page:
 * - Gradient hero banner with animated decorative blobs (emerald/teal tones)
 * - Live stat cards showing aggregate metrics
 * - Premium DataTable with search, pagination, hover effects
 * - Stunning Dialog for create/edit with gradient header
 */

import { useState, useMemo } from "react";
import {
  PlusIcon,
  BookOpenIcon,
  UsersIcon,
  GraduationCapIcon,
  CalendarRangeIcon,
  XIcon,
  SparklesIcon,
  FileTextIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ReusableMultiSelect } from "@/components/globals/ReusableMultiSelect";
import { DataTable } from "@/components/globals/data-table";
import { buildSubjectColumns } from "@/components/subjects/columns";
import {
  useSubjects,
  useCreateSubject,
  useUpdateSubject,
  useDeleteSubject,
  type Subject,
} from "@/lib/hooks/use-subjects";
import { useAcademicYears, type AcademicYear } from "@/lib/hooks/use-academic-years";
import { useGrades } from "@/lib/hooks/use-grades";
import { DeleteConfirmDialog } from "@/components/globals/delete-confirm-dialog";
import { cn } from "@/lib/utils";
import type { Route } from "./+types/subjects";

/** Format an academic year for display with optional (Current) badge */
const formatYearLabel = (year: AcademicYear) =>
  `${year.name}${year.isCurrent ? " (Current)" : ""}`;

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  gradient,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  gradient: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-br from-background/90 to-background/40 p-4 shadow-sm shadow-black/[0.02] backdrop-blur-sm transition-all duration-300 hover:border-border/30 hover:shadow-md hover:shadow-black/[0.04] hover:-translate-y-0.5">
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-6 -top-6 size-20 rounded-full opacity-30 blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:opacity-50",
          gradient,
        )}
      />
      <div className="relative flex items-center gap-3">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/[0.02]",
            gradient,
          )}
        >
          <Icon className="size-4.5 text-white" />
        </span>
        <div className="flex flex-col">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground/50">
            {label}
          </span>
          <span className="text-xl font-bold tracking-tight text-foreground">
            {value}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Meta ────────────────────────────────────────────────────────────────────

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Subjects — Biasly" },
    {
      name: "description",
      content:
        "Manage the school subjects offered across grades.",
    },
  ];
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function SubjectsPage() {
  // ── Queries & Mutations ──────────────────────────────────────────────────
  const { data: subjects, isLoading, isError, refetch } = useSubjects();
  const { data: academicYears } = useAcademicYears();
  const { data: grades } = useGrades();
  const createSubject = useCreateSubject();
  const updateSubject = useUpdateSubject();
  const deleteSubject = useDeleteSubject();

  // ── Dialog form state ────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formGradeId, setFormGradeId] = useState("");
  const [formYearId, setFormYearId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string; description: string } | null>(null);

  // ── Aggregate stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!subjects)
      return { total: 0, teachers: 0, grades: 0, uniqueYears: 0 };
    const total = subjects.length;
    const teachers = subjects.reduce((s, subj) => s + subj._count.teachers, 0);
    const gradeSet = new Set(subjects.map((s) => s.gradeId));
    const yearSet = new Set(subjects.map((s) => s.academicYearId));
    return {
      total,
      teachers,
      grades: gradeSet.size,
      uniqueYears: yearSet.size,
    };
  }, [subjects]);

  // ── Column definitions ──────────────────────────────────────────────────
  const columns = buildSubjectColumns({
    onEdit: (subject) => {
      setEditingSubject(subject);
      setFormName(subject.name);
      setFormCode(subject.code);
      setFormGradeId(subject.gradeId);
      setFormYearId(subject.academicYearId);
      setFormDescription(subject.description ?? "");
      setDialogOpen(true);
    },
    onDelete: (subject) => {
      setPendingDelete({
        id: subject.id,
        title: `${subject.name} (${subject.code})`,
        description: "This cannot be undone if there are teacher assignments linked to this subject.",
      });
    },
  });

  // ── Form handlers ───────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setEditingSubject(null);
    setFormName("");
    setFormCode("");
    setFormGradeId("");
    setFormYearId(academicYears?.find((y) => y.isCurrent)?.id ?? academicYears?.[0]?.id ?? "");
    setFormDescription("");
    setDialogOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCode.trim() || !formGradeId || !formYearId) return;

    setIsSaving(true);
    try {
      if (editingSubject) {
        await updateSubject.mutateAsync({
          id: editingSubject.id,
          data: {
            name: formName.trim(),
            code: formCode.trim(),
            description: formDescription.trim() || undefined,
          },
        });
      } else {
        await createSubject.mutateAsync({
          name: formName.trim(),
          code: formCode.trim(),
          gradeId: formGradeId,
          academicYearId: formYearId,
          description: formDescription.trim() || undefined,
        });
      }
      setDialogOpen(false);
      setEditingSubject(null);
    } catch {
      // Toast handled by mutation
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSubject(null);
  };

  // ── Filter grades by selected academic year ─────────────────────────────
  const filteredGrades = useMemo(() => {
    if (!grades) return [];
    if (!formYearId) return grades;
    return grades.filter((g) => g.academicYearId === formYearId);
  }, [grades, formYearId]);

  // Select options (first item is the null-value placeholder — shown before
  // any selection; `value={state || null}` keeps the real state a "" so null
  // never reaches the backend)
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
  const yearOptions = useMemo(
    () => [
      { label: "Select academic year", value: null as string | null },
      ...(academicYears ?? []).map((y) => ({
        label: formatYearLabel(y),
        value: y.id,
      })),
    ],
    [academicYears],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* ═════════════════════════════════════════════════════════════════════
           GRADIENT HERO BANNER
           ═════════════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-br from-emerald-500/[0.04] via-background to-background p-6 sm:p-8">
        {/* Animated decorative blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 size-60 rounded-full bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent blur-3xl animate-[blob_8s_ease-in-out_infinite]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 size-48 rounded-full bg-gradient-to-tr from-emerald-500/5 via-emerald-500/[0.02] to-transparent blur-3xl animate-[blob_10s_ease-in-out_infinite_2s]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/3 top-1/2 size-32 rounded-full bg-gradient-to-b from-emerald-500/5 to-transparent blur-3xl animate-[blob_12s_ease-in-out_infinite_4s]"
        />

        {/* Content */}
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20">
              <BookOpenIcon className="size-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Subjects
              </h1>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground/70">
                Manage subjects offered across grades. Each subject has a unique
                code and can be assigned to teachers.
              </p>
            </div>
          </div>
          <Button
            onClick={handleOpenCreate}
            className="mt-3 shrink-0 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/30 sm:mt-0"
          >
            <PlusIcon className="mr-1.5 size-4" />
            New Subject
          </Button>
        </div>

        {/* ── Stat Cards ──────────────────────────────────────────────────── */}
        {!isLoading && subjects && subjects.length > 0 && (
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={BookOpenIcon}
              label="Total Subjects"
              value={stats.total}
              gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
            <StatCard
              icon={UsersIcon}
              label="Teacher Assignments"
              value={stats.teachers}
              gradient="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <StatCard
              icon={GraduationCapIcon}
              label="Grades Covered"
              value={stats.grades}
              gradient="bg-gradient-to-br from-violet-500 to-violet-600"
            />
            <StatCard
              icon={CalendarRangeIcon}
              label="Academic Years"
              value={stats.uniqueYears}
              gradient="bg-gradient-to-br from-amber-500 to-amber-600"
            />
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
           DATA TABLE SECTION
           ═════════════════════════════════════════════════════════════════════ */}
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-10 rounded-full bg-emerald-500/[0.02] blur-3xl"
        />

        <DataTable
          columns={columns}
          data={subjects ?? []}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
          searchPlaceholder="Search subjects…"
          emptyMessage="No subjects found."
          emptyDescription="Create your first subject to get started."
          pageSize={8}
        />
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
           PREMIUM CREATE/EDIT DIALOG
           ═════════════════════════════════════════════════════════════════════ */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm"
          onClick={handleCloseDialog}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/20 bg-background shadow-2xl shadow-black/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Decorative gradient header strip */}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-500/[0.06] to-transparent"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 size-32 rounded-full bg-gradient-to-br from-emerald-500/10 to-transparent blur-3xl"
            />

            {/* Close button */}
            <button
              type="button"
              onClick={handleCloseDialog}
              aria-label="Close dialog"
              className="absolute right-4 top-4 z-10 flex size-7 items-center justify-center rounded-full text-muted-foreground/40 transition-all duration-200 hover:bg-muted hover:text-foreground"
            >
              <XIcon className="size-4" />
            </button>

            <div className="relative px-6 pb-6 pt-8">
              {/* Header with icon */}
              <div className="mb-6 flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-600 shadow-sm ring-1 ring-emerald-500/10 dark:text-emerald-400">
                  <BookOpenIcon className="size-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">
                    {editingSubject
                      ? "Edit Subject"
                      : "Create Subject"}
                  </h2>
                  <p className="text-xs text-muted-foreground/60">
                    {editingSubject
                      ? `Update the details for "${editingSubject.name} (${editingSubject.code})".`
                      : "Add a new subject to the curriculum."}
                  </p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="s-name"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60"
                    >
                      Subject Name
                    </label>
                    <div className="relative">
                      <BookOpenIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                      <Input
                        id="s-name"
                        type="text"
                        placeholder="e.g. Mathematics"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        required
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-emerald-500/30 focus-visible:ring-2 focus-visible:ring-emerald-500/10"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="s-code"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60"
                    >
                      Subject Code
                    </label>
                    <Input
                      id="s-code"
                      type="text"
                      placeholder="e.g. MATH-101"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                      required
                      className="border-border/30 bg-background/60 backdrop-blur-sm transition-all duration-200 focus-visible:border-emerald-500/30 focus-visible:ring-2 focus-visible:ring-emerald-500/10"
                    />
                  </div>
                </div>

                {/* Grade dropdown (disabled in edit mode — backend does not support reassigning grade) */}
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60"
                  >
                    Grade
                  </label>
                  <div className="relative">
                    <GraduationCapIcon className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground/30" />
                    {editingSubject ? (
                      <div className="flex h-9 w-full items-center rounded-md border border-border/30 bg-muted/30 px-3 pl-9 text-sm text-muted-foreground/60 backdrop-blur-sm">
                        {editingSubject.grade.name} - {editingSubject.grade.section}
                      </div>
                    ) : (
                      <ReusableMultiSelect
                        value={formGradeId}
                        onValueChange={(v) => setFormGradeId(v)}
                        options={gradeOptions}
                        placeholder="Select grade"
                        accent="emerald"
                        triggerClassName="pl-9"
                        emptyMessage={
                          formYearId
                            ? "No grades for this academic year"
                            : "Select an academic year first"
                        }
                      />
                    )}
                  </div>
                </div>

                {/* Academic Year dropdown (disabled in edit mode — backend does not support reassigning year) */}
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60"
                  >
                    Academic Year
                  </label>
                  <div className="relative">
                    <CalendarRangeIcon className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground/30" />
                    {editingSubject ? (
                      <div className="flex h-9 w-full items-center rounded-md border border-border/30 bg-muted/30 px-3 pl-9 text-sm text-muted-foreground/60 backdrop-blur-sm">
                        {editingSubject.academicYear.name}
                      </div>
                    ) : (
                      <ReusableMultiSelect
                        value={formYearId}
                        onValueChange={(v) => {
                          setFormYearId(v);
                          // Reset grade selection when year changes
                          setFormGradeId("");
                        }}
                        options={yearOptions}
                        placeholder="Select academic year"
                        accent="emerald"
                        triggerClassName="pl-9"
                      />
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="s-description"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60"
                  >
                    Description
                  </label>
                  <div className="relative">
                    <FileTextIcon className="pointer-events-none absolute left-3 top-3 z-10 size-4 text-muted-foreground/30" />
                    <Textarea
                      id="s-description"
                      placeholder="Brief description of the subject…"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      rows={3}
                      className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-emerald-500/30 focus-visible:ring-2 focus-visible:ring-emerald-500/10"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3">
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/30"
                  >
                    {isSaving ? (
                      <span className="inline-flex items-center gap-2">
                        <SparklesIcon className="size-4 animate-pulse" />
                        Saving…
                      </span>
                    ) : editingSubject ? (
                      "Update Subject"
                    ) : (
                      "Create Subject"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseDialog}
                    disabled={isSaving}
                    className="border-border/30"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
           DELETE CONFIRMATION DIALOG
           ═════════════════════════════════════════════════════════════════════ */}
      <DeleteConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Delete "${pendingDelete?.title}"?`}
        description={pendingDelete?.description ?? ""}
        onConfirm={() => {
          if (pendingDelete) deleteSubject.mutate(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
