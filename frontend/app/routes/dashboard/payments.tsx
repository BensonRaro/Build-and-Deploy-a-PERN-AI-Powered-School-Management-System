/**
 * Payments Page — /dashboard/payments
 *
 * Role-aware school-fee payment hub backed by Stripe Checkout.
 *
 * - STUDENT / PARENT: see fee bills (per term) for their grade / children with
 *   live status (UNPAID / PARTIALLY_PAID / PAID) and a "Pay" button that
 *   starts a Stripe Checkout session (POST /api/payments/checkout).
 * - Management (SUPER_ADMIN / PRINCIPAL / VICE_PRINCIPAL / ACCOUNTANT): full
 *   payments ledger table.
 *
 * Design ("Aura v2" — indigo finance variant): gradient hero, stat cards,
 * per-student bill cards with status badges, and hover micro-interactions.
 */

import { useState, useMemo, useEffect } from "react";
import {
  useSearchParams,
} from "react-router";
import {
  CreditCardIcon,
  GraduationCapIcon,
  CalendarRangeIcon,
  DollarSignIcon,
  CheckCircle2Icon,
  LockIcon,
  ArrowRightIcon,
  ReceiptTextIcon,
  SparklesIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/globals/data-table";
import { buildPaymentColumns } from "@/components/payments/columns";
import {
  useMyPayments,
  usePaymentsLedger,
  useCreateCheckout,
  type StudentBills,
  type FeeBill,
} from "@/lib/hooks/use-payments";
import { authClient } from "@/lib/auth-client";
import { cn, formatCurrency } from "@/lib/utils";
import type { Route } from "./+types/payments";

// ─── Roles ──────────────────────────────────────────────────────────────────

const LEDGER_ROLES = ["SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "ACCOUNTANT"];

// ─── Status Badge ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FeeBill["status"] }) {
  const config = {
    PAID: {
      label: "Paid",
      className:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      dot: "bg-emerald-500",
    },
    PARTIALLY_PAID: {
      label: "Partially Paid",
      className:
        "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      dot: "bg-amber-500",
    },
    UNPAID: {
      label: "Unpaid",
      className:
        "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
      dot: "bg-rose-500",
    },
  }[status];

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 border font-medium normal-case tracking-normal",
        config.className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", config.dot)} />
      {config.label}
    </Badge>
  );
}

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

// ─── Bill Row (per fee) ─────────────────────────────────────────────────────

function BillRow({
  bill,
  onPay,
  paying,
}: {
  bill: FeeBill;
  onPay: (bill: FeeBill) => void;
  paying: boolean;
}) {
  const isPaid = bill.status === "PAID";
  const remaining = Math.max(Number(bill.amount) - Number(bill.paidAmount), 0);

  return (
    <div className="group flex flex-col gap-3 rounded-xl border border-border/15 bg-background/50 p-4 transition-all duration-200 hover:border-indigo-500/20 hover:bg-indigo-500/[0.02] sm:flex-row sm:items-center sm:justify-between">
      {/* Left: term + amount */}
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/[0.02] transition-colors duration-200",
            isPaid
              ? "bg-gradient-to-br from-emerald-500 to-emerald-600"
              : "bg-gradient-to-br from-indigo-500 to-indigo-600",
          )}
        >
          {isPaid ? (
            <CheckCircle2Icon className="size-4.5 text-white" />
          ) : (
            <ReceiptTextIcon className="size-4.5 text-white" />
          )}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-foreground">
              {bill.term}
            </span>
            <StatusBadge status={bill.status} />
          </div>
          <span className="text-[11px] text-muted-foreground/40">
            {bill.payments.length > 0
              ? `${bill.payments.length} payment${bill.payments.length > 1 ? "s" : ""} recorded`
              : "No payments yet"}
          </span>
        </div>
      </div>

      {/* Right: amounts + pay button */}
      <div className="flex items-center gap-4 sm:shrink-0">
        <div className="text-right">
          <span className="block text-base font-bold tracking-tight text-foreground">
            {formatCurrency(bill.amount)}
          </span>
          {Number(bill.paidAmount) > 0 && (
            <span className="block text-[11px] text-muted-foreground/50">
              {formatCurrency(Number(bill.amount) - remaining)} paid ·{" "}
              {formatCurrency(remaining)} due
            </span>
          )}
        </div>
        {isPaid ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <LockIcon className="size-3.5" />
            Settled
          </span>
        ) : (
          <Button
            onClick={() => onPay(bill)}
            disabled={paying}
            className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/30 disabled:opacity-60"
          >
            {paying ? (
              <SparklesIcon className="size-4 animate-pulse" />
            ) : (
              <>
                Pay {formatCurrency(remaining)}
                <ArrowRightIcon className="ml-1 size-3.5" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Student Card (parent sees several; student sees one) ───────────────────

function StudentCard({
  student,
  onPay,
  payingFeeId,
}: {
  student: StudentBills;
  onPay: (bill: FeeBill, student: StudentBills) => void;
  payingFeeId: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-b from-background/80 to-background/40 shadow-sm shadow-black/[0.02] backdrop-blur-sm transition-all duration-300 hover:border-border/30 hover:shadow-md hover:shadow-black/[0.04]">
      {/* Student header */}
      <div className="flex items-center justify-between gap-3 border-b border-border/15 bg-gradient-to-r from-indigo-500/[0.04] to-transparent px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 text-indigo-600 shadow-sm ring-1 ring-indigo-500/10 dark:text-indigo-400">
            <GraduationCapIcon className="size-4.5" />
          </span>
          <div>
            <p className="font-semibold text-foreground">{student.studentName}</p>
            <p className="text-[11px] text-muted-foreground/50">
              {student.grade.name} - {student.grade.section} ·{" "}
              {student.academicYear}
            </p>
          </div>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground/40">
          {student.admissionNumber}
        </span>
      </div>

      {/* Bills */}
      <div className="space-y-2.5 p-4">
        {student.bills.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/20 py-8 text-center">
            <ReceiptTextIcon className="size-8 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground/60">
              No fee structures configured for this grade yet.
            </p>
          </div>
        ) : (
          student.bills.map((bill) => (
            <BillRow
              key={bill.feeStructureId}
              bill={bill}
              paying={payingFeeId === bill.feeStructureId}
              onPay={() => onPay(bill, student)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Meta ────────────────────────────────────────────────────────────────────

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Payments — Biasly" },
    {
      name: "description",
      content:
        "School-fee payment hub — view bills, pay with Stripe, and track payment status.",
    },
  ];
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const { data: session } = authClient.useSession();
  const role = session?.user.role as string | undefined;
  const isLedger = role ? LEDGER_ROLES.includes(role) : false;

  const [searchParams] = useSearchParams();
  const [payingFeeId, setPayingFeeId] = useState<string | null>(null);

  const {
    data: myData,
    isLoading,
    isError,
    refetch,
  } = useMyPayments({ enabled: !isLedger });
  const {
    data: ledger,
    isLoading: ledgerLoading,
    isError: ledgerError,
    refetch: refetchLedger,
  } = usePaymentsLedger();
  const createCheckout = useCreateCheckout();

  // ── Toast on Stripe redirect-back (success / cancelled) ────────────────
  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "success") {
      toast.success("Payment successful", {
        description: "Your school fee payment has been recorded.",
      });
      // Clean the URL so refreshing doesn't re-toast
      const url = new URL(window.location.href);
      url.searchParams.delete("status");
      window.history.replaceState({}, "", url);
    } else if (status === "cancelled") {
      toast.info("Payment cancelled", {
        description: "No charge was made. You can try again anytime.",
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("status");
      window.history.replaceState({}, "", url);
    }
  }, [searchParams]);

  // ── Payment handler ────────────────────────────────────────────────────
  const handlePay = async (bill: FeeBill, student: StudentBills) => {
    setPayingFeeId(bill.feeStructureId);
    try {
      await createCheckout.mutateAsync({
        feeStructureId: bill.feeStructureId,
        studentProfileId: student.studentProfileId,
      });
      // Redirect to Stripe happens inside the hook's onSuccess
    } catch {
      // Toast handled by the hook
    } finally {
      setPayingFeeId(null);
    }
  };

  // ── Aggregate stats ─────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const students = myData?.students ?? [];
    const allBills = students.flatMap((s) => s.bills);
    const totalDue = allBills.reduce((sum, b) => {
      const remaining = Math.max(Number(b.amount) - Number(b.paidAmount), 0);
      return sum + remaining;
    }, 0);
    return {
      students: students.length,
      bills: allBills.length,
      unpaid: allBills.filter((b) => b.status !== "PAID").length,
      totalDue,
    };
  }, [myData]);

  const columns = useMemo(() => buildPaymentColumns(), []);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* ═════════════════════════════════════════════════════════════════
           GRADIENT HERO BANNER
           ═════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-br from-indigo-500/[0.05] via-background to-background p-6 sm:p-8">
        {/* Animated decorative blobs */}
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
              <CreditCardIcon className="size-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Payments
              </h1>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground/70">
                {isLedger
                  ? "Review every school-fee payment recorded across the school."
                  : "Pay your school fees securely with Stripe — powered by the AI school management platform."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-indigo-500/15 bg-indigo-500/[0.04] px-3 py-1.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
            <ShieldCheckIcon className="size-3.5" />
            Secure checkout · Stripe
          </div>
        </div>

        {/* Stat cards (student/parent view) */}
        {!isLedger && !isLoading && myData && myData.students.length > 0 && (
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={GraduationCapIcon}
              label="Students"
              value={stats.students}
              gradient="bg-gradient-to-br from-indigo-500 to-indigo-600"
            />
            <StatCard
              icon={ReceiptTextIcon}
              label="Fee Items"
              value={stats.bills}
              gradient="bg-gradient-to-br from-violet-500 to-violet-600"
            />
            <StatCard
              icon={CalendarRangeIcon}
              label="Outstanding"
              value={stats.unpaid}
              gradient="bg-gradient-to-br from-amber-500 to-amber-600"
            />
            <StatCard
              icon={DollarSignIcon}
              label="Total Due"
              value={formatCurrency(stats.totalDue)}
              gradient="bg-gradient-to-br from-rose-500 to-rose-600"
            />
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════
           CONTENT — ledger (management) or bills (student/parent)
           ═════════════════════════════════════════════════════════════ */}
      {isLedger ? (
        <div className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-10 rounded-full bg-indigo-500/[0.02] blur-3xl"
          />
          <DataTable
            columns={columns}
            data={ledger ?? []}
            isLoading={ledgerLoading}
            isError={ledgerError}
            onRetry={() => refetchLedger()}
            searchPlaceholder="Search students, references…"
            emptyMessage="No payments recorded yet."
            emptyDescription="Payments will appear here once students complete a Stripe checkout."
            pageSize={8}
          />
        </div>
      ) : (
        <div className="space-y-5">
          {isLoading ? (
            <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-border/30 bg-gradient-to-b from-background/80 to-background/40">
              <div className="flex flex-col items-center gap-3 text-muted-foreground/50">
                <SparklesIcon className="size-8 animate-pulse" />
                <p className="text-sm">Loading your fee bills…</p>
              </div>
            </div>
          ) : isError ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-2xl border border-destructive/15 bg-destructive/[0.03] p-8 text-center">
              <p className="text-sm font-medium text-destructive">
                Failed to load payments.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Try Again
              </Button>
            </div>
          ) : myData && myData.students.length > 0 ? (
            myData.students.map((student) => (
              <StudentCard
                key={student.studentProfileId}
                student={student}
                payingFeeId={payingFeeId}
                onPay={handlePay}
              />
            ))
          ) : (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/25 p-10 text-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-muted/30 blur-xl" />
                <CreditCardIcon className="relative size-12 text-muted-foreground/20" />
              </div>
              <p className="text-sm font-medium text-muted-foreground/80">
                No fee bills available
              </p>
              <p className="max-w-sm text-xs text-muted-foreground/50">
                Once the school configures fee structures for your grade, they
                will show up here and you can pay them online.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
