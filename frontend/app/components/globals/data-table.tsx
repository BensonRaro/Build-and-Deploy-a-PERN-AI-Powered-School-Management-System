/**
 * DataTable — Reusable TanStack Table wrapper for the Biasly SMS.
 *
 * Design language ("Aura v2"):
 * - Premium glass morphism aesthetic
 * - Subtle gradient row accents on hover
 * - Animated row entries with staggered fade-in
 * - Elegant pagination with glass-styled buttons
 * - States: Loading, Error (with retry), Empty (customizable)
 *
 * Usage:
 * ```tsx
 * <DataTable
 *   columns={columns}
 *   data={data ?? []}
 *   isLoading={isLoading}
 *   searchPlaceholder="Search academic years…"
 * />
 * ```
 */

import { useState, useEffect, type ReactNode } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import {
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  AlertCircleIcon,
  InboxIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Loader } from "@/components/globals/loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Types ──────────────────────────────────────────────────────────────────

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  showSearch?: boolean;
  searchPlaceholder?: string;
  showPagination?: boolean;
  pageSize?: number;
  emptyMessage?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  className?: string;
}

// ─── Sort Header Helper ──────────────────────────────────────────────────────

export function SortHeader(
  label: string,
  options?: {
    column?: {
      getIsSorted: () => string | false;
      toggleSorting: (desc?: boolean) => void;
    };
  },
) {
  const sorted = options?.column?.getIsSorted();

  return (
    <button
      type="button"
      onClick={() => options?.column?.toggleSorting(sorted === "asc")}
      className="group inline-flex items-center gap-1.5 font-semibold text-foreground/70 transition-colors hover:text-foreground"
    >
      <span>{label}</span>
      <span className="inline-flex size-4 items-center justify-center">
        {sorted === "asc" ? (
          <ArrowUpIcon className="size-3.5 text-primary" />
        ) : sorted === "desc" ? (
          <ArrowDownIcon className="size-3.5 text-primary" />
        ) : (
          <ArrowUpDownIcon className="size-3.5 text-muted-foreground/25 opacity-0 transition-all duration-200 group-hover:opacity-60" />
        )}
      </span>
    </button>
  );
}

// ─── Animated Row Wrapper ────────────────────────────────────────────────────

function AnimatedTableRow({
  children,
  index,
  className,
  ...props
}: React.ComponentProps<"tr"> & { index: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), index * 30);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <tr
      className={cn(
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  isError = false,
  errorMessage,
  onRetry,
  showSearch = true,
  searchPlaceholder = "Search…",
  showPagination = true,
  pageSize = 10,
  emptyMessage = "No results found.",
  emptyDescription,
  emptyIcon,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnFilters },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    globalFilterFn: "includesString",
  });

  const totalRows = table.getFilteredRowModel().rows.length;
  const { pageIndex } = table.getState().pagination;
  const pageCount = table.getPageCount();

  // ── Loading state ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        className={cn(
          "flex min-h-[350px] items-center justify-center rounded-2xl border border-border/30 bg-gradient-to-b from-background/80 to-background/40 p-12 backdrop-blur-sm",
          className,
        )}
      >
        <Loader variant="page" size="md" text="Loading data…" />
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div
        className={cn(
          "flex min-h-[300px] flex-col items-center justify-center gap-5 rounded-2xl border border-destructive/15 bg-gradient-to-b from-destructive/[0.03] to-transparent p-8",
          className,
        )}
      >
        <div className="relative">
          <div className="absolute inset-0 animate-pulse rounded-full bg-destructive/10 blur-xl" />
          <AlertCircleIcon className="relative size-12 text-destructive/50" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-destructive">
            {errorMessage ?? "Failed to load data."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Please try again or contact support.
          </p>
        </div>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            Try Again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-5", className)}>
      {/* ── Toolbar: Search ──────────────────────────────────────────────── */}
      {showSearch && (
        <div className="relative max-w-xs">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <SearchIcon className="size-4 text-muted-foreground/40" />
          </div>
          <Input
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => {
              setGlobalFilter(e.target.value);
              table.setPageIndex(0);
            }}
            className="h-9 border-border/50 bg-background/60 pl-9 text-sm backdrop-blur-sm transition-all duration-200 placeholder:text-muted-foreground/40 focus-visible:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/10"
          />
        </div>
      )}

      {/* ── Table Container ──────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-border/30 bg-gradient-to-b from-background/90 to-background/50 shadow-sm shadow-black/[0.02] backdrop-blur-sm">
        <Table className="">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-b border-border/20 bg-gradient-to-r from-muted/40 via-muted/20 to-muted/40 hover:bg-muted/40"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row, rowIndex) => (
                <AnimatedTableRow
                  key={row.id}
                  index={rowIndex}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(
                    "group border-b border-border/10 border-l-2 border-l-transparent transition-all duration-200 hover:bg-primary/[0.03] hover:border-l-primary/40",
                    rowIndex % 2 === 0 ? "bg-background/40" : "",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="overflow-hidden text-ellipsis px-4 py-3 text-sm whitespace-nowrap">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </AnimatedTableRow>
              ))
            ) : (
              // ── Empty state ──────────────────────────────────────────────
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-[280px] text-center"
                >
                  <div className="flex flex-col items-center justify-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-muted/30 blur-xl" />
                      {emptyIcon ?? (
                        <InboxIcon className="relative size-12 text-muted-foreground/20" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground/80">
                        {emptyMessage}
                      </p>
                      {emptyDescription && (
                        <p className="mt-1 text-xs text-muted-foreground/50">
                          {emptyDescription}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {showPagination && totalRows > pageSize && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground/50">
            <span className="font-medium text-foreground/80">
              {pageIndex * pageSize + 1}
            </span>
            <span className="mx-1">—</span>
            <span className="font-medium text-foreground/80">
              {Math.min((pageIndex + 1) * pageSize, totalRows)}
            </span>
            <span className="mx-1.5 text-muted-foreground/30">of</span>
            <span className="font-medium text-foreground/80">{totalRows}</span>
          </p>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              aria-label="First page"
              className="border-border/30 text-muted-foreground/50 hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
            >
              <ChevronLeftIcon className="size-3.5" />
              <ChevronLeftIcon className="-ml-2 size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
              className="border-border/30 text-muted-foreground/50 hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
            >
              <ChevronLeftIcon className="size-3.5" />
            </Button>

            {/* Page number buttons */}
            <div className="mx-1 flex items-center gap-1">
              {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => {
                // Show pages around current page
                const start = Math.max(
                  0,
                  Math.min(pageIndex - 2, pageCount - 5),
                );
                const pageNum = start + i;
                const isActive = pageNum === pageIndex;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => table.setPageIndex(pageNum)}
                    className={cn(
                      "inline-flex size-7 items-center justify-center rounded-lg text-xs font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary/10 text-primary shadow-sm"
                        : "text-muted-foreground/50 hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
              className="border-border/30 text-muted-foreground/50 hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
            >
              <ChevronRightIcon className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => table.setPageIndex(pageCount - 1)}
              disabled={!table.getCanNextPage()}
              aria-label="Last page"
              className="border-border/30 text-muted-foreground/50 hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
            >
              <ChevronRightIcon className="size-3.5" />
              <ChevronRightIcon className="-ml-2 size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
