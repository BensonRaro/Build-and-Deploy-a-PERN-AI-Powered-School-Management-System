/**
 * Finance Analytics Page — /dashboard/finance-analytics
 *
 * Whole-school financial summary for management (SUPER_ADMIN / PRINCIPAL /
 * VICE_PRINCIPAL / ACCOUNTANT). Backed by GET /api/finance/analytics.
 *
 * Design ("Aura v2" — analytics variant):
 * - Emerald→indigo gradient hero with live stat cards
 * - Monthly collection trend (area chart)
 * - Collection by term (bar chart) + payment methods (donut chart)
 * - Invoice status progress + per-grade collection bars
 * - Recent payments feed
 *
 * All charts use the shadcn ChartContainer + recharts.
 */

import { useState, useMemo, useEffect } from "react";
import {
  TrendingUpIcon,
  WalletIcon,
  PiggyBankIcon,
  PercentIcon,
  BarChart3Icon,
  CalendarRangeIcon,
  ReceiptTextIcon,
  UsersRoundIcon,
  CreditCardIcon,
  ArrowUpRightIcon,
  ArrowDownRightIcon,
  CircleDollarSignIcon,
  LandmarkIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ReusableMultiSelect } from "@/components/globals/ReusableMultiSelect";
import { useFinanceAnalytics, type FinanceAnalytics } from "@/lib/hooks/use-finance";
import { useAcademicYears } from "@/lib/hooks/use-academic-years";
import { cn, formatCurrency } from "@/lib/utils";
import type { Route } from "./+types/finance-analytics";

// ─── Chart palette ──────────────────────────────────────────────────────────

const CHART_COLORS = {
  emerald: "#10b981",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  amber: "#f59e0b",
  rose: "#f43f5e",
  sky: "#0ea5e9",
  slate: "#64748b",
};

const METHOD_COLORS = [
  CHART_COLORS.emerald,
  CHART_COLORS.indigo,
  CHART_COLORS.violet,
  CHART_COLORS.amber,
  CHART_COLORS.rose,
  CHART_COLORS.sky,
  CHART_COLORS.slate,
];

const STATUS_COLORS: Record<string, string> = {
  PAID: CHART_COLORS.emerald,
  PARTIALLY_PAID: CHART_COLORS.amber,
  UNPAID: CHART_COLORS.rose,
  CANCELLED: CHART_COLORS.slate,
};

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  gradient,
  trend,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  gradient: string;
  trend?: { up: boolean; text: string };
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
      <div className="relative">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/[0.02]",
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
        {(sub || trend) && (
          <div className="mt-2.5 flex items-center gap-2 text-[11px] text-muted-foreground/50">
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium",
                  trend.up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
                )}
              >
                {trend.up ? (
                  <ArrowUpRightIcon className="size-3" />
                ) : (
                  <ArrowDownRightIcon className="size-3" />
                )}
                {trend.text}
              </span>
            )}
            {sub && <span>{sub}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section Card wrapper ───────────────────────────────────────────────────

function SectionCard({
  title,
  subtitle,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-b from-background/80 to-background/40 shadow-sm shadow-black/[0.02] backdrop-blur-sm transition-all duration-300 hover:border-border/30 hover:shadow-md hover:shadow-black/[0.04]",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-border/15 px-5 py-4">
        <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 text-emerald-600 shadow-sm ring-1 ring-emerald-500/10 dark:text-emerald-400">
          <Icon className="size-4.5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground/50">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Chart configs ──────────────────────────────────────────────────────────

const monthlyConfig = {
  collected: {
    label: "Collected",
    color: CHART_COLORS.emerald,
  },
} satisfies ChartConfig;

const termConfig = {
  billed: {
    label: "Billed",
    color: CHART_COLORS.indigo,
  },
  collected: {
    label: "Collected",
    color: CHART_COLORS.emerald,
  },
} satisfies ChartConfig;

const methodConfig = {
  amount: {
    label: "Amount",
    color: CHART_COLORS.emerald,
  },
} satisfies ChartConfig;

// ─── Meta ────────────────────────────────────────────────────────────────────

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Finance Analytics — Biasly" },
    {
      name: "description",
      content:
        "Whole-school financial summary — collections, payment methods, and invoice statuses at a glance.",
    },
  ];
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function FinanceAnalyticsPage() {
  const { data: academicYears } = useAcademicYears();
  const [yearId, setYearId] = useState<string>("");

  // Year filter options (null placeholder item shows "All years" before/without selection)
  const yearOptions = useMemo(
    () => [
      { label: "All years", value: null as string | null },
      ...(academicYears ?? []).map((y) => ({
        label: `${y.name}${y.isCurrent ? " (Current)" : ""}`,
        value: y.id,
      })),
    ],
    [academicYears],
  );

  // Default to current academic year once loaded
  useEffect(() => {
    if (!yearId && academicYears && academicYears.length > 0) {
      const current = academicYears.find((y) => y.isCurrent);
      setYearId(current?.id ?? academicYears[0].id);
    }
  }, [academicYears, yearId]);

  const { data, isLoading, isError, refetch } = useFinanceAnalytics(
    yearId || undefined,
  );

  const summary = data?.summary;

  // ── Derive chart data ──────────────────────────────────────────────────
  const termChartData = useMemo(
    () =>
      (data?.byTerm ?? []).map((t) => ({
        term: t.termName,
        billed: t.billed,
        collected: t.collected,
      })),
    [data],
  );

  const methodChartData = useMemo(
    () =>
      (data?.byMethod ?? []).map((m) => ({
        method: m.method.replace(/_/g, " "),
        value: m.amount,
      })),
    [data],
  );

  const totalMethods = useMemo(
    () => methodChartData.reduce((s, m) => s + m.value, 0),
    [methodChartData],
  );

  const invoiceStatusTotal = useMemo(
    () =>
      (data?.invoiceStatuses ?? []).reduce((s, r) => s + r.amount, 0),
    [data],
  );

  const statusLabel = (status: string) =>
    status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  const methodLabel = (method: string) =>
    method.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* ═════════════════════════════════════════════════════════════════
           GRADIENT HERO BANNER
           ═════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-border/20 bg-gradient-to-br from-emerald-500/[0.06] via-indigo-500/[0.03] to-background p-6 sm:p-8">
        {/* Animated decorative blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 size-60 rounded-full bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent blur-3xl animate-[blob_8s_ease-in-out_infinite]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 size-48 rounded-full bg-gradient-to-tr from-indigo-500/8 via-indigo-500/[0.02] to-transparent blur-3xl animate-[blob_10s_ease-in-out_infinite_2s]"
        />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-indigo-600 text-white shadow-lg shadow-emerald-500/20">
              <BarChart3Icon className="size-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Finance Analytics
              </h1>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground/70">
                Whole-school financial summary — billed, collected, and
                outstanding fees across every grade and term.
              </p>
            </div>
          </div>

          {/* Academic year filter */}
          <ReusableMultiSelect
            className="w-full sm:w-56"
            value={yearId}
            onValueChange={(v) => setYearId(v)}
            options={yearOptions}
            placeholder="All years"
            icon={CalendarRangeIcon}
            accent="emerald"
            triggerClassName="h-10"
          />
        </div>

        {/* ── Stat Cards ─────────────────────────────────────────────────── */}
        {!isLoading && summary && (
          <div className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={WalletIcon}
              label="Total Billed"
              value={formatCurrency(summary.totalBilled)}
              sub={`${summary.itemCount} invoice items`}
              gradient="bg-gradient-to-br from-indigo-500 to-indigo-600"
            />
            <StatCard
              icon={CircleDollarSignIcon}
              label="Collected"
              value={formatCurrency(summary.totalCollected)}
              sub={`${summary.paymentCount} payments`}
              gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
              trend={{ up: true, text: `${summary.collectionRate}% collected` }}
            />
            <StatCard
              icon={PiggyBankIcon}
              label="Outstanding"
              value={formatCurrency(summary.totalOutstanding)}
              sub={`across ${summary.studentCount} students`}
              gradient="bg-gradient-to-br from-amber-500 to-amber-600"
            />
            <StatCard
              icon={PercentIcon}
              label="Collection Rate"
              value={`${summary.collectionRate}%`}
              sub={summary.collectionRate >= 80 ? "Healthy" : "Needs attention"}
              gradient="bg-gradient-to-br from-violet-500 to-violet-600"
            />
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════
           MAIN GRID
           ═════════════════════════════════════════════════════════════ */}
      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-2xl border border-border/20 bg-muted/20"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 rounded-2xl border border-destructive/15 bg-destructive/[0.03] p-10 text-center">
          <p className="text-sm font-medium text-destructive">
            Failed to load finance analytics.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg border border-border/30 px-4 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            Try Again
          </button>
        </div>
      ) : (
        <>
          {/* ── Row 1: Monthly trend + payment methods ──────────────────── */}
          <div className="grid gap-6 lg:grid-cols-5">
            <SectionCard
              title="Collection Trend"
              subtitle="Money collected over the last 12 months"
              icon={TrendingUpIcon}
              className="lg:col-span-3"
            >
              <ChartContainer config={monthlyConfig} className="aspect-[2/1]">
                <AreaChart
                  data={data?.monthly ?? []}
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient id="fillCollected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.emerald} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={CHART_COLORS.emerald} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    fontSize={11}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    fontSize={11}
                    tickFormatter={(v: number) =>
                      `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`
                    }
                    width={48}
                  />
                  <ChartTooltip
                    cursor={{ stroke: CHART_COLORS.emerald, strokeOpacity: 0.2 }}
                    content={
                      <ChartTooltipContent
                        formatter={(value: unknown) =>
                          formatCurrency(Number(value ?? 0))
                        }
                      />
                    }
                  />
                  <Area
                    dataKey="collected"
                    type="monotone"
                    stroke={CHART_COLORS.emerald}
                    strokeWidth={2.5}
                    fill="url(#fillCollected)"
                  />
                </AreaChart>
              </ChartContainer>
            </SectionCard>

            <SectionCard
              title="Payment Methods"
              subtitle="Share of collected revenue"
              icon={CreditCardIcon}
              className="lg:col-span-2"
            >
              {methodChartData.length === 0 ? (
                <div className="flex h-56 items-center justify-center text-sm text-muted-foreground/40">
                  No payments recorded yet
                </div>
              ) : (
                <>
                  <ChartContainer config={methodConfig} className="aspect-[1.6/1]">
                    <PieChart>
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value: unknown, name: unknown) => (
                              <span className="flex items-center gap-2">
                                <span className="text-muted-foreground">
                                  {String(name ?? "")}:
                                </span>
                                <span className="font-mono font-medium text-foreground">
                                  {formatCurrency(Number(value ?? 0))}
                                </span>
                              </span>
                            )}
                          />
                        }
                      />
                      <Pie
                        data={methodChartData}
                        dataKey="value"
                        nameKey="method"
                        innerRadius="55%"
                        outerRadius="80%"
                        paddingAngle={3}
                        strokeWidth={2}
                      >
                        {methodChartData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={METHOD_COLORS[i % METHOD_COLORS.length]}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {methodChartData.slice(0, 4).map((m, i) => (
                      <div
                        key={m.method}
                        className="flex items-center justify-between rounded-lg border border-border/10 bg-muted/20 px-2.5 py-1.5 text-[11px]"
                      >
                        <span className="flex items-center gap-1.5 text-muted-foreground/70">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: METHOD_COLORS[i % METHOD_COLORS.length] }}
                          />
                          {methodLabel(m.method)}
                        </span>
                        <span className="font-medium text-foreground/80">
                          {totalMethods > 0
                            ? `${Math.round((m.value / totalMethods) * 100)}%`
                            : "0%"}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </SectionCard>
          </div>

          {/* ── Row 2: By term + invoice status ─────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-5">
            <SectionCard
              title="Collection by Term"
              subtitle="Billed vs collected per academic term"
              icon={LandmarkIcon}
              className="lg:col-span-3"
            >
              {termChartData.length === 0 ? (
                <div className="flex h-56 items-center justify-center text-sm text-muted-foreground/40">
                  No fee data for this period
                </div>
              ) : (
                <ChartContainer config={termConfig} className="aspect-[2/1]">
                  <BarChart
                    data={termChartData}
                    margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="term"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      fontSize={11}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      fontSize={11}
                      tickFormatter={(v: number) =>
                        `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`
                      }
                      width={48}
                    />
                    <ChartTooltip
                      cursor={{ fill: "rgba(99,102,241,0.06)" }}
                      content={
                        <ChartTooltipContent
                          formatter={(value: unknown) =>
                            formatCurrency(Number(value ?? 0))
                          }
                        />
                      }
                    />
                    <Bar dataKey="billed" fill={CHART_COLORS.indigo} radius={[4, 4, 0, 0]} barSize={18} />
                    <Bar dataKey="collected" fill={CHART_COLORS.emerald} radius={[4, 4, 0, 0]} barSize={18} />
                  </BarChart>
                </ChartContainer>
              )}
              <ChartLegend content={<ChartLegendContent />} className="mt-3" />
            </SectionCard>

            <SectionCard
              title="Invoice Status"
              subtitle="Amount billed by payment state"
              icon={ReceiptTextIcon}
              className="lg:col-span-2"
            >
              <div className="space-y-4">
                {(data?.invoiceStatuses ?? []).length === 0 ? (
                  <div className="flex h-56 items-center justify-center text-sm text-muted-foreground/40">
                    No invoices yet
                  </div>
                ) : (
                  (data?.invoiceStatuses ?? []).map((row) => {
                    const pct =
                      invoiceStatusTotal > 0
                        ? Math.round((row.amount / invoiceStatusTotal) * 100)
                        : 0;
                    return (
                      <div key={row.status} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2 font-medium text-foreground/80">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: STATUS_COLORS[row.status] ?? CHART_COLORS.slate }}
                            />
                            {statusLabel(row.status)}
                            <span className="text-muted-foreground/40">
                              · {row.count} item{row.count !== 1 ? "s" : ""}
                            </span>
                          </span>
                          <span className="font-mono font-medium text-foreground">
                            {formatCurrency(row.amount)}
                            <span className="ml-1.5 text-[10px] text-muted-foreground/40">
                              {pct}%
                            </span>
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted/40">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: STATUS_COLORS[row.status] ?? CHART_COLORS.slate,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </SectionCard>
          </div>

          {/* ── Row 3: By grade + recent payments ───────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-5">
            <SectionCard
              title="Collection by Grade"
              subtitle="Per-grade billed, collected and outstanding"
              icon={UsersRoundIcon}
              className="lg:col-span-3"
            >
              <div className="space-y-4">
                {(data?.byGrade ?? []).length === 0 ? (
                  <div className="flex h-48 items-center justify-center text-sm text-muted-foreground/40">
                    No grade data for this period
                  </div>
                ) : (
                  (data?.byGrade ?? []).map((g) => (
                    <div key={g.gradeId} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {g.gradeName}
                          </span>
                          <span className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                            {g.section}
                          </span>
                        </span>
                        <span className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground/70">
                          <span className="text-foreground">{formatCurrency(g.collected)}</span>
                          <span className="text-muted-foreground/40">/ {formatCurrency(g.billed)}</span>
                          <span className="w-12 text-right font-medium text-foreground">
                            {g.rate}%
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/40">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
                            style={{ width: `${g.rate}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Recent Payments"
              subtitle="Latest 10 transactions"
              icon={CircleDollarSignIcon}
              className="lg:col-span-2"
            >
              <div className="space-y-2.5">
                {(data?.recentPayments ?? []).length === 0 ? (
                  <div className="flex h-48 items-center justify-center text-sm text-muted-foreground/40">
                    No payments yet
                  </div>
                ) : (
                  (data?.recentPayments ?? []).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/10 bg-muted/20 px-3 py-2.5 transition-colors duration-200 hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-foreground">
                          {p.studentName}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground/50">
                          {p.grade} · {p.term}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(p.amount)}
                        </p>
                        <p className="text-[10px] text-muted-foreground/40">
                          {new Intl.DateTimeFormat("en-US", {
                            month: "short",
                            day: "numeric",
                          }).format(new Date(p.paymentDate))}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
