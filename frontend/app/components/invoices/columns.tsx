/**
 * invoices/columns — Column definitions for the invoices table.
 *
 * Design ("Aura v2" — teal finance variant):
 * - Mono invoice number with a receipt icon
 * - Student cell with grade + section chip (mirrors payments/columns)
 * - Term chips showing which fees are billed on the invoice
 * - Billed / Paid / Balance amount columns + status badge
 * - Hover-reveal "View" action to open the payment breakdown
 */

import type { ColumnDef } from "@tanstack/react-table";
import { SortHeader } from "@/components/globals/data-table";
import {
  ReceiptTextIcon,
  UserRoundIcon,
  CalendarDaysIcon,
  EyeIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type InvoiceListItem,
  type InvoiceStatus,
} from "@/lib/hooks/use-invoices";
import { cn, formatCurrency } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Small chip used for grade/labels */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
      {children}
    </span>
  );
}

/** Formats an ISO date as "Mar 3, 2026" */
const dateLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));

// ─── Status Badge ───────────────────────────────────────────────────────────

/** Config per invoice status (color + label + dot) */
const STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; className: string; dot: string }
> = {
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
  CANCELLED: {
    label: "Cancelled",
    className:
      "border-muted-foreground/20 bg-muted/40 text-muted-foreground/70",
    dot: "bg-muted-foreground/40",
  },
};

/** Status pill with a colored dot — shared with the detail dialog */
export function InvoiceStatusBadge({
  status,
  className,
}: {
  status: InvoiceStatus;
  className?: string;
}) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 border font-medium normal-case tracking-normal",
        config.className,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", config.dot)} />
      {config.label}
    </Badge>
  );
}

/** Amount cell with explicit color coding (paid = emerald, due = rose) */
function AmountCell({
  value,
  variant,
}: {
  value: number;
  variant: "billed" | "paid" | "balance";
}) {
  const className =
    variant === "paid"
      ? "text-emerald-600 dark:text-emerald-400"
      : variant === "balance"
        ? value > 0
          ? "text-rose-600 dark:text-rose-400"
          : "text-muted-foreground/50"
        : "text-foreground font-semibold";
  return (
    <span className={cn("tabular-nums tracking-tight", className)}>
      {formatCurrency(value)}
    </span>
  );
}

// ─── Column Builder ─────────────────────────────────────────────────────────

export function buildInvoiceColumns({
  onView,
}: {
  onView: (invoice: InvoiceListItem) => void;
}): ColumnDef<InvoiceListItem>[] {
  return [
    {
      accessorKey: "invoiceNumber",
      size: 160,
      header: ({ column }) => SortHeader("Invoice", { column }),
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500/20 to-teal-500/5 text-teal-600 shadow-sm ring-1 ring-teal-500/10 dark:text-teal-400">
            <ReceiptTextIcon className="size-4" />
          </span>
          <div className="flex flex-col">
            <span className="font-mono text-xs font-semibold tracking-tight text-foreground">
              {row.original.invoiceNumber}
            </span>
            <span className="text-[10px] text-muted-foreground/40">
              {dateLabel(row.original.createdAt)}
            </span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "student.user.name",
      size: 260,
      header: ({ column }) => SortHeader("Student", { column }),
      cell: ({ row }) => {
        const student = row.original.student;
        if (!student) return <span className="text-muted-foreground/50">—</span>;
        return (
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500/20 to-teal-500/5 text-teal-600 shadow-sm ring-1 ring-teal-500/10 dark:text-teal-400">
              <UserRoundIcon className="size-4.5" />
            </span>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  {student.user.name}
                </span>
                {student.grade && (
                  <Chip>
                    {student.grade.name} - {student.grade.section}
                  </Chip>
                )}
              </div>
              <span className="font-mono text-[10px] text-muted-foreground/40">
                {student.admissionNumber}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "academicYear.name",
      size: 110,
      header: ({ column }) => SortHeader("Year", { column }),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.academicYear?.name ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "dueDate",
      size: 130,
      header: ({ column }) => SortHeader("Due Date", { column }),
      cell: ({ row }) => {
        const { dueDate, status } = row.original;
        const overdue =
          new Date(dueDate) < new Date() &&
          status !== "PAID" &&
          status !== "CANCELLED";
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5",
              overdue ? "text-rose-600/90 dark:text-rose-400" : "text-muted-foreground",
            )}
          >
            <CalendarDaysIcon
              className={cn(
                "size-3.5",
                overdue ? "text-rose-500/40" : "text-muted-foreground/30",
              )}
            />
            {dateLabel(dueDate)}
            {overdue && (
              <span className="text-[10px] font-medium uppercase tracking-wider text-rose-500/70">
                Overdue
              </span>
            )}
          </span>
        );
      },
    },
    {
      id: "terms",
      size: 190,
      header: "Terms",
      cell: ({ row }) => {
        const terms = row.original.items
          .map((i) => i.term?.name)
          .filter((t): t is string => !!t);
        const shown = terms.slice(0, 2);
        return (
          <div className="flex flex-wrap items-center gap-1">
            {shown.length === 0 ? (
              <span className="text-muted-foreground/40">—</span>
            ) : (
              shown.map((t) => (
                <Chip key={t}>
                  <span className="normal-case tracking-normal">{t}</span>
                </Chip>
              ))
            )}
            {terms.length > shown.length && (
              <span className="text-[10px] text-muted-foreground/40">
                +{terms.length - shown.length}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "totals.billed",
      size: 110,
      header: ({ column }) => SortHeader("Billed", { column }),
      cell: ({ row }) => (
        <AmountCell variant="billed" value={row.original.totals.billed} />
      ),
    },
    {
      accessorKey: "totals.paid",
      size: 110,
      header: ({ column }) => SortHeader("Paid", { column }),
      cell: ({ row }) => (
        <AmountCell variant="paid" value={row.original.totals.paid} />
      ),
    },
    {
      accessorKey: "totals.balance",
      size: 110,
      header: ({ column }) => SortHeader("Balance", { column }),
      cell: ({ row }) => (
        <AmountCell variant="balance" value={row.original.totals.balance} />
      ),
    },
    {
      accessorKey: "status",
      size: 130,
      header: ({ column }) => SortHeader("Status", { column }),
      cell: ({ row }) => (
        <InvoiceStatusBadge status={row.original.status} />
      ),
    },
    {
      id: "actions",
      size: 70,
      header: "",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onView(row.original)}
          aria-label={`View invoice ${row.original.invoiceNumber}`}
          className="text-muted-foreground/40 opacity-0 transition-all duration-200 hover:bg-teal-500/10 hover:text-teal-600 group-hover:opacity-100 dark:hover:text-teal-400"
        >
          <EyeIcon className="size-4" />
        </Button>
      ),
    },
  ];
}
