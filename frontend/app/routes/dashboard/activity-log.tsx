/**
 * Activity Log Page — /dashboard/activity-log
 *
 * Design ("Aura v2") — slate/grey tones for audit/logs:
 * - Gradient hero banner with animated decorative blobs
 * - Server-side paginated DataTable
 * - Filter bar: date range, activity search, user selector
 * - Timeline-style columns with colored activity badges
 * - Pagination controls with page info
 */

import { useState, useMemo } from "react";
import {
  ActivityIcon,
  UsersIcon,
  CalendarIcon,
  ClockIcon,
  SearchIcon,
  FilterIcon,
  XIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ReusableMultiSelect } from "@/components/globals/ReusableMultiSelect";
import { DataTable } from "@/components/globals/data-table";
import { buildActivityLogColumns } from "@/components/activity-logs/columns";
import {
  useActivityLogs,
  type ActivityLogFilters,
} from "@/lib/hooks/use-activity-logs";
import { useUsers, type User } from "@/lib/hooks/use-users";
import { cn } from "@/lib/utils";
import type { Route } from "./+types/activity-log";

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
    { title: "Activity Log — Biasly" },
    {
      name: "description",
      content:
        "Audit trail of every sensitive action in Biasly — grade changes, payments, and role changes — with actor and timestamp.",
    },
  ];
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ActivityLogPage() {
  // ── Filter state ─────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [searchActivity, setSearchActivity] = useState("");
  const [filters, setFilters] = useState<ActivityLogFilters>({
    page: 1,
    limit: 15,
  });

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useActivityLogs(filters);
  const { data: allUsers } = useUsers();

  // Extract unique users from the log data for the user filter dropdown
  // Also combine with all users for the dropdown options
  const userOptions = useMemo(() => {
    if (!allUsers) return [];
    // Only show users who might have activity (staff roles)
    return allUsers.filter(
      (u) =>
        u.role !== "STUDENT" &&
        u.role !== "PARENT",
    );
  }, [allUsers]);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!data)
      return { total: 0, uniqueUsers: 0, recentDays: 0 };
    const total = data.pagination.total;
    const uniqueUsers = data.data
      ? new Set(data.data.map((l) => l.userId)).size
      : 0;
    return { total, uniqueUsers, recentDays: "—" };
  }, [data]);

  // ── Column definitions ──────────────────────────────────────────────────
  const columns = buildActivityLogColumns();

  // ── Filter handlers ──────────────────────────────────────────────────────
  const applyFilters = () => {
    const newFilters: ActivityLogFilters = { page: 1, limit: 15 };
    if (searchActivity.trim()) newFilters.activity = searchActivity.trim();
    if (selectedUserId) newFilters.userId = selectedUserId;
    if (dateFrom) newFilters.from = dateFrom;
    if (dateTo) newFilters.to = dateTo;
    setPage(1);
    setFilters(newFilters);
  };

  const clearFilters = () => {
    setSearchActivity("");
    setSelectedUserId("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
    setFilters({ page: 1, limit: 15 });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const hasActiveFilters =
    !!searchActivity || !!selectedUserId || !!dateFrom || !!dateTo;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* ═════════════════════════════════════════════════════════════════════
           GRADIENT HERO BANNER
           ═════════════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-br from-slate-500/[0.04] via-background to-background p-6 sm:p-8">
        {/* Animated decorative blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 size-60 rounded-full bg-gradient-to-br from-slate-500/10 via-slate-500/5 to-transparent blur-3xl animate-[blob_8s_ease-in-out_infinite]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 size-48 rounded-full bg-gradient-to-tr from-slate-500/5 via-slate-500/[0.02] to-transparent blur-3xl animate-[blob_10s_ease-in-out_infinite_2s]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/3 top-1/2 size-32 rounded-full bg-gradient-to-b from-slate-500/5 to-transparent blur-3xl animate-[blob_12s_ease-in-out_infinite_4s]"
        />

        {/* Content */}
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-500 to-slate-600 text-white shadow-lg shadow-slate-500/20">
              <ActivityIcon className="size-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Activity Log
              </h1>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground/70">
                Audit trail of all sensitive actions across the system. Filter
                by activity type, user, or date range.
              </p>
            </div>
          </div>
        </div>

        {/* ── Stat Cards ──────────────────────────────────────────────────── */}
        {!isLoading && data && data.data.length > 0 && (
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={ActivityIcon}
              label="Total Events"
              value={stats.total}
              gradient="bg-gradient-to-br from-slate-500 to-slate-600"
            />
            <StatCard
              icon={UsersIcon}
              label="Unique Users"
              value={stats.uniqueUsers}
              gradient="bg-gradient-to-br from-purple-500 to-purple-600"
            />
            <StatCard
              icon={CalendarIcon}
              label="Date Range"
              value={
                dateFrom && dateTo
                  ? `${dateFrom.slice(5)}–${dateTo.slice(5)}`
                  : "All time"
              }
              gradient="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <StatCard
              icon={ClockIcon}
              label="Live"
              value="30s refresh"
              gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
           FILTER BAR
           ═════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-border/20 bg-gradient-to-br from-background/90 to-background/40 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex flex-wrap items-end gap-3">
          {/* Activity search */}
          <div className="flex-1 min-w-[180px] space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
              Activity
            </label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/30" />
              <Input
                placeholder="Search by activity…"
                value={searchActivity}
                onChange={(e) => setSearchActivity(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                className="h-9 border-border/30 bg-background/60 pl-8 text-xs backdrop-blur-sm transition-all duration-200 focus-visible:border-slate-500/30 focus-visible:ring-2 focus-visible:ring-slate-500/10"
              />
            </div>
          </div>

          {/* User filter */}
          <div className="flex-1 min-w-[160px] space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
              User
            </label>
            <ReusableMultiSelect
              value={selectedUserId}
              onValueChange={(v) => setSelectedUserId(v)}
              options={userOptions.map((u) => ({ value: u.id, label: u.name }))}
              placeholder="All users"
              search={{ placeholder: "Search users…", emptyMessage: "No users found" }}
              accent="slate"
              triggerClassName="text-xs"
            />
          </div>

          {/* Date from */}
          <div className="w-[140px] space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
              From
            </label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 border-border/30 bg-background/60 text-xs backdrop-blur-sm transition-all duration-200 focus-visible:border-slate-500/30 focus-visible:ring-2 focus-visible:ring-slate-500/10"
            />
          </div>

          {/* Date to */}
          <div className="w-[140px] space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
              To
            </label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 border-border/30 bg-background/60 text-xs backdrop-blur-sm transition-all duration-200 focus-visible:border-slate-500/30 focus-visible:ring-2 focus-visible:ring-slate-500/10"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pb-px">
            <Button
              onClick={applyFilters}
              size="sm"
              className="h-9 bg-gradient-to-r from-slate-500 to-slate-600 text-white shadow-md shadow-slate-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-slate-500/30"
            >
              <FilterIcon className="mr-1.5 size-3.5" />
              Filter
            </Button>
            {hasActiveFilters && (
              <Button
                onClick={clearFilters}
                variant="ghost"
                size="sm"
                className="h-9 text-muted-foreground/50 hover:text-destructive"
              >
                <XIcon className="mr-1.5 size-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Active filter badges */}
        {hasActiveFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/10 pt-3">
            <span className="text-[10px] font-medium text-muted-foreground/40">
              Active filters:
            </span>
            {searchActivity && (
              <Badge
                variant="outline"
                className="border-slate-500/20 bg-slate-500/5 px-2 py-0 text-[10px] font-medium text-slate-600 dark:text-slate-400"
              >
                Activity: {searchActivity}
              </Badge>
            )}
            {selectedUserId && (
              <Badge
                variant="outline"
                className="border-purple-500/20 bg-purple-500/5 px-2 py-0 text-[10px] font-medium text-purple-600 dark:text-purple-400"
              >
                User: {userOptions.find((u) => u.id === selectedUserId)?.name ?? selectedUserId}
              </Badge>
            )}
            {dateFrom && (
              <Badge
                variant="outline"
                className="border-blue-500/20 bg-blue-500/5 px-2 py-0 text-[10px] font-medium text-blue-600 dark:text-blue-400"
              >
                From: {dateFrom}
              </Badge>
            )}
            {dateTo && (
              <Badge
                variant="outline"
                className="border-blue-500/20 bg-blue-500/5 px-2 py-0 text-[10px] font-medium text-blue-600 dark:text-blue-400"
              >
                To: {dateTo}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
           DATA TABLE SECTION
           ═════════════════════════════════════════════════════════════════════ */}
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-10 rounded-full bg-slate-500/[0.02] blur-3xl"
        />

        <DataTable
          columns={columns}
          data={data?.data ?? []}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
          searchPlaceholder=""
          emptyMessage="No activity logs found."
          emptyDescription={
            hasActiveFilters
              ? "Try adjusting your filters to see more results."
              : "Activity will appear here as users perform actions in the system."
          }
          pageSize={data?.pagination.limit ?? 15}
        />

        {/* ── Pagination controls ───────────────────────────────────────── */}
        {data && data.pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-border/20 bg-background/60 px-4 py-3 backdrop-blur-sm">
            <span className="text-xs text-muted-foreground/60">
              Page {data.pagination.page} of {data.pagination.totalPages}
              <span className="ml-1.5 text-muted-foreground/30">
                ({data.pagination.total} total entries)
              </span>
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={!data.pagination.hasPrevPage}
                className="h-8 border-border/30"
              >
                <ChevronLeftIcon className="size-3.5" />
              </Button>
              {Array.from(
                { length: Math.min(data.pagination.totalPages, 5) },
                (_, i) => {
                  const start = Math.max(
                    1,
                    Math.min(
                      data.pagination.page - 2,
                      data.pagination.totalPages - 4,
                    ),
                  );
                  const pageNum = start + i;
                  if (pageNum > data.pagination.totalPages) return null;
                  return (
                    <Button
                      key={pageNum}
                      variant={
                        pageNum === data.pagination.page
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      className={cn(
                        "h-8 min-w-[32px] border-border/30",
                        pageNum === data.pagination.page &&
                          "bg-gradient-to-r from-slate-500 to-slate-600 text-white shadow-sm",
                      )}
                    >
                      {pageNum}
                    </Button>
                  );
                },
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={!data.pagination.hasNextPage}
                className="h-8 border-border/30"
              >
                <ChevronRightIcon className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
