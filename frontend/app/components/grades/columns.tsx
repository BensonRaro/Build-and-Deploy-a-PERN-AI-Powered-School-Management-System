/**
 * grades/columns — Column definitions for the Grades table.
 *
 * Design ("Aura v2"):
 * - Gradient icon circle for each grade
 * - Section + room info chips
 * - Student/subject count chips
 * - Hover-reveal action buttons
 */

import type { ColumnDef } from "@tanstack/react-table";
import { SortHeader } from "@/components/globals/data-table";
import { Button } from "@/components/ui/button";
import {
  PencilIcon,
  TrashIcon,
  GraduationCapIcon,
  UsersIcon,
  BookOpenIcon,
  MapPinIcon,
  PiggyBankIcon,
} from "lucide-react";
import type { Grade } from "@/lib/hooks/use-grades";
import { formatCurrency } from "@/lib/utils";

interface GradeColumnsOptions {
  onEdit?: (grade: Grade) => void;
  onDelete?: (grade: Grade) => void;
}

function ResourceChip({
  count,
  label,
  icon: Icon,
}: {
  count: number;
  label: string;
  icon: React.ElementType;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground/60">
      <Icon className="size-3 text-muted-foreground/35" />
      {count} {label}
    </span>
  );
}

export function buildGradeColumns(
  options?: GradeColumnsOptions,
): ColumnDef<Grade>[] {
  const { onEdit, onDelete } = options ?? {};

  return [
    {
      accessorKey: "name",
      size: 260,
      header: ({ column }) => SortHeader("Grade", { column }),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 text-violet-600 shadow-sm ring-1 ring-violet-500/10 dark:text-violet-400">
            <GraduationCapIcon className="size-4.5" />
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">
                {row.getValue("name")}
              </span>
              <span className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                {row.original.section}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground/40">
              {row.original.academicYear.name}
            </span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "roomNumber",
      size: 120,
      header: "Room",
      cell: ({ row }) => {
        const room = row.getValue("roomNumber") as string | null;
        return room ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <MapPinIcon className="size-3 text-muted-foreground/30" />
            <span>{room}</span>
          </span>
        ) : (
          <span className="text-muted-foreground/30">—</span>
        );
      },
    },
    {
      accessorKey: "capacity",
      size: 100,
      header: ({ column }) => SortHeader("Capacity", { column }),
      cell: ({ row }) => (
        <span className="font-medium text-foreground/80">
          {row.getValue("capacity")}
        </span>
      ),
    },
    {
      id: "enrollment",
      size: 160,
      header: "Enrollment",
      cell: ({ row }) => {
        const { students, subjects } = row.original._count;
        return (
          <div className="flex items-center gap-1.5">
            <ResourceChip
              count={students}
              label="students"
              icon={UsersIcon}
            />
            <ResourceChip
              count={subjects}
              label="subjects"
              icon={BookOpenIcon}
            />
          </div>
        );
      },
    },
    {
      id: "fees",
      size: 240,
      header: "Fees",
      cell: ({ row }) => {
        const fees = row.original.fees;
        // No fee structures configured for this grade
        if (!fees || fees.length === 0) {
          return (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground/30">
              <PiggyBankIcon className="size-3" />
              No fees set
            </span>
          );
        }
        // One chip per term, e.g. "Term 1 · $250.00"
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {fees.map((fee) => (
              <span
                key={fee.id}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
              >
                <PiggyBankIcon className="size-3 text-emerald-500/50" />
                <span className="uppercase tracking-wide text-emerald-600/60 dark:text-emerald-400/60">
                  {fee.term.name}
                </span>
                <span className="font-semibold">{formatCurrency(fee.amount)}</span>
              </span>
            ))}
          </div>
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
              aria-label={`Edit ${row.original.name}`}
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
              aria-label={`Delete ${row.original.name}`}
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
