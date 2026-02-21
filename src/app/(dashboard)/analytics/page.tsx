"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────

interface MetricCard {
  label: string;
  value: string;
  change: number;
  icon: React.ComponentType<{ className?: string }>;
  period: string;
}

interface ChartDataPoint {
  date: string;
  revenue: number;
  users: number;
  churn: number;
}

interface TopPage {
  path: string;
  views: number;
  unique: number;
  avgTime: string;
}

// ─── Mock Data ──────────────────────────────────────────────────────

const METRICS: MetricCard[] = [
  {
    label: "Monthly Revenue",
    value: "$12,450",
    change: 12.5,
    icon: DollarSign,
    period: "vs last month",
  },
  {
    label: "Active Users",
    value: "2,340",
    change: 8.2,
    icon: Users,
    period: "vs last month",
  },
  {
    label: "Conversion Rate",
    value: "3.24%",
    change: -0.8,
    icon: TrendingUp,
    period: "vs last month",
  },
  {
    label: "Avg. Session",
    value: "4m 32s",
    change: 15.3,
    icon: Activity,
    period: "vs last month",
  },
];

const CHART_DATA: ChartDataPoint[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  return {
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    revenue: Math.floor(300 + Math.random() * 200 + i * 5),
    users: Math.floor(50 + Math.random() * 30 + i * 2),
    churn: Math.floor(Math.random() * 5 + 1),
  };
});

const TOP_PAGES: TopPage[] = [
  { path: "/dashboard", views: 12450, unique: 8230, avgTime: "3m 45s" },
  { path: "/settings", views: 8320, unique: 5120, avgTime: "2m 12s" },
  { path: "/billing", views: 6780, unique: 4560, avgTime: "1m 55s" },
  { path: "/members", views: 5430, unique: 3210, avgTime: "4m 08s" },
  { path: "/analytics", views: 4210, unique: 2890, avgTime: "5m 22s" },
];
// ─── Component ──────────────────────────────────────────────────────

type TimeRange = "7d" | "30d" | "90d";

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate data fetch
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, [timeRange]);

  const maxRevenue = Math.max(...CHART_DATA.map((d) => d.revenue));

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track your product metrics and user behavior
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-1">
          {(["7d", "30d", "90d"] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => { setLoading(true); setTimeRange(range); }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                timeRange === range
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {range === "7d" ? "7 days" : range === "30d" ? "30 days" : "90 days"}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {METRICS.map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
                <metric.icon className="h-5 w-5 text-indigo-600" />
              </div>
              <span
                className={`flex items-center gap-1 text-sm font-medium ${
                  metric.change >= 0 ? "text-green-600" : "text-red-500"
                }`}
              >
                {metric.change >= 0 ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )}
                {Math.abs(metric.change)}%
              </span>
            </div>
            <p className="mt-4 text-2xl font-bold text-gray-900">{metric.value}</p>
            <p className="mt-1 text-sm text-gray-500">
              {metric.label} <span className="text-gray-400">{metric.period}</span>
            </p>
          </div>
        ))}
      </div>
      {/* Revenue Chart (CSS-only bar chart) */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Revenue Overview</h2>
            <p className="text-sm text-gray-500">Daily revenue for the last 30 days</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-indigo-500" />
              Revenue
            </span>
          </div>
        </div>
        <div className="flex h-64 items-end gap-1">
          {CHART_DATA.map((point, i) => (
            <div
              key={i}
              className="group relative flex-1"
              title={`${point.date}: $${point.revenue}`}
            >
              <div
                className="w-full rounded-t bg-indigo-500 transition-all hover:bg-indigo-600"
                style={{ height: `${(point.revenue / maxRevenue) * 100}%` }}
              />
              <div className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                ${point.revenue}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-gray-400">
          <span>{CHART_DATA[0].date}</span>
          <span>{CHART_DATA[Math.floor(CHART_DATA.length / 2)].date}</span>
          <span>{CHART_DATA[CHART_DATA.length - 1].date}</span>
        </div>
      </div>

      {/* Top Pages Table */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900">Top Pages</h2>
          <p className="text-sm text-gray-500">Most visited pages in the selected period</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 text-left text-sm text-gray-500">
              <th className="px-6 py-3 font-medium">Page</th>
              <th className="px-6 py-3 font-medium">Views</th>
              <th className="px-6 py-3 font-medium">Unique Visitors</th>
              <th className="px-6 py-3 font-medium">Avg. Time</th>
            </tr>
          </thead>
          <tbody>
            {TOP_PAGES.map((page) => (
              <tr
                key={page.path}
                className="border-b border-gray-50 transition-colors hover:bg-gray-50"
              >
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {page.path}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {page.views.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {page.unique.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{page.avgTime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
