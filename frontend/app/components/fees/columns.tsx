/**
 * fees/columns — Column definitions for the Fee Structure table.
 *
 * Design ("Aura v2" — finance variant):
 * - Emerald gradient icon circle for each fee row
 * - Grade cell with section chip + academic year subtitle
 * - Term cell with calendar chip
 * - Bold currency amount with emerald accent
 * - Hover-reveal action buttons (edit/delete)
 */

import type { ColumnDef } from "@tanstack/react-table";
import { SortHeader } from "@/components/globals/data-table";
import { Button } from "@/components/ui/button";
import {
  PencilIcon,
  TrashIcon,
  PiggyBankIcon,
  CalendarRangeIcon,
  GraduationCapIcon,
} from "lucide-react";
import type { Fee } from "@/lib/hooks/use-fees";
import type { AcademicYear } from "@/lib/hooks/use-academic-years";
import { formatCurrency } from "@/lib/utils";

// ─── Options ────────────────────────────────────────────────────────────────

interface FeeColumnsOptions {
  onEdit?: (fee: Fee) => void;
  onDelete?: (fee: Fee) => void;
  /** Used to resolve the academic year name for a fee's grade */
  academicYears?: AcademicYear[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Small chip used for section / term labels */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
      {children}
    </span>
  );
}

// ─── Column Builder ─────────────────────────────────────────────────────────

export function buildFeeColumns(
  options?: FeeColumnsOptions,
): ColumnDef<Fee>[] {
  const { onEdit, onDelete, academicYears } = options ?? {};

  /** Resolve the academic year name for a given academicYearId */
  const yearName = (academicYearId: string): string => {
    const year = academicYears?.find((y) => y.id === academicYearId);
    return year ? year.name : "";
  };

  return [
    {
      accessorKey: "grade.name",
      size: 280,
      header: ({ column }) => SortHeader("Grade", { column }),
      cell: ({ row }) => {
        const { grade } = row.original;
        const year = yearName(grade.academicYearId);
        return (
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-600 shadow-sm ring-1 ring-emerald-500/10 dark:text-emerald-400">
              <GraduationCapIcon className="size-4.5" />
            </span>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  {grade.name}
                </span>
                <Chip>{grade.section}</Chip>
              </div>
              <span className="text-[11px] text-muted-foreground/40">
                {year || grade.academicYearId}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "term.name",
      size: 160,
      header: ({ column }) => SortHeader("Term", { column }),
      cell: ({ row }) => {
        const { term } = row.original;
        return (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <CalendarRangeIcon className="size-3.5 text-muted-foreground/30" />
            <span className="font-medium text-foreground/80">{term.name}</span>
          </span>
        );
      },
    },
    {
      accessorKey: "amount",
      size: 140,
      header: ({ column }) => SortHeader("Amount", { column }),
      cell: ({ row }) => {
        const amount = row.getValue("amount") as string;
        return (
          <span className="inline-flex items-center gap-1.5 font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">
            <PiggyBankIcon className="size-3.5 text-emerald-500/40" />
            {formatCurrency(amount)}
          </span>
        );
      },
    },
    {
      id: "actions",
      size: 80,
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-0.5 opacity-0 transition-all duration-200 group-hover:opacity-100">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onEdit(row.original)}
              aria-label={`Edit fee for ${row.original.grade.name} - ${row.original.term.name}`}
              className="transition-all duration-200 hover:bg-muted hover:text-foreground"
            >
              <PencilIcon className="size-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onDelete(row.original)}
              aria-label={`Delete fee for ${row.original.grade.name} - ${row.original.term.name}`}
              className="transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
            >
              <TrashIcon className="size-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];
}
