/**
 * Invoices Page — /dashboard/invoices
 *
 * School-fee invoice management hub backed by GET /api/invoices (+ /my).
 *
 * - Management (SUPER_ADMIN / PRINCIPAL / VICE_PRINCIPAL / ACCOUNTANT): full
 *   invoice list with status + academic-year filters and scoped totals.
 * - PARENT / STUDENT: their own (or their children's) invoices, read-only.
 *
 * Every row opens a detail dialog with the full per-invoice breakdown:
 * billed items per term, every payment (method / reference / recorder),
 * and a live payment-progress bar.
 *
 * Design ("Aura v2" — teal finance variant): gradient hero with animated
 * blobs, live stat cards, segmented status filter, premium glass DataTable.
 */

import { useState, useMemo, useEffect } from "react";
import {
  FileTextIcon,
  ReceiptTextIcon,
  DollarSignIcon,
  CreditCardIcon,
  WalletIcon,
  CalendarRangeIcon,
  FilterIcon,
  XIcon,
  CheckCircle2Icon,
  ShieldCheckIcon,
  ClockIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReusableMultiSelect } from "@/components/globals/ReusableMultiSelect";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/globals/data-table";
import { Loader } from "@/components/globals/loader";
import {
  buildInvoiceColumns,
  InvoiceStatusBadge,
} from "@/components/invoices/columns";
import {
  useInvoices,
  useInvoiceDetail,
  type InvoiceListItem,
  type InvoiceStatus,
} from "@/lib/hooks/use-invoices";
import {
  useAcademicYears,
  type AcademicYear,
} from "@/lib/hooks/use-academic-years";
import { authClient } from "@/lib/auth-client";
import { cn, formatCurrency } from "@/lib/utils";
import type { Route } from "./+types/invoices";

// ─── Roles ──────────────────────────────────────────────────────────────────

const MANAGEMENT_ROLES = ["SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "ACCOUNTANT"];
const VIEWER_ROLES = [...MANAGEMENT_ROLES, "PARENT", "STUDENT"];

// ─── Status filter options ───────────────────────────────────────────────────

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIALLY_PAID", label: "Partially Paid" },
  { value: "PAID", label: "Paid" },
  { value: "CANCELLED", label: "Cancelled" },
];

/** Format an academic year for display with optional (Current) badge */
const formatYearLabel = (year: AcademicYear) =>
  `${year.name}${year.isCurrent ? " (Current)" : ""}`;

/** Formats an ISO date as "Mar 3, 2026" */
const dateLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));

/** Formats a payment method enum value nicely */
const methodLabel = (method: string) =>
  method.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

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
    <div className="group relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-br from-background/90 to-background/40 p-4 shadow-sm shadow-black/[0.02] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-border/30 hover:shadow-md hover:shadow-black/[0.04]">
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

// ─── Detail Dialog: per-invoice payment breakdown ────────────────────────────

function InvoiceDetailDialog({
  invoice,
  onClose,
}: {
  invoice: InvoiceListItem | null;
  onClose: () => void;
}) {
  const { data: detail, isLoading } = useInvoiceDetail(invoice?.id ?? null);
  const data = detail ?? invoice;

  const isOverdue = useMemo(() => {
    if (!data) return false;
    const { dueDate, status } = data;
    return (
      new Date(dueDate) < new Date() &&
      status !== "PAID" &&
      status !== "CANCELLED"
    );
  }, [data]);

  const paidPct =
    data && data.totals.billed > 0
      ? Math.min(Math.round((data.totals.paid / data.totals.billed) * 100), 100)
      : 0;

  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto gap-0 p-0 sm:max-w-2xl">
        {!data ? (
          <div className="flex min-h-[260px] items-center justify-center p-8">
            <Loader variant="page" size="sm" text="Loading invoice…" />
          </div>
        ) : (
          <>
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-t-xl bg-gradient-to-br from-teal-500/[0.07] via-transparent to-transparent px-6 pb-5 pt-6">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-gradient-to-br from-teal-500/10 to-transparent blur-3xl"
              />
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/20">
                    <ReceiptTextIcon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <DialogTitle className="font-mono text-lg tracking-tight">
                      {data.invoiceNumber}
                    </DialogTitle>
                    <DialogDescription className="mt-0.5 flex items-center gap-2">
                      {data.student?.user.name ?? "Unknown student"}
                      {data.student?.grade && (
                        <span className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                          {data.student.grade.name} - {data.student.grade.section}
                        </span>
                      )}
                    </DialogDescription>
                  </div>
                  <InvoiceStatusBadge status={data.status} className="ml-auto" />
                </div>
              </DialogHeader>

              {/* Meta strip */}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Meta label="Academic Year" value={data.academicYear?.name ?? "—"} />
                <Meta
                  label="Created"
                  value={dateLabel(data.createdAt)}
                />
                <Meta
                  label="Due Date"
                  value={dateLabel(data.dueDate)}
                  highlight={isOverdue ? "text-rose-600 dark:text-rose-400" : undefined}
                />
                <Meta
                  label="Admission"
                  value={data.student?.admissionNumber ?? "—"}
                  mono
                />
              </div>
              {isOverdue && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-500/15 bg-rose-500/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                  <ClockIcon className="size-3.5" />
                  This invoice is past its due date.
                </p>
              )}
            </div>

            {/* ── Payment progress ──────────────────────────────────────── */}
            <div className="px-6 pt-5">
              <div className="flex items-end justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">
                  Payment Progress
                </p>
                <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
                  {paidPct}%
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-500"
                  style={{ width: `${paidPct}%` }}
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                <ProgressStat
                  label="Billed"
                  value={formatCurrency(data.totals.billed)}
                  tone="text-foreground"
                />
                <ProgressStat
                  label="Paid"
                  value={formatCurrency(data.totals.paid)}
                  tone="text-emerald-600 dark:text-emerald-400"
                />
                <ProgressStat
                  label="Balance"
                  value={formatCurrency(data.totals.balance)}
                  tone={
                    data.totals.balance > 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-muted-foreground/60"
                  }
                />
              </div>
            </div>

            {/* ── Billed items ──────────────────────────────────────────── */}
            <section className="px-6 pt-6">
              <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">
                Billed Items ({data.items.length})
              </h3>
              <div className="overflow-hidden rounded-xl border border-border/15">
                {data.items.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-muted-foreground/50">
                    No items on this invoice.
                  </p>
                ) : (
                  data.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 border-b border-border/10 bg-background/40 px-4 py-3 last:border-b-0"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="size-1.5 rounded-full bg-teal-500/70" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">
                            {item.term?.name ?? "School fee"}
                          </span>
                          {item.grade && (
                            <span className="text-[10px] text-muted-foreground/40">
                              {item.grade.name} - {item.grade.section}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="tabular-nums text-sm font-semibold text-foreground">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* ── Payments breakdown ────────────────────────────────────── */}
            <section className="px-6 py-6">
              <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">
                Payments ({data.payments.length})
              </h3>
              <div className="overflow-hidden rounded-xl border border-border/15">
                {data.payments.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                    <CreditCardIcon className="size-8 text-muted-foreground/20" />
                    <p className="text-sm text-muted-foreground/60">
                      No payments recorded yet.
                    </p>
                    <p className="text-xs text-muted-foreground/40">
                      Payments appear here once a Stripe checkout completes.
                    </p>
                  </div>
                ) : (
                  data.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between gap-3 border-b border-border/10 bg-background/40 px-4 py-3 last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2Icon className="size-4" />
                        </span>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">
                            {dateLabel(payment.paymentDate)}
                          </span>
                          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
                            {methodLabel(payment.paymentMethod)}
                            {payment.referenceNumber && (
                              <>
                                <span className="text-muted-foreground/20">·</span>
                                <span className="font-mono">
                                  {payment.referenceNumber.slice(0, 20)}
                                </span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="block text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(payment.amount)}
                        </span>
                        {payment.recordedBy && (
                          <span className="text-[10px] text-muted-foreground/40">
                            by {payment.recordedBy.name}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Small label/value pair in the dialog header */
function Meta({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: string;
}) {
  return (
    <div className="rounded-xl border border-border/10 bg-background/50 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/40">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate text-sm font-medium text-foreground",
          mono && "font-mono text-xs",
          highlight,
        )}
      >
        {value}
      </p>
    </div>
  );
}

/** Billed / Paid / Balance stat under the progress bar */
function ProgressStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-border/10 bg-background/50 px-2 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/40">
        {label}
      </p>
      <p className={cn("mt-0.5 text-sm font-bold tabular-nums tracking-tight", tone)}>
        {value}
      </p>
    </div>
  );
}

// ─── Meta ────────────────────────────────────────────────────────────────────

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Invoices — Biasly" },
    {
      name: "description",
      content:
        "School-fee invoice hub — per-term billing, payment history, and live payment progress.",
    },
  ];
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const { data: session } = authClient.useSession();
  const role = session?.user.role as string | undefined;
  const isManagement = role ? MANAGEMENT_ROLES.includes(role) : false;
  const canView = role ? VIEWER_ROLES.includes(role) : false;

  // ── Filter state ─────────────────────────────────────────────────────────
  const [status, setStatus] = useState("");
  const [filterYearId, setFilterYearId] = useState("");
  const { data: academicYears } = useAcademicYears();

  // Default the year filter to the current academic year once loaded
  useEffect(() => {
    if (!filterYearId && academicYears && academicYears.length > 0) {
      const current = academicYears.find((y) => y.isCurrent);
      setFilterYearId(current?.id ?? academicYears[0].id);
    }
  }, [academicYears, filterYearId]);

  const filters = useMemo(
    () => ({
      status: status || undefined,
      academicYearId: filterYearId || undefined,
    }),
    [status, filterYearId],
  );

  // Year filter options (null placeholder item shows "All years" before/without selection)
  const yearOptions = useMemo(
    () => [
      { label: "All years", value: null as string | null },
      ...(academicYears ?? []).map((y) => ({
        label: formatYearLabel(y),
        value: y.id,
      })),
    ],
    [academicYears],
  );

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useInvoices(filters, {
    scope: isManagement ? "all" : "mine",
    enabled: canView && !!role,
  });

  // ── Detail dialog state ─────────────────────────────────────────────────
  const [detailInvoice, setDetailInvoice] = useState<InvoiceListItem | null>(
    null,
  );

  const columns = useMemo(
    () => buildInvoiceColumns({ onView: setDetailInvoice }),
    [],
  );

  const statusCounts = data?.totals.statusCounts;
  const countFor = (value: string) => {
    if (!statusCounts) return undefined;
    if (value === "") return data?.totals.count;
    return statusCounts[value as InvoiceStatus];
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* ═══════════════════════════════════════════════════════════════════
           GRADIENT HERO BANNER
           ═══════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-br from-teal-500/[0.05] via-background to-background p-6 sm:p-8">
        {/* Animated decorative blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 size-60 rounded-full bg-gradient-to-br from-teal-500/10 via-teal-500/5 to-transparent blur-3xl animate-[blob_8s_ease-in-out_infinite]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 size-48 rounded-full bg-gradient-to-tr from-cyan-500/5 via-cyan-500/[0.02] to-transparent blur-3xl animate-[blob_10s_ease-in-out_infinite_2s]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/3 top-1/2 size-32 rounded-full bg-gradient-to-b from-teal-500/5 to-transparent blur-3xl animate-[blob_12s_ease-in-out_infinite_4s]"
        />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/20">
              <FileTextIcon className="size-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Invoices
              </h1>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground/70">
                {isManagement
                  ? "Track every fee invoice across the school — who owes, what's paid, and what's outstanding."
                  : "Review your school-fee invoices and payment history at a glance."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-teal-500/15 bg-teal-500/[0.04] px-3 py-1.5 text-[11px] font-medium text-teal-600 dark:text-teal-400">
            <ShieldCheckIcon className="size-3.5" />
            {data?.totals.collectionRate ?? 0}% collected
          </div>
        </div>

        {/* ── Stat Cards ─────────────────────────────────────────────────── */}
        {!isLoading && data && data.totals.count > 0 && (
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={ReceiptTextIcon}
              label="Invoices"
              value={data.totals.count}
              gradient="bg-gradient-to-br from-teal-500 to-cyan-600"
            />
            <StatCard
              icon={DollarSignIcon}
              label="Billed"
              value={formatCurrency(data.totals.billed)}
              gradient="bg-gradient-to-br from-violet-500 to-violet-600"
            />
            <StatCard
              icon={CreditCardIcon}
              label="Collected"
              value={formatCurrency(data.totals.collected)}
              gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
            <StatCard
              icon={WalletIcon}
              label="Outstanding"
              value={formatCurrency(data.totals.outstanding)}
              gradient="bg-gradient-to-br from-rose-500 to-rose-600"
            />
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           FILTER BAR — status + academic year
           ═══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-border/20 bg-gradient-to-b from-background/80 to-background/40 p-4 shadow-sm shadow-black/[0.02] backdrop-blur-sm">
        {/* Status segmented control */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">
            <FilterIcon className="size-3.5" />
            Status
          </span>
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border/20 bg-background/60 p-1 backdrop-blur-sm">
            {STATUS_OPTIONS.map((opt) => {
              const count = countFor(opt.value);
              const active = status === opt.value;
              return (
                <button
                  key={opt.value || "all"}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200",
                    active
                      ? "bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-sm shadow-teal-500/20"
                      : "text-muted-foreground/60 hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  {opt.label}
                  {typeof count === "number" && (
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-px text-[10px] font-bold tabular-nums",
                        active
                          ? "bg-white/20 text-white"
                          : "bg-muted/60 text-muted-foreground/60",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Academic year select */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">
            Academic Year
          </span>
          <ReusableMultiSelect
            value={filterYearId}
            onValueChange={(v) => setFilterYearId(v)}
            options={yearOptions}
            placeholder="All years"
            icon={CalendarRangeIcon}
            accent="teal"
            triggerClassName="min-w-44"
          />
        </div>

        {status && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setStatus("")}
            className="text-muted-foreground/50 hover:text-foreground"
          >
            <XIcon className="mr-1 size-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           DATA TABLE
           ═══════════════════════════════════════════════════════════════ */}
      <div className="relative">
        {/* Subtle glow behind the table */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-10 rounded-full bg-teal-500/[0.02] blur-3xl"
        />

        {!canView ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/25 p-10 text-center">
            <FileTextIcon className="size-12 text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground/80">
              No access to invoices
            </p>
            <p className="max-w-sm text-xs text-muted-foreground/50">
              Only management, parents, and students can view invoices. Contact
              your administrator if you believe this is a mistake.
            </p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={data?.invoices ?? []}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => refetch()}
            searchPlaceholder="Search invoice #, students…"
            emptyMessage="No invoices found."
            emptyDescription={
              status
                ? "Try a different status filter — or clear it to see every invoice."
                : "Invoices are created automatically when a student pays a fee through Stripe Checkout."
            }
            pageSize={8}
          />
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           PER-INVOICE PAYMENT BREAKDOWN DIALOG
           ═══════════════════════════════════════════════════════════════ */}
      <InvoiceDetailDialog
        invoice={detailInvoice}
        onClose={() => setDetailInvoice(null)}
      />
    </div>
  );
}
