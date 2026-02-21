"use client";

/**
 * Usage Analytics Chart
 *
 * Renders API usage metrics over time with interactive tooltips,
 * period selection (7d / 30d / 90d), and plan limit indicators.
 * Uses Recharts for composable, responsive SVG charts.
 *
 * @example
 * <UsageChart orgId="org_123" />
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UsageDataPoint {
  date: string;
  api_calls: number;
  tokens_used: number;
  active_users: number;
}

interface UsageChartProps {
  orgId: string;
  className?: string;
}

type Period = "7d" | "30d" | "90d";
type Metric = "api_calls" | "tokens_used" | "active_users";

const PERIOD_DAYS: Record<Period, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const METRIC_CONFIG: Record<
  Metric,
  { label: string; color: string; formatter: (v: number) => string }
> = {
  api_calls: {
    label: "API Calls",
    color: "#6366f1",
    formatter: (v) => v.toLocaleString(),
  },
  tokens_used: {
    label: "Tokens",
    color: "#8b5cf6",
    formatter: (v) =>
      v >= 1_000_000
        ? `${(v / 1_000_000).toFixed(1)}M`
        : v >= 1_000
        ? `${(v / 1_000).toFixed(1)}K`
        : v.toString(),
  },
  active_users: {
    label: "Active Users",
    color: "#06b6d4",
    formatter: (v) => v.toString(),
  },
};

/** Plan limits for the reference line indicator. */
const PLAN_LIMITS: Record<string, Record<Metric, number | null>> = {
  starter: { api_calls: 10_000, tokens_used: 500_000, active_users: 5 },
  pro: { api_calls: 100_000, tokens_used: 5_000_000, active_users: 25 },
  enterprise: { api_calls: null, tokens_used: null, active_users: null },
};
// ---------------------------------------------------------------------------
// Data Fetching
// ---------------------------------------------------------------------------

async function fetchUsageData(
  orgId: string,
  days: number
): Promise<UsageDataPoint[]> {
  const supabase = createClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("usage_daily")
    .select("date, api_calls, tokens_used, active_users")
    .eq("org_id", orgId)
    .gte("date", since.toISOString().split("T")[0])
    .order("date", { ascending: true });

  if (error) throw error;
  return (data as UsageDataPoint[]) ?? [];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PeriodSelector({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
      {(Object.keys(PERIOD_DAYS) as Period[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
            value === p
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function MetricSelector({
  value,
  onChange,
}: {
  value: Metric;
  onChange: (m: Metric) => void;
}) {
  return (
    <div className="flex gap-2">
      {(Object.entries(METRIC_CONFIG) as [Metric, (typeof METRIC_CONFIG)[Metric]][]).map(
        ([key, cfg]) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              value === key
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: cfg.color }}
            />
            {cfg.label}
          </button>
        )
      )}
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
  metric,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  metric: Metric;
}) {
  if (!active || !payload?.length) return null;

  const cfg = METRIC_CONFIG[metric];
  const value = payload[0].value;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-semibold" style={{ color: cfg.color }}>
        {cfg.formatter(value)} {cfg.label.toLowerCase()}
      </p>
    </div>
  );
}
// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function UsageChart({ orgId, className = "" }: UsageChartProps) {
  const [period, setPeriod] = useState<Period>("30d");
  const [metric, setMetric] = useState<Metric>("api_calls");
  const [data, setData] = useState<UsageDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<string>("starter");

  // Fetch usage data when period or orgId changes
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const usage = await fetchUsageData(orgId, PERIOD_DAYS[period]);
      setData(usage);
    } catch (err) {
      console.error("Failed to load usage data:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId, period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fetch plan info for limit indicator
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("organizations")
      .select("plan")
      .eq("id", orgId)
      .single()
      .then(({ data: org }) => {
        if (org?.plan) setPlan(org.plan);
      });
  }, [orgId]);

  // Derived values
  const cfg = METRIC_CONFIG[metric];
  const planLimit = PLAN_LIMITS[plan]?.[metric] ?? null;

  const totalForPeriod = useMemo(
    () => data.reduce((sum, d) => sum + d[metric], 0),
    [data, metric]
  );

  const avgPerDay = useMemo(
    () => (data.length ? Math.round(totalForPeriod / data.length) : 0),
    [totalForPeriod, data.length]
  );

  const peakDay = useMemo(() => {
    if (!data.length) return { date: "-", value: 0 };
    const peak = data.reduce((max, d) => (d[metric] > max[metric] ? d : max), data[0]);
    return { date: peak.date, value: peak[metric] };
  }, [data, metric]);

  const usagePercent = planLimit ? Math.round((totalForPeriod / planLimit) * 100) : null;

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-6 ${className}`}>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Usage Analytics</h3>
          <p className="text-sm text-slate-500">
            Track your API consumption and active users
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Metric Selector */}
      <div className="mb-4">
        <MetricSelector value={metric} onChange={setMetric} />
      </div>

      {/* Stats Row */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Total ({period})</p>
          <p className="text-xl font-bold text-slate-900">
            {cfg.formatter(totalForPeriod)}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Avg / day</p>
          <p className="text-xl font-bold text-slate-900">
            {cfg.formatter(avgPerDay)}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Peak day</p>
          <p className="text-xl font-bold text-slate-900">
            {cfg.formatter(peakDay.value)}
          </p>
          <p className="text-[10px] text-slate-400">{peakDay.date}</p>
        </div>
      </div>

      {/* Plan Limit Warning */}
      {usagePercent !== null && usagePercent >= 80 && (
        <div
          className={`mb-4 rounded-lg px-4 py-2 text-sm ${
            usagePercent >= 100
              ? "bg-red-50 text-red-700"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          {usagePercent >= 100
            ? `You have exceeded your ${plan} plan limit (${usagePercent}% used).`
            : `Approaching your ${plan} plan limit (${usagePercent}% used).`}{" "}
          <a href="/settings/billing" className="font-medium underline">
            Upgrade plan
          </a>
        </div>
      )}

      {/* Chart */}
      <div className="h-[280px]">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id={`gradient-${metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cfg.color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={cfg.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(d: string) =>
                  new Date(d).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={cfg.formatter}
              />
              <Tooltip content={<CustomTooltip metric={metric} />} />
              {planLimit && (
                <ReferenceLine
                  y={planLimit}
                  stroke="#ef4444"
                  strokeDasharray="6 4"
                  label={{
                    value: `${plan} limit`,
                    position: "insideTopRight",
                    fill: "#ef4444",
                    fontSize: 11,
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey={metric}
                stroke={cfg.color}
                strokeWidth={2}
                fill={`url(#gradient-${metric})`}
                animationDuration={600}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
