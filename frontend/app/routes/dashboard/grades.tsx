/**
 * Grades Page — /dashboard/grades
 *
 * Design ("Aura v2") — mirrors the Academic Years page:
 * - Gradient hero banner with animated decorative blobs
 * - Live stat cards showing aggregate metrics
 * - Premium DataTable with search, pagination, hover effects
 * - Stunning Dialog for create/edit with gradient header
 */

import { useState, useMemo } from "react";
import {
  PlusIcon,
  GraduationCapIcon,
  UsersIcon,
  BookOpenIcon,
  CalendarRangeIcon,
  XIcon,
  SparklesIcon,
  MapPinIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReusableMultiSelect } from "@/components/globals/ReusableMultiSelect";
import { DataTable } from "@/components/globals/data-table";
import { buildGradeColumns } from "@/components/grades/columns";
import {
  useGrades,
  useCreateGrade,
  useUpdateGrade,
  useDeleteGrade,
  type Grade,
} from "@/lib/hooks/use-grades";
import { DeleteConfirmDialog } from "@/components/globals/delete-confirm-dialog";
import { cn } from "@/lib/utils";

// Re-export for file consistency — these are in use-grades.ts but we also need academic years
import { useAcademicYears as fetchAcademicYears, type AcademicYear } from "@/lib/hooks/use-academic-years";
import type { Route } from "./+types/grades";

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
    { title: "Grades — Biasly" },
    {
      name: "description",
      content:
        "Manage school grades and classes — create, edit, and organize grade levels.",
    },
  ];
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function GradesPage() {
  // ── Queries & Mutations ──────────────────────────────────────────────────
  const { data: grades, isLoading, isError, refetch } = useGrades();
  const { data: academicYears } = fetchAcademicYears();
  const createGrade = useCreateGrade();
  const updateGrade = useUpdateGrade();
  const deleteGrade = useDeleteGrade();

  // ── Dialog form state ────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [formName, setFormName] = useState("");
  const [formSection, setFormSection] = useState("");
  const [formYearId, setFormYearId] = useState("");
  const [formRoom, setFormRoom] = useState("");
  const [formCapacity, setFormCapacity] = useState(30);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string; description: string } | null>(null);

  // Select options (first item is the null-value placeholder — shown before
  // any selection; `value={state || null}` keeps the real state a "" so null
  // never reaches the backend)
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

  // ── Aggregate stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!grades)
      return { total: 0, students: 0, subjects: 0, avgCapacity: 0 };
    const total = grades.length;
    const students = grades.reduce((s, g) => s + g._count.students, 0);
    const subjects = grades.reduce((s, g) => s + g._count.subjects, 0);
    const avgCapacity = total > 0
      ? Math.round(grades.reduce((s, g) => s + g.capacity, 0) / total)
      : 0;
    return { total, students, subjects, avgCapacity };
  }, [grades]);

  // ── Column definitions ──────────────────────────────────────────────────
  const columns = buildGradeColumns({
    onEdit: (grade) => {
      setEditingGrade(grade);
      setFormName(grade.name);
      setFormSection(grade.section);
      setFormYearId(grade.academicYearId);
      setFormRoom(grade.roomNumber ?? "");
      setFormCapacity(grade.capacity);
      setDialogOpen(true);
    },
    onDelete: (grade) => {
      setPendingDelete({
        id: grade.id,
        title: `${grade.name} - ${grade.section}`,
        description: "This cannot be undone if there are students, subjects, or fee structures linked to this grade.",
      });
    },
  });

  // ── Form handlers ───────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setEditingGrade(null);
    setFormName("");
    setFormSection("");
    setFormYearId(academicYears?.find((y) => y.isCurrent)?.id ?? academicYears?.[0]?.id ?? "");
    setFormRoom("");
    setFormCapacity(30);
    setDialogOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSection.trim() || !formYearId) return;

    setIsSaving(true);
    try {
      if (editingGrade) {
        await updateGrade.mutateAsync({
          id: editingGrade.id,
          data: {
            name: formName.trim(),
            section: formSection.trim(),
            academicYearId: formYearId,
            roomNumber: formRoom.trim() || undefined,
            capacity: formCapacity,
          },
        });
      } else {
        await createGrade.mutateAsync({
          name: formName.trim(),
          section: formSection.trim(),
          academicYearId: formYearId,
          roomNumber: formRoom.trim() || undefined,
          capacity: formCapacity,
        });
      }
      setDialogOpen(false);
      setEditingGrade(null);
    } catch {
      // Toast handled by mutation
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingGrade(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* ═════════════════════════════════════════════════════════════════════
           GRADIENT HERO BANNER
           ═════════════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-br from-violet-500/[0.04] via-background to-background p-6 sm:p-8">
        {/* Animated decorative blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 size-60 rounded-full bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent blur-3xl animate-[blob_8s_ease-in-out_infinite]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 size-48 rounded-full bg-gradient-to-tr from-violet-500/5 via-violet-500/[0.02] to-transparent blur-3xl animate-[blob_10s_ease-in-out_infinite_2s]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/3 top-1/2 size-32 rounded-full bg-gradient-to-b from-violet-500/5 to-transparent blur-3xl animate-[blob_12s_ease-in-out_infinite_4s]"
        />

        {/* Content */}
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/20">
              <GraduationCapIcon className="size-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Grades
              </h1>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground/70">
                Manage grade levels and class sections. Organize students,
                subjects, and fee structures by grade.
              </p>
            </div>
          </div>
          <Button
            onClick={handleOpenCreate}
            className="mt-3 shrink-0 bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-md shadow-violet-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/30 sm:mt-0"
          >
            <PlusIcon className="mr-1.5 size-4" />
            New Grade
          </Button>
        </div>

        {/* ── Stat Cards ──────────────────────────────────────────────────── */}
        {!isLoading && grades && grades.length > 0 && (
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={GraduationCapIcon}
              label="Total Grades"
              value={stats.total}
              gradient="bg-gradient-to-br from-violet-500 to-violet-600"
            />
            <StatCard
              icon={UsersIcon}
              label="Total Students"
              value={stats.students}
              gradient="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <StatCard
              icon={BookOpenIcon}
              label="Total Subjects"
              value={stats.subjects}
              gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
            <StatCard
              icon={CalendarRangeIcon}
              label="Avg Capacity"
              value={stats.avgCapacity}
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
          className="pointer-events-none absolute -inset-10 rounded-full bg-violet-500/[0.02] blur-3xl"
        />

        <DataTable
          columns={columns}
          data={grades ?? []}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
          searchPlaceholder="Search grades…"
          emptyMessage="No grades found."
          emptyDescription="Create your first grade to get started."
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
              className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-violet-500/[0.06] to-transparent"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 size-32 rounded-full bg-gradient-to-br from-violet-500/10 to-transparent blur-3xl"
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
                <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 text-violet-600 shadow-sm ring-1 ring-violet-500/10 dark:text-violet-400">
                  <GraduationCapIcon className="size-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">
                    {editingGrade
                      ? "Edit Grade"
                      : "Create Grade"}
                  </h2>
                  <p className="text-xs text-muted-foreground/60">
                    {editingGrade
                      ? `Update the details for "${editingGrade.name} - ${editingGrade.section}".`
                      : "Add a new grade level to the school."}
                  </p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="g-name"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60"
                    >
                      Grade Name
                    </label>
                    <div className="relative">
                      <GraduationCapIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                      <Input
                        id="g-name"
                        type="text"
                        placeholder="e.g. Grade 10"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        required
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-violet-500/30 focus-visible:ring-2 focus-visible:ring-violet-500/10"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="g-section"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60"
                    >
                      Section
                    </label>
                    <div className="relative">
                      <UsersIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                      <Input
                        id="g-section"
                        type="text"
                        placeholder="e.g. Alpha"
                        value={formSection}
                        onChange={(e) => setFormSection(e.target.value)}
                        required
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-violet-500/30 focus-visible:ring-2 focus-visible:ring-violet-500/10"
                      />
                    </div>
                  </div>
                </div>

                {/* Academic Year dropdown */}
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60"
                  >
                    Academic Year
                  </label>
                  <ReusableMultiSelect
                    value={formYearId}
                    onValueChange={(v) => setFormYearId(v)}
                    options={yearOptions}
                    placeholder="Select academic year"
                    icon={CalendarRangeIcon}
                    accent="violet"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="g-room"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60"
                    >
                      Room Number
                    </label>
                    <div className="relative">
                      <MapPinIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                      <Input
                        id="g-room"
                        type="text"
                        placeholder="e.g. B-201"
                        value={formRoom}
                        onChange={(e) => setFormRoom(e.target.value)}
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-violet-500/30 focus-visible:ring-2 focus-visible:ring-violet-500/10"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="g-capacity"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60"
                    >
                      Capacity
                    </label>
                    <Input
                      id="g-capacity"
                      type="number"
                      min={1}
                      value={formCapacity}
                      onChange={(e) => setFormCapacity(Number(e.target.value))}
                      required
                      className="border-border/30 bg-background/60 backdrop-blur-sm transition-all duration-200 focus-visible:border-violet-500/30 focus-visible:ring-2 focus-visible:ring-violet-500/10"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3">
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-md shadow-violet-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/30"
                  >
                    {isSaving ? (
                      <span className="inline-flex items-center gap-2">
                        <SparklesIcon className="size-4 animate-pulse" />
                        Saving…
                      </span>
                    ) : editingGrade ? (
                      "Update Grade"
                    ) : (
                      "Create Grade"
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
          if (pendingDelete) deleteGrade.mutate(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
