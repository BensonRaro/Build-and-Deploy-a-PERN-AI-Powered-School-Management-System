/**
 * payments/columns — Column definitions for the payments ledger table.
 *
 * Design ("Aura v2" — finance variant):
 * - Indigo gradient icon circle per payment row
 * - Student cell with grade + section chip
 * - Bold currency amount with indigo accent
 * - Date + method chips for quick scanning
 */

import type { ColumnDef } from "@tanstack/react-table";
import { SortHeader } from "@/components/globals/data-table";
import {
  CreditCardIcon,
  UserRoundIcon,
  CalendarDaysIcon,
} from "lucide-react";
import type { LedgerPayment } from "@/lib/hooks/use-payments";
import { formatCurrency } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Small chip used for labels */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
      {children}
    </span>
  );
}

/** Formats a payment method enum value nicely */
const methodLabel = (method: string) =>
  method.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Formats an ISO date as "Mar 3, 2026" */
const dateLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));

// ─── Column Builder ─────────────────────────────────────────────────────────

export function buildPaymentColumns(): ColumnDef<LedgerPayment>[] {
  return [
    {
      accessorKey: "invoice.student.user.name",
      size: 280,
      header: ({ column }) => SortHeader("Student", { column }),
      cell: ({ row }) => {
        const p = row.original;
        const { student } = p.invoice;
        return (
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 text-indigo-600 shadow-sm ring-1 ring-indigo-500/10 dark:text-indigo-400">
              <UserRoundIcon className="size-4.5" />
            </span>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  {student.user.name}
                </span>
                <Chip>
                  {student.grade.name} - {student.grade.section}
                </Chip>
              </div>
              <span className="text-[11px] text-muted-foreground/40">
                {p.feeStructure?.term.name ?? "Fee payment"}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "amount",
      size: 140,
      header: ({ column }) => SortHeader("Amount", { column }),
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 font-semibold tracking-tight text-indigo-600 dark:text-indigo-400">
          <CreditCardIcon className="size-3.5 text-indigo-500/40" />
          {formatCurrency(row.original.amount)}
        </span>
      ),
    },
    {
      accessorKey: "paymentDate",
      size: 150,
      header: ({ column }) => SortHeader("Date", { column }),
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <CalendarDaysIcon className="size-3.5 text-muted-foreground/30" />
          {dateLabel(row.original.paymentDate)}
        </span>
      ),
    },
    {
      accessorKey: "paymentMethod",
      size: 140,
      header: ({ column }) => SortHeader("Method", { column }),
      cell: ({ row }) => <Chip>{methodLabel(row.original.paymentMethod)}</Chip>,
    },
    {
      accessorKey: "referenceNumber",
      size: 180,
      header: "Reference",
      cell: ({ row }) => {
        const ref = row.original.referenceNumber;
        return (
          <span className="font-mono text-[11px] text-muted-foreground/50">
            {ref ? ref.slice(0, 24) : "—"}
          </span>
        );
      },
    },
  ];
}
