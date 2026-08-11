/**
 * Academic Years Page — /dashboard/academic-years
 *
 * Design ("Aura v2"):
 * - Gradient hero banner with animated decorative blobs
 * - Live stat cards showing aggregate metrics
 * - Premium glass-morphism DataTable integration
 * - Stunning shadcn Dialog for create/edit with gradient header
 * - Micro-interactions throughout (hover lifts, glow effects, transitions)
 */

import { useState, useMemo } from "react";
import {
  PlusIcon,
  GraduationCapIcon,
  CalendarRangeIcon,
  BookOpenIcon,
  UsersIcon,
  CalendarIcon,
  XIcon,
  SparklesIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/globals/data-table";
import { buildAcademicYearColumns } from "@/components/academic-years/columns";
import { TermsSheet } from "@/components/academic-years/terms-sheet";
import {
  useAcademicYears,
  useCreateAcademicYear,
  useUpdateAcademicYear,
  useDeleteAcademicYear,
  type AcademicYear,
} from "@/lib/hooks/use-academic-years";
import { format, parseISO } from "date-fns";
import { DeleteConfirmDialog } from "@/components/globals/delete-confirm-dialog";
import { cn } from "@/lib/utils";
import type { Route } from "./+types/academic-years";

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
      {/* Decorative gradient blob */}
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
    { title: "Academic Years — Biasly" },
    {
      name: "description",
      content:
        "Manage school academic years and their terms — create, edit, and track the school calendar with live stats.",
    },
  ];
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AcademicYearsPage() {
  // ── Queries & Mutations ──────────────────────────────────────────────────
  const { data: years, isLoading, isError, refetch } = useAcademicYears();
  const createYear = useCreateAcademicYear();
  const updateYear = useUpdateAcademicYear();
  const deleteYear = useDeleteAcademicYear();

  // ── Local state ──────────────────────────────────────────────────────────
  const [selectedYear, setSelectedYear] = useState<AcademicYear | null>(null);
  const [termsSheetOpen, setTermsSheetOpen] = useState(false);

  // ── Dialog form state ────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [formName, setFormName] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formIsCurrent, setFormIsCurrent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string; description: string } | null>(null);

  // ── Aggregate stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!years) return { total: 0, terms: 0, grades: 0, students: 0 };
    return {
      total: years.length,
      terms: years.reduce((sum, y) => sum + y._count.terms, 0),
      grades: years.reduce((sum, y) => sum + y._count.gradees, 0),
      students: years.reduce((sum, y) => sum + y._count.students, 0),
      current: years.filter((y) => y.isCurrent).length,
    };
  }, [years]);

  // ── Column definitions ──────────────────────────────────────────────────
  const columns = buildAcademicYearColumns({
    onViewTerms: (year) => {
      setSelectedYear(year);
      setTermsSheetOpen(true);
    },
    onEdit: (year) => {
      setEditingYear(year);
      setFormName(year.name);
      setFormStart(format(parseISO(year.startDate), "yyyy-MM-dd"));
      setFormEnd(format(parseISO(year.endDate), "yyyy-MM-dd"));
      setFormIsCurrent(year.isCurrent);
      setDialogOpen(true);
    },
    onDelete: (year) => {
      setPendingDelete({
        id: year.id,
        title: year.name,
        description: "This action cannot be undone if the year has no terms, grades, subjects, or students associated with it.",
      });
    },
  });

  // ── Form handlers ───────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setEditingYear(null);
    setFormName("");
    setFormStart("");
    setFormEnd("");
    setFormIsCurrent(false);
    setDialogOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formStart || !formEnd) return;
    if (new Date(formStart) >= new Date(formEnd)) return;

    setIsSaving(true);
    try {
      if (editingYear) {
        await updateYear.mutateAsync({
          id: editingYear.id,
          data: {
            name: formName.trim(),
            startDate: formStart,
            endDate: formEnd,
            isCurrent: formIsCurrent,
          },
        });
      } else {
        await createYear.mutateAsync({
          name: formName.trim(),
          startDate: formStart,
          endDate: formEnd,
          isCurrent: formIsCurrent,
        });
      }
      setDialogOpen(false);
      setEditingYear(null);
    } catch {
      // Toast handled by mutation's onError
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingYear(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* ═════════════════════════════════════════════════════════════════════
           GRADIENT HERO BANNER
           ═════════════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-br from-primary/[0.04] via-background to-background p-6 sm:p-8">
        {/* Animated decorative blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 size-60 rounded-full bg-gradient-to-br from-primary/10 via-primary/5 to-transparent blur-3xl animate-[blob_8s_ease-in-out_infinite]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 size-48 rounded-full bg-gradient-to-tr from-primary/5 via-primary/[0.02] to-transparent blur-3xl animate-[blob_10s_ease-in-out_infinite_2s]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/3 top-1/2 size-32 rounded-full bg-gradient-to-b from-primary/5 to-transparent blur-3xl animate-[blob_12s_ease-in-out_infinite_4s]"
        />

        {/* Content */}
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/20">
              <GraduationCapIcon className="size-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Academic Years
              </h1>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground/70">
                Manage academic years and their terms for the school calendar.
                Organize your institution's academic timeline.
              </p>
            </div>
          </div>
          <Button
            onClick={handleOpenCreate}
            className="mt-3 shrink-0 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary/30 sm:mt-0"
          >
            <PlusIcon className="mr-1.5 size-4" />
            New Academic Year
          </Button>
        </div>

        {/* ── Stat Cards ──────────────────────────────────────────────────── */}
        {!isLoading && years && years.length > 0 && (
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={GraduationCapIcon}
              label="Total Years"
              value={stats.total}
              gradient="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <StatCard
              icon={CalendarRangeIcon}
              label="Total Terms"
              value={stats.terms}
              gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
            <StatCard
              icon={BookOpenIcon}
              label="Grades"
              value={stats.grades}
              gradient="bg-gradient-to-br from-violet-500 to-violet-600"
            />
            <StatCard
              icon={UsersIcon}
              label="Students"
              value={stats.students}
              gradient="bg-gradient-to-br from-amber-500 to-amber-600"
            />
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
           DATA TABLE SECTION
           ═════════════════════════════════════════════════════════════════════ */}
      <div className="relative">
        {/* Subtle glow behind the table */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-10 rounded-full bg-primary/[0.02] blur-3xl"
        />

        <DataTable
          columns={columns}
          data={years ?? []}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
          searchPlaceholder="Search academic years…"
          emptyMessage="No academic years found."
          emptyDescription="Create your first academic year to get started."
          pageSize={8}
        />
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
           TERMS SHEET
           ═════════════════════════════════════════════════════════════════════ */}
      <TermsSheet
        academicYear={selectedYear}
        open={termsSheetOpen}
        onOpenChange={(open) => {
          setTermsSheetOpen(open);
          if (!open) setSelectedYear(null);
        }}
      />

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
              className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/[0.06] to-transparent"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 size-32 rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-3xl"
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
                <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-sm ring-1 ring-primary/10">
                  <GraduationCapIcon className="size-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">
                    {editingYear
                      ? "Edit Academic Year"
                      : "Create Academic Year"}
                  </h2>
                  <p className="text-xs text-muted-foreground/60">
                    {editingYear
                      ? `Update the details for "${editingYear.name}".`
                      : "Add a new academic year to the school calendar."}
                  </p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="ay-name"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60"
                  >
                    Year Name
                  </label>
                  <div className="relative">
                    <GraduationCapIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                    <Input
                      id="ay-name"
                      type="text"
                      placeholder="e.g. 2026-2027"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                      className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="ay-start"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60"
                    >
                      Start Date
                    </label>
                    <div className="relative">
                      <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                      <Input
                        id="ay-start"
                        type="date"
                        value={formStart}
                        onChange={(e) => setFormStart(e.target.value)}
                        required
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/10"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="ay-end"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60"
                    >
                      End Date
                    </label>
                    <div className="relative">
                      <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                      <Input
                        id="ay-end"
                        type="date"
                        value={formEnd}
                        onChange={(e) => setFormEnd(e.target.value)}
                        required
                        className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/10"
                      />
                    </div>
                  </div>
                </div>

                {/* Current checkbox as styled card */}
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/20 bg-muted/20 p-3 transition-all duration-200 hover:bg-muted/40">
                  <div className="relative">
                    <input
                      id="ay-is-current"
                      type="checkbox"
                      checked={formIsCurrent}
                      onChange={(e) => setFormIsCurrent(e.target.checked)}
                      className="size-4 rounded border-border/40 text-primary focus:ring-primary/30 focus:ring-offset-0"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground/80">
                      Set as current academic year
                    </span>
                    <span className="text-xs text-muted-foreground/50">
                      Marks this year as the active academic period
                    </span>
                  </div>
                </label>

                <div className="flex items-center gap-2 pt-3">
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary/30"
                  >
                    {isSaving ? (
                      <span className="inline-flex items-center gap-2">
                        <SparklesIcon className="size-4 animate-pulse" />
                        Saving…
                      </span>
                    ) : editingYear ? (
                      "Update Year"
                    ) : (
                      "Create Year"
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
          if (pendingDelete) deleteYear.mutate(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
