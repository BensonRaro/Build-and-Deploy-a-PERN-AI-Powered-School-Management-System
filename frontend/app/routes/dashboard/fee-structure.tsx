/**
 * Fee Structure Page — /dashboard/fee-structure
 *
 * Lets management define the school fees payable by each Grade for every
 * Term (one amount per grade + term). Backed by GET/POST/PATCH/DELETE /api/fees.
 *
 * Design ("Aura v2" — finance variant, mirrors the Academic Years/Grades pages):
 * - Emerald gradient hero banner with animated decorative blobs
 * - Live stat cards (fees, grades covered, terms covered, total amount)
 * - Academic-year scoped filter bar (year → grade → term)
 * - Premium glass DataTable with hover-reveal actions
 * - Stunning create/edit Dialog with gradient header
 * - Role-aware: ACCOUNTANT/PRINCIPAL/SUPER_ADMIN can manage, delete is admin-only
 */

import { useState, useMemo, useEffect } from "react";
import {
  PlusIcon,
  PiggyBankIcon,
  GraduationCapIcon,
  CalendarRangeIcon,
  DollarSignIcon,
  XIcon,
  SparklesIcon,
  FilterIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReusableMultiSelect, type ReusableMultiSelectOption } from "@/components/globals/ReusableMultiSelect";
import { DataTable } from "@/components/globals/data-table";
import { buildFeeColumns } from "@/components/fees/columns";
import {
  useFees,
  useCreateFee,
  useUpdateFee,
  useDeleteFee,
  type Fee,
} from "@/lib/hooks/use-fees";
import {
  useAcademicYears,
  useTerms,
  type AcademicYear,
} from "@/lib/hooks/use-academic-years";
import { useGrades } from "@/lib/hooks/use-grades";
import { DeleteConfirmDialog } from "@/components/globals/delete-confirm-dialog";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import type { Route } from "./+types/fee-structure";

// ─── Roles with write access to fee structures ──────────────────────────────
// Mirrors the backend route guards: POST/PATCH → SUPER_ADMIN, PRINCIPAL,
// ACCOUNTANT; DELETE → SUPER_ADMIN, PRINCIPAL.
const MANAGE_ROLES = ["SUPER_ADMIN", "PRINCIPAL", "ACCOUNTANT"];
const DELETE_ROLES = ["SUPER_ADMIN", "PRINCIPAL"];

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

// ─── Filter Select ──────────────────────────────────────────────────────────

function FilterSelect({
  icon,
  label,
  value,
  onChange,
  placeholder,
  options,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  placeholder: string;
  options: ReusableMultiSelectOption[];
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">
        {label}
      </span>
      <ReusableMultiSelect
        value={value ?? ""}
        onValueChange={onChange}
        options={options}
        placeholder={placeholder}
        icon={icon}
        accent="emerald"
        disabled={disabled}
        triggerClassName="min-w-40 disabled:opacity-50"
      />
    </div>
  );
}

// ─── Meta ────────────────────────────────────────────────────────────────────

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Fee Structure — Biasly" },
    {
      name: "description",
      content:
        "Define school fees per grade and term — the structure that powers billing and invoices.",
    },
  ];
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function FeeStructurePage() {
  // ── Session / role ──────────────────────────────────────────────────────
  const { data: session } = authClient.useSession();
  const role = session?.user.role as string | undefined;
  const canManage = role ? MANAGE_ROLES.includes(role) : false;
  const canDelete = role ? DELETE_ROLES.includes(role) : false;

  // ── Queries & Mutations ──────────────────────────────────────────────────
  const { data: academicYears } = useAcademicYears();
  // Table filter state (academic year → grade → term)
  const [filterYearId, setFilterYearId] = useState("");
  const [filterGradeId, setFilterGradeId] = useState("");
  const [filterTermId, setFilterTermId] = useState("");
  const { data: filterGrades } = useGrades(filterYearId || undefined);
  const { data: filterTerms } = useTerms(filterYearId);
  const { data: fees, isLoading, isError, refetch } = useFees({
    academicYearId: filterYearId || undefined,
    gradeId: filterGradeId || undefined,
    termId: filterTermId || undefined,
  });
  const createFee = useCreateFee();
  const updateFee = useUpdateFee();
  const deleteFee = useDeleteFee();

  // Default the year filter to the current academic year once loaded
  useEffect(() => {
    if (!filterYearId && academicYears && academicYears.length > 0) {
      const current = academicYears.find((y) => y.isCurrent);
      setFilterYearId(current?.id ?? academicYears[0].id);
    }
  }, [academicYears, filterYearId]);

  // Reset grade/term filters whenever the year filter changes
  useEffect(() => {
    setFilterGradeId("");
    setFilterTermId("");
  }, [filterYearId]);

  // ── Dialog form state ────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<Fee | null>(null);
  const [formYearId, setFormYearId] = useState("");
  const [formGradeId, setFormGradeId] = useState("");
  const [formTermId, setFormTermId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    title: string;
    description: string;
  } | null>(null);

  // Grade/term options scoped to the dialog's selected academic year
  const { data: dialogGrades } = useGrades(formYearId || undefined);
  const { data: dialogTerms } = useTerms(formYearId);

  // NOTE: dependent selects (grade/term) are reset inside the year
  // Select's onValueChange — NOT via an effect — so the edit dialog's
  // pre-filled values are never wiped by a state update.

  /** Select handler for the dialog's academic year picker */
  const handleFormYearChange = (value: string) => {
    setFormYearId(value ?? "");
    setFormGradeId("");
    setFormTermId("");
  };

  // ── Aggregate stats (scoped to current filter) ──────────────────────────
  const stats = useMemo(() => {
    if (!fees) return { total: 0, grades: 0, terms: 0, amount: "$0.00" };
    const grades = new Set(fees.map((f) => f.gradeId)).size;
    const terms = new Set(fees.map((f) => f.termId)).size;
    const totalAmount = fees.reduce(
      (sum, f) => sum + (Number(f.amount) || 0),
      0,
    );
    return {
      total: fees.length,
      grades,
      terms,
      amount: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(totalAmount),
    };
  }, [fees]);

  // ── Column definitions ──────────────────────────────────────────────────
  const columns = buildFeeColumns({
    academicYears,
    onEdit: canManage
      ? (fee) => {
          setEditingFee(fee);
          setFormYearId(fee.grade.academicYearId);
          setFormGradeId(fee.gradeId);
          setFormTermId(fee.termId);
          setFormAmount(fee.amount);
          setDialogOpen(true);
        }
      : undefined,
    onDelete: canDelete
      ? (fee) => {
          setPendingDelete({
            id: fee.id,
            title: `${fee.grade.name} — ${fee.term.name}`,
            description:
              "This fee structure will be permanently removed. Deleting is blocked if it has already been used on invoices.",
          });
        }
      : undefined,
  });

  // ── Form handlers ───────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setEditingFee(null);
    setFormYearId(
      academicYears?.find((y) => y.isCurrent)?.id ??
        academicYears?.[0]?.id ??
        "",
    );
    setFormGradeId("");
    setFormTermId("");
    setFormAmount("");
    setDialogOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(formAmount);
    if (!formGradeId || !formTermId || !Number.isFinite(amount) || amount <= 0) {
      return;
    }

    setIsSaving(true);
    try {
      if (editingFee) {
        await updateFee.mutateAsync({
          id: editingFee.id,
          data: { gradeId: formGradeId, termId: formTermId, amount },
        });
      } else {
        await createFee.mutateAsync({
          gradeId: formGradeId,
          termId: formTermId,
          amount,
        });
      }
      setDialogOpen(false);
      setEditingFee(null);
    } catch {
      // Toast handled by mutation's onError
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingFee(null);
  };

  // Dialog select options (first item is the null-value placeholder — shown
  // before any selection; `value={state || null}` keeps the real state a ""
  // so null never reaches the backend)
  const dialogYearOptions = useMemo(
    () => [
      { label: "Select academic year", value: null as string | null },
      ...(academicYears ?? []).map((y) => ({
        label: formatYearLabel(y),
        value: y.id,
      })),
    ],
    [academicYears],
  );
  const dialogGradeOptions = useMemo(
    () => [
      { label: "Select grade", value: null as string | null },
      ...(dialogGrades ?? []).map((g) => ({
        label: `${g.name} - ${g.section}`,
        value: g.id,
      })),
    ],
    [dialogGrades],
  );
  const dialogTermOptions = useMemo(
    () => [
      { label: "Select term", value: null as string | null },
      ...(dialogTerms ?? []).map((t) => ({ label: t.name, value: t.id })),
    ],
    [dialogTerms],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* ═════════════════════════════════════════════════════════════════════
           GRADIENT HERO BANNER
           ═════════════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-br from-emerald-500/[0.05] via-background to-background p-6 sm:p-8">
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
              <PiggyBankIcon className="size-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Fee Structure
              </h1>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground/70">
                Set the school fees payable by each grade for every term.
                Amounts are defined per grade and term — one fee per
                combination.
              </p>
            </div>
          </div>
          {canManage && (
            <Button
              onClick={handleOpenCreate}
              className="mt-3 shrink-0 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/30 sm:mt-0"
            >
              <PlusIcon className="mr-1.5 size-4" />
              New Fee Structure
            </Button>
          )}
        </div>

        {/* ── Stat Cards ──────────────────────────────────────────────────── */}
        {!isLoading && fees && fees.length > 0 && (
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={PiggyBankIcon}
              label="Fee Entries"
              value={stats.total}
              gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
            <StatCard
              icon={GraduationCapIcon}
              label="Grades Covered"
              value={stats.grades}
              gradient="bg-gradient-to-br from-violet-500 to-violet-600"
            />
            <StatCard
              icon={CalendarRangeIcon}
              label="Terms Covered"
              value={stats.terms}
              gradient="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <StatCard
              icon={DollarSignIcon}
              label="Total Amount"
              value={stats.amount}
              gradient="bg-gradient-to-br from-amber-500 to-amber-600"
            />
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
           FILTER BAR
           ═════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/20 bg-gradient-to-b from-background/80 to-background/40 p-4 shadow-sm shadow-black/[0.02] backdrop-blur-sm">
        <div className="flex items-center gap-2 pb-0.5">
          <FilterIcon className="size-4 text-muted-foreground/40" />
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">
            Filters
          </span>
        </div>

        <FilterSelect
          icon={CalendarRangeIcon}
          label="Academic Year"
          value={filterYearId || null}
          onChange={setFilterYearId}
          placeholder="Select year"
          options={(academicYears ?? []).map((year) => ({
            value: year.id,
            label: formatYearLabel(year),
          }))}
        />

        <FilterSelect
          icon={GraduationCapIcon}
          label="Grade"
          value={filterGradeId || null}
          onChange={setFilterGradeId}
          placeholder="All grades"
          disabled={!filterYearId}
          options={(filterGrades ?? []).map((grade) => ({
            value: grade.id,
            label: `${grade.name} - ${grade.section}`,
          }))}
        />

        <FilterSelect
          icon={PiggyBankIcon}
          label="Term"
          value={filterTermId || null}
          onChange={setFilterTermId}
          placeholder="All terms"
          disabled={!filterYearId}
          options={(filterTerms ?? []).map((term) => ({
            value: term.id,
            label: term.name,
          }))}
        />

        {(filterGradeId || filterTermId) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterGradeId("");
              setFilterTermId("");
            }}
            className="text-muted-foreground/50 hover:text-foreground"
          >
            <XIcon className="mr-1 size-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
           DATA TABLE SECTION
           ═════════════════════════════════════════════════════════════════════ */}
      <div className="relative">
        {/* Subtle glow behind the table */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-10 rounded-full bg-emerald-500/[0.02] blur-3xl"
        />

        <DataTable
          columns={columns}
          data={fees ?? []}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
          searchPlaceholder="Search grades, terms…"
          emptyMessage="No fee structures found."
          emptyDescription={
            canManage
              ? "Create your first fee structure to start charging school fees."
              : "No fee structures have been configured yet."
          }
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
              className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-500/[0.07] to-transparent"
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
                  <PiggyBankIcon className="size-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">
                    {editingFee ? "Edit Fee Structure" : "Create Fee Structure"}
                  </h2>
                  <p className="text-xs text-muted-foreground/60">
                    {editingFee
                      ? `Update the fee for "${editingFee.grade.name}" in "${editingFee.term.name}".`
                      : "Set the school fee for a grade within a term."}
                  </p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleFormSubmit} className="space-y-4">
                {/* Academic Year */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Academic Year
                  </label>
                  <ReusableMultiSelect
                    value={formYearId}
                    onValueChange={(v) => handleFormYearChange(v)}
                    options={dialogYearOptions}
                    placeholder="Select academic year"
                    icon={CalendarRangeIcon}
                    accent="emerald"
                  />
                </div>

                {/* Grade + Term */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="fee-grade"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60"
                    >
                      Grade
                    </label>
                    <ReusableMultiSelect
                      id="fee-grade"
                      value={formGradeId}
                      onValueChange={(v) => setFormGradeId(v)}
                      options={dialogGradeOptions}
                      placeholder="Select grade"
                      icon={GraduationCapIcon}
                      accent="emerald"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="fee-term"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60"
                    >
                      Term
                    </label>
                    <ReusableMultiSelect
                      id="fee-term"
                      value={formTermId}
                      onValueChange={(v) => setFormTermId(v)}
                      options={dialogTermOptions}
                      placeholder="Select term"
                      icon={PiggyBankIcon}
                      accent="emerald"
                    />
                  </div>
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="fee-amount"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60"
                  >
                    Amount
                  </label>
                  <div className="relative">
                    <DollarSignIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
                    <Input
                      id="fee-amount"
                      type="number"
                      min={0.01}
                      step="0.01"
                      placeholder="e.g. 250.00"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      required
                      className="border-border/30 bg-background/60 pl-9 backdrop-blur-sm transition-all duration-200 focus-visible:border-emerald-500/30 focus-visible:ring-2 focus-visible:ring-emerald-500/10"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground/40">
                    The fee charged to every student in this grade for the
                    selected term.
                  </p>
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
                    ) : editingFee ? (
                      "Update Fee"
                    ) : (
                      "Create Fee"
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
          if (pendingDelete) deleteFee.mutate(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
