// supabase/functions/api-usage/index.ts
// Edge Function for recording and querying API usage metrics
//
// Endpoints:
//   POST /api-usage/record  - Record an API usage event
//   GET  /api-usage/summary - Get usage summary for dashboard
//   GET  /api-usage/quota   - Check current quota status
//   GET  /api-usage/export  - Export usage data as CSV

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// ---------- Types ----------

interface UsageEvent {
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  status_code: number;
  latency_ms: number;
  request_size_bytes?: number;
  response_size_bytes?: number;
  metadata?: Record<string, unknown>;
}

interface QuotaStatus {
  org_id: string;
  plan: string;
  monthly_limit: number;
  monthly_used: number;
  daily_limit: number;
  daily_used: number;
  rate_limit_per_minute: number;
  within_quota: boolean;
  usage_percentage: number;
}

interface UsageSummary {
  total_requests: number;
  total_errors: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  requests_by_endpoint: Record<string, number>;
  requests_by_status: Record<string, number>;
  daily_breakdown: Array<{
    date: string;
    requests: number;
    errors: number;
    avg_latency: number;
  }>;
}

// ---------- CORS ----------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}
// ---------- Helpers ----------

function getSupabaseClient(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Missing authorization header");

  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    }
  );
}

async function getOrgId(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!membership) throw new Error("No organization found for user");
  return membership.org_id;
}

function parseQueryParams(url: URL) {
  const period = url.searchParams.get("period") || "30d";
  const endpoint = url.searchParams.get("endpoint") || null;
  const method = url.searchParams.get("method") || null;

  const periodDays: Record<string, number> = {
    "1d": 1, "7d": 7, "30d": 30, "90d": 90,
  };
  const days = periodDays[period] || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return { startDate: startDate.toISOString(), endpoint, method, days };
}

// ---------- Handlers ----------

async function handleRecord(req: Request): Promise<Response> {
  const supabase = getSupabaseClient(req);
  const orgId = await getOrgId(supabase);

  // Check quota before recording
  const { data: quotaCheck } = await supabase
    .rpc("check_usage_quota", { p_org_id: orgId });

  if (quotaCheck && !quotaCheck.within_quota) {
    return errorResponse("API quota exceeded. Upgrade your plan for more requests.", 429);
  }

  const body: UsageEvent = await req.json();

  // Validate required fields
  if (!body.endpoint || !body.method || body.status_code === undefined) {
    return errorResponse("Missing required fields: endpoint, method, status_code");
  }

  // Record the event via database function (handles aggregation)
  const { error } = await supabase.rpc("record_api_usage", {
    p_org_id: orgId,
    p_endpoint: body.endpoint,
    p_method: body.method,
    p_status_code: body.status_code,
    p_latency_ms: body.latency_ms || 0,
    p_request_size: body.request_size_bytes || 0,
    p_response_size: body.response_size_bytes || 0,
  });

  if (error) {
    console.error("Failed to record usage:", error);
    return errorResponse("Failed to record usage event", 500);
  }

  return jsonResponse({ success: true, message: "Usage event recorded" }, 201);
}
async function handleSummary(req: Request): Promise<Response> {
  const supabase = getSupabaseClient(req);
  const orgId = await getOrgId(supabase);
  const url = new URL(req.url);
  const { startDate, endpoint, method } = parseQueryParams(url);

  // Get daily aggregates
  let query = supabase
    .from("api_usage_daily")
    .select("*")
    .eq("org_id", orgId)
    .gte("usage_date", startDate.split("T")[0])
    .order("usage_date", { ascending: true });

  if (endpoint) query = query.eq("endpoint", endpoint);
  if (method) query = query.eq("method", method);

  const { data: dailyData, error } = await query;

  if (error) {
    console.error("Failed to fetch summary:", error);
    return errorResponse("Failed to fetch usage summary", 500);
  }

  // Aggregate the data
  const summary: UsageSummary = {
    total_requests: 0,
    total_errors: 0,
    avg_latency_ms: 0,
    p95_latency_ms: 0,
    requests_by_endpoint: {},
    requests_by_status: {},
    daily_breakdown: [],
  };

  let totalLatency = 0;
  const allLatencies: number[] = [];
  const dateMap = new Map<string, { requests: number; errors: number; latencySum: number }>();

  for (const row of dailyData || []) {
    summary.total_requests += row.total_requests;
    summary.total_errors += row.error_count;
    totalLatency += (row.avg_latency_ms || 0) * row.total_requests;
    allLatencies.push(row.avg_latency_ms || 0);

    // By endpoint
    const key = `${row.method} ${row.endpoint}`;
    summary.requests_by_endpoint[key] = (summary.requests_by_endpoint[key] || 0) + row.total_requests;

    // Daily breakdown
    const dateKey = row.usage_date;
    const existing = dateMap.get(dateKey) || { requests: 0, errors: 0, latencySum: 0 };
    existing.requests += row.total_requests;
    existing.errors += row.error_count;
    existing.latencySum += (row.avg_latency_ms || 0) * row.total_requests;
    dateMap.set(dateKey, existing);
  }

  // Calculate averages
  summary.avg_latency_ms = summary.total_requests > 0
    ? Math.round(totalLatency / summary.total_requests)
    : 0;

  // Approximate p95
  allLatencies.sort((a, b) => a - b);
  const p95Index = Math.ceil(allLatencies.length * 0.95) - 1;
  summary.p95_latency_ms = allLatencies[p95Index] || 0;

  // Build daily breakdown
  for (const [date, data] of dateMap) {
    summary.daily_breakdown.push({
      date,
      requests: data.requests,
      errors: data.errors,
      avg_latency: data.requests > 0 ? Math.round(data.latencySum / data.requests) : 0,
    });
  }

  return jsonResponse(summary);
}
async function handleQuota(req: Request): Promise<Response> {
  const supabase = getSupabaseClient(req);
  const orgId = await getOrgId(supabase);

  // Get quota info
  const { data: quota, error: quotaError } = await supabase
    .from("api_usage_quotas")
    .select("*")
    .eq("org_id", orgId)
    .single();

  if (quotaError || !quota) {
    return errorResponse("No quota configuration found", 404);
  }

  // Get current month usage
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];

  const { data: monthlyUsage } = await supabase
    .from("api_usage_daily")
    .select("total_requests")
    .eq("org_id", orgId)
    .gte("usage_date", monthStart);

  const { data: dailyUsage } = await supabase
    .from("api_usage_daily")
    .select("total_requests")
    .eq("org_id", orgId)
    .eq("usage_date", todayStr);

  const monthlyTotal = (monthlyUsage || []).reduce((sum, r) => sum + r.total_requests, 0);
  const dailyTotal = (dailyUsage || []).reduce((sum, r) => sum + r.total_requests, 0);

  const status: QuotaStatus = {
    org_id: orgId,
    plan: quota.plan,
    monthly_limit: quota.monthly_limit,
    monthly_used: monthlyTotal,
    daily_limit: quota.daily_limit,
    daily_used: dailyTotal,
    rate_limit_per_minute: quota.rate_limit_per_minute,
    within_quota: monthlyTotal < quota.monthly_limit && dailyTotal < quota.daily_limit,
    usage_percentage: Math.round((monthlyTotal / quota.monthly_limit) * 100),
  };

  return jsonResponse(status);
}

async function handleExport(req: Request): Promise<Response> {
  const supabase = getSupabaseClient(req);
  const orgId = await getOrgId(supabase);
  const url = new URL(req.url);
  const { startDate } = parseQueryParams(url);

  const { data: events, error } = await supabase
    .from("api_usage_events")
    .select("*")
    .eq("org_id", orgId)
    .gte("created_at", startDate)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (error) {
    return errorResponse("Failed to export usage data", 500);
  }

  // Build CSV
  const headers = ["timestamp", "endpoint", "method", "status_code", "latency_ms", "request_size", "response_size"];
  const rows = (events || []).map((e) =>
    [e.created_at, e.endpoint, e.method, e.status_code, e.latency_ms, e.request_size_bytes, e.response_size_bytes].join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="api-usage-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
// ---------- Router ----------

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop() || "";

    switch (path) {
      case "record":
        if (req.method !== "POST") {
          return errorResponse("Method not allowed. Use POST.", 405);
        }
        return await handleRecord(req);

      case "summary":
        if (req.method !== "GET") {
          return errorResponse("Method not allowed. Use GET.", 405);
        }
        return await handleSummary(req);

      case "quota":
        if (req.method !== "GET") {
          return errorResponse("Method not allowed. Use GET.", 405);
        }
        return await handleQuota(req);

      case "export":
        if (req.method !== "GET") {
          return errorResponse("Method not allowed. Use GET.", 405);
        }
        return await handleExport(req);

      default:
        return jsonResponse({
          service: "api-usage",
          version: "1.0.0",
          endpoints: {
            "POST /api-usage/record": "Record an API usage event",
            "GET /api-usage/summary": "Get usage summary (query: period, endpoint, method)",
            "GET /api-usage/quota": "Check current quota status",
            "GET /api-usage/export": "Export usage data as CSV (query: period)",
          },
        });
    }
  } catch (err) {
    console.error("Unhandled error:", err);

    if (err instanceof Error && err.message === "Unauthorized") {
      return errorResponse("Unauthorized", 401);
    }
    if (err instanceof Error && err.message.includes("Missing authorization")) {
      return errorResponse("Missing authorization header", 401);
    }

    return errorResponse("Internal server error", 500);
  }
});
