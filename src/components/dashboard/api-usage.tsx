"use client";

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UsagePeriod {
  start: string;
  end: string;
  requests: number;
  limit: number;
}

interface EndpointUsage {
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  calls: number;
  avgLatency: number;
  errorRate: number;
}

interface UsageData {
  currentPeriod: UsagePeriod;
  dailyUsage: { date: string; requests: number }[];
  endpoints: EndpointUsage[];
  rateLimitHits: number;
}

// ---------------------------------------------------------------------------
// Mock data for demonstration
// ---------------------------------------------------------------------------

const MOCK_USAGE: UsageData = {
  currentPeriod: {
    start: "2026-02-01",
    end: "2026-02-28",
    requests: 14_832,
    limit: 50_000,
  },
  dailyUsage: Array.from({ length: 20 }, (_, i) => ({
    date: `2026-02-${String(i + 1).padStart(2, "0")}`,
    requests: Math.floor(Math.random() * 1200 + 400),
  })),
  endpoints: [
    { endpoint: "/api/qualify", method: "POST", calls: 8420, avgLatency: 1240, errorRate: 0.8 },
    { endpoint: "/api/leads", method: "GET", calls: 3210, avgLatency: 85, errorRate: 0.2 },
    { endpoint: "/api/batch/upload", method: "POST", calls: 1890, avgLatency: 3200, errorRate: 1.5 },
    { endpoint: "/api/analytics", method: "GET", calls: 982, avgLatency: 320, errorRate: 0.1 },
    { endpoint: "/api/webhooks", method: "POST", calls: 330, avgLatency: 150, errorRate: 0.3 },
  ],
  rateLimitHits: 23,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min((used / limit) * 100, 100);
  const color = pct > 90 ? "#EF4444" : pct > 70 ? "#F59E0B" : "#10B981";

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
        <span style={{ color: "#94A3B8" }}>{used.toLocaleString()} requests</span>
        <span style={{ color: "#94A3B8" }}>{limit.toLocaleString()} limit</span>
      </div>
      <div style={{ height: 8, backgroundColor: "#1E293B", borderRadius: 4, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            backgroundColor: color,
            borderRadius: 4,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <p style={{ marginTop: 6, fontSize: 13, color: "#64748B" }}>
        {pct.toFixed(1)}% used &middot; {(limit - used).toLocaleString()} remaining
      </p>
    </div>
  );
}

function MiniChart({ data }: { data: { date: string; requests: number }[] }) {
  const max = Math.max(...data.map((d) => d.requests));
  const barWidth = 100 / data.length;

  return (
    <div style={{ display: "flex", alignItems: "flex-end", height: 80, gap: 2, padding: "8px 0" }}>
      {data.map((d, i) => {
        const height = (d.requests / max) * 100;
        return (
          <div
            key={d.date}
            title={`${d.date}: ${d.requests} requests`}
            style={{
              flex: 1,
              height: `${height}%`,
              backgroundColor: i === data.length - 1 ? "#3B82F6" : "#334155",
              borderRadius: 2,
              minWidth: 4,
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#3B82F6")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = i === data.length - 1 ? "#3B82F6" : "#334155")
            }
          />
        );
      })}
    </div>
  );
}


function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "#10B981",
    POST: "#3B82F6",
    PUT: "#F59E0B",
    DELETE: "#EF4444",
  };

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "monospace",
        color: colors[method] || "#94A3B8",
        backgroundColor: `${colors[method] || "#94A3B8"}15`,
        borderRadius: 4,
        border: `1px solid ${colors[method] || "#94A3B8"}30`,
      }}
    >
      {method}
    </span>
  );
}


// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ApiUsage() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"day" | "week" | "month">("month");

  useEffect(() => {
    // In production, fetch from /api/usage
    const fetchUsage = async () => {
      try {
        // const res = await fetch("/api/usage");
        // const data = await res.json();
        // setUsage(data);
        await new Promise((r) => setTimeout(r, 600));
        setUsage(MOCK_USAGE);
      } finally {
        setLoading(false);
      }
    };
    fetchUsage();
  }, [period]);

  if (loading) {
    return (
      <div style={{ padding: 32, color: "#94A3B8" }}>
        Loading usage data...
      </div>
    );
  }

  if (!usage) return null;
  return (
    <div style={{ maxWidth: 960 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "#F1F5F9", margin: 0 }}>API Usage</h2>
          <p style={{ fontSize: 14, color: "#64748B", margin: "4px 0 0" }}>
            {usage.currentPeriod.start} &mdash; {usage.currentPeriod.end}
          </p>
        </div>
        <div style={{ display: "flex", gap: 4, backgroundColor: "#1E293B", borderRadius: 8, padding: 4 }}>
          {(["day", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 500,
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                backgroundColor: period === p ? "#334155" : "transparent",
                color: period === p ? "#F1F5F9" : "#64748B",
                transition: "all 0.2s",
              }}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Usage bar */}
      <div style={{ backgroundColor: "#0F172A", border: "1px solid #1E293B", borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 500, color: "#94A3B8", margin: "0 0 12px" }}>Current Period</h3>
        <UsageBar used={usage.currentPeriod.requests} limit={usage.currentPeriod.limit} />
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
        {[
          { label: "Avg. Daily Requests", value: Math.round(usage.currentPeriod.requests / 20).toLocaleString() },
          { label: "Rate Limit Hits", value: usage.rateLimitHits.toString(), warn: usage.rateLimitHits > 10 },
          { label: "Avg. Latency", value: `${Math.round(usage.endpoints.reduce((a, e) => a + e.avgLatency * e.calls, 0) / usage.currentPeriod.requests)}ms` },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              backgroundColor: "#0F172A",
              border: "1px solid #1E293B",
              borderRadius: 12,
              padding: "20px 24px",
            }}
          >
            <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>{stat.label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: stat.warn ? "#F59E0B" : "#F1F5F9", margin: "4px 0 0" }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Daily chart */}
      <div style={{ backgroundColor: "#0F172A", border: "1px solid #1E293B", borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 500, color: "#94A3B8", margin: "0 0 4px" }}>Daily Requests</h3>
        <MiniChart data={usage.dailyUsage} />
      </div>
      {/* Endpoint breakdown */}
      <div style={{ backgroundColor: "#0F172A", border: "1px solid #1E293B", borderRadius: 12, padding: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 500, color: "#94A3B8", margin: "0 0 16px" }}>Endpoint Breakdown</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Endpoint", "Method", "Calls", "Avg Latency", "Error Rate"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#475569",
                    borderBottom: "1px solid #1E293B",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usage.endpoints.map((ep) => (
              <tr key={ep.endpoint} style={{ borderBottom: "1px solid #1E293B10" }}>
                <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 13, color: "#E2E8F0" }}>
                  {ep.endpoint}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <MethodBadge method={ep.method} />
                </td>
                <td style={{ padding: "10px 12px", fontSize: 13, color: "#CBD5E1" }}>
                  {ep.calls.toLocaleString()}
                </td>
                <td style={{ padding: "10px 12px", fontSize: 13, color: "#CBD5E1" }}>
                  {ep.avgLatency}ms
                </td>
                <td style={{ padding: "10px 12px", fontSize: 13, color: ep.errorRate > 1 ? "#F59E0B" : "#10B981" }}>
                  {ep.errorRate}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
