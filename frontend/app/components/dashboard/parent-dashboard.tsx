/**
 * parent-dashboard — Dashboard for PARENT roles.
 *
 * Shows the parent's linked children with their grade and live fee-bill
 * status, plus quick links to payments/invoices. Data comes from
 * GET /api/payments/my (children + bills) and GET /api/timetable/my.
 *
 * Design ("Aura v2" — rose/emerald theme).
 */

import { useMemo } from "react";
import { Link } from "react-router";
import {
  UsersRoundIcon,
  GraduationCapIcon,
  WalletIcon,
  CheckCircle2Icon,
  ReceiptTextIcon,
  ArrowRightIcon,
  HeartIcon,
  CreditCardIcon,
  FileTextIcon,
  RefreshCwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/globals/loader";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  useMyPayments,
  type StudentBills,
} from "@/lib/hooks/use-payments";
import { authClient } from "@/lib/auth-client";
import { cn, formatCurrency } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Fee bill status badge */
function FeeStatusBadge({ status }: { status: string }) {
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
  }[status as "PAID" | "PARTIALLY_PAID" | "UNPAID"];

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

// ─── Child Card ─────────────────────────────────────────────────────────────

function ChildCard({ child }: { child: StudentBills }) {
  const totalDue = child.bills.reduce(
    (sum, b) => sum + Math.max(Number(b.amount) - Number(b.paidAmount), 0),
    0,
  );
  const unpaid = child.bills.filter((b) => b.status !== "PAID").length;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-b from-background/80 to-background/40 shadow-sm shadow-black/[0.02] backdrop-blur-sm transition-all duration-300 hover:border-border/30 hover:shadow-md hover:shadow-black/[0.04]">
      {/* Child header */}
      <div className="flex items-center justify-between gap-3 border-b border-border/10 bg-gradient-to-r from-rose-500/[0.04] to-transparent px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/20 to-rose-500/5 text-rose-600 shadow-sm ring-1 ring-rose-500/10 dark:text-rose-400">
            <GraduationCapIcon className="size-4.5" />
          </span>
          <div>
            <p className="font-semibold text-foreground">{child.studentName}</p>
            <p className="text-[11px] text-muted-foreground/50">
              {child.grade.name} - {child.grade.section} · {child.academicYear}
            </p>
          </div>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground/40">
          {child.admissionNumber}
        </span>
      </div>

      {/* Bills */}
      <div className="space-y-2 p-4">
        {child.bills.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/20 px-4 py-6 text-center text-xs text-muted-foreground/50">
            No fee structures configured for this grade yet.
          </p>
        ) : (
          child.bills.map((bill) => {
            const remaining = Math.max(
              Number(bill.amount) - Number(bill.paidAmount),
              0,
            );
            return (
              <div
                key={bill.feeStructureId}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/15 bg-background/50 px-3.5 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="text-sm font-medium text-foreground">
                    {bill.term}
                  </span>
                  <FeeStatusBadge status={bill.status} />
                </div>
                <div className="shrink-0 text-right">
                  <span className="block text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(bill.amount)}
                  </span>
                  {remaining > 0 && (
                    <span className="text-[10px] text-muted-foreground/40">
                      {formatCurrency(remaining)} due
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Link
            to={`/dashboard/payments?studentProfileId=${child.studentProfileId}`}
            className="flex-1"
          >
            <Button
              size="sm"
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/30"
            >
              <CreditCardIcon className="mr-1.5 size-3.5" />
              Pay Fees
            </Button>
          </Link>
          <Link to="/dashboard/invoices" className="flex-1">
            <Button
              size="sm"
              variant="outline"
              className="w-full border-border/30 text-muted-foreground hover:text-foreground"
            >
              <FileTextIcon className="mr-1.5 size-3.5" />
              Invoices
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────

export function ParentDashboard() {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const firstName = user?.name?.split(" ")[0] ?? "Parent";

  const {
    data: myPayments,
    isLoading,
    isError,
    refetch,
  } = useMyPayments();

  const children = myPayments?.students ?? [];

  const stats = useMemo(() => {
    const allBills = children.flatMap((c) => c.bills);
    return {
      children: children.length,
      bills: allBills.length,
      unpaid: allBills.filter((b) => b.status !== "PAID").length,
      totalDue: allBills.reduce(
        (sum, b) =>
          sum + Math.max(Number(b.amount) - Number(b.paidAmount), 0),
        0,
      ),
    };
  }, [children]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* ═══════════════════════════════════════════════════════════════════
           HERO BANNER
           ═══════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-br from-rose-500/[0.05] via-background to-background p-6 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 size-60 rounded-full bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent blur-3xl animate-[blob_8s_ease-in-out_infinite]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 size-48 rounded-full bg-gradient-to-tr from-emerald-500/5 via-emerald-500/[0.02] to-transparent blur-3xl animate-[blob_10s_ease-in-out_infinite_2s]"
        />

        <div className="relative flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/20">
            <HeartIcon className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Welcome back, {firstName}
            </h1>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground/70">
              Keep up with your children's school fees, invoices, and
              assignments — all in one place.
            </p>
            <p className="mt-3 text-xs text-muted-foreground/50">
              {stats.children > 0
                ? `Linked to ${stats.children} student${stats.children > 1 ? "s" : ""}`
                : "No children linked to your account yet."}
            </p>
          </div>
        </div>

        {/* ── Stat cards ─────────────────────────────────────────────── */}
        {!isLoading && children.length > 0 && (
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={UsersRoundIcon}
              label="Children"
              value={stats.children}
              gradient="bg-gradient-to-br from-rose-500 to-rose-600"
            />
            <StatCard
              icon={ReceiptTextIcon}
              label="Fee Items"
              value={stats.bills}
              gradient="bg-gradient-to-br from-violet-500 to-violet-600"
            />
            <StatCard
              icon={WalletIcon}
              label="Outstanding"
              value={stats.unpaid}
              gradient="bg-gradient-to-br from-amber-500 to-amber-600"
            />
            <StatCard
              icon={CheckCircle2Icon}
              label="Total Due"
              value={formatCurrency(stats.totalDue)}
              gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           CHILDREN
           ═══════════════════════════════════════════════════════════════ */}
      {isLoading ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-border/30 bg-gradient-to-b from-background/80 to-background/40 backdrop-blur-sm">
          <Loader variant="page" size="md" text="Loading your children…" />
        </div>
      ) : isError ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-2xl border border-destructive/15 bg-destructive/[0.03] p-8 text-center">
          <RefreshCwIcon className="size-10 text-destructive/50" />
          <p className="text-sm font-medium text-destructive">
            Failed to load your children's information.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try Again
          </Button>
        </div>
      ) : children.length === 0 ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/25 p-10 text-center">
          <UsersRoundIcon className="size-12 text-muted-foreground/20" />
          <p className="text-sm font-medium text-muted-foreground/80">
            No children linked
          </p>
          <p className="max-w-sm text-xs text-muted-foreground/50">
            Ask the school to link your account to your children's profiles.
            Once linked, their fees and assignments will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {children.map((child) => (
            <ChildCard key={child.studentProfileId} child={child} />
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
           QUICK LINKS
           ═══════════════════════════════════════════════════════════════ */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          to="/dashboard/payments"
          className="group flex items-center gap-3 rounded-2xl border border-border/20 bg-gradient-to-b from-background/80 to-background/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/20 hover:shadow-md"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 text-emerald-600 ring-1 ring-emerald-500/10 dark:text-emerald-400">
            <CreditCardIcon className="size-4.5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Payments</p>
            <p className="text-[11px] text-muted-foreground/50">
              Pay fees securely via Stripe
            </p>
          </div>
          <ArrowRightIcon className="size-4 text-muted-foreground/30 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-emerald-600" />
        </Link>
        <Link
          to="/dashboard/invoices"
          className="group flex items-center gap-3 rounded-2xl border border-border/20 bg-gradient-to-b from-background/80 to-background/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-500/20 hover:shadow-md"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500/15 to-teal-500/5 text-teal-600 ring-1 ring-teal-500/10 dark:text-teal-400">
            <FileTextIcon className="size-4.5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Invoices</p>
            <p className="text-[11px] text-muted-foreground/50">
              View invoices and payment history
            </p>
          </div>
          <ArrowRightIcon className="size-4 text-muted-foreground/30 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-teal-600" />
        </Link>
        <Link
          to="/dashboard/assignments"
          className="group flex items-center gap-3 rounded-2xl border border-border/20 bg-gradient-to-b from-background/80 to-background/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-500/20 hover:shadow-md"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/15 to-violet-500/5 text-violet-600 ring-1 ring-violet-500/10 dark:text-violet-400">
            <ReceiptTextIcon className="size-4.5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Assignments</p>
            <p className="text-[11px] text-muted-foreground/50">
              Track your children's work
            </p>
          </div>
          <ArrowRightIcon className="size-4 text-muted-foreground/30 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-violet-600" />
        </Link>
      </div>
    </div>
  );
}
