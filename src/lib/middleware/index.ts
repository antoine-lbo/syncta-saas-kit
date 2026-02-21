/**
 * Middleware Stack for Syncta SaaS Kit
 *
 * Composable middleware pipeline for Next.js API routes.
 * Includes rate limiting, authentication, CORS, request logging,
 * and org-level authorization.
 *
 * Usage:
 *   import { withMiddleware, withAuth, withRateLimit } from "@/lib/middleware";
 *   export const POST = withMiddleware(withRateLimit(), withAuth(), handler);
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

// ─── Types ──────────────────────────────────────────────────────

export interface MiddlewareContext {
  request: NextRequest;
  userId?: string;
  orgId?: string;
  orgRole?: "admin" | "member" | "viewer";
  apiKeyId?: string;
  startTime: number;
  requestId: string;
  [key: string]: unknown;
}

export type MiddlewareHandler = (
  ctx: MiddlewareContext
) => Promise<NextResponse | void>;

export type RouteHandler = (
  request: NextRequest,
  ctx: MiddlewareContext
) => Promise<NextResponse>;

// ─── Core Pipeline ──────────────────────────────────────────────

/**
 * Compose multiple middleware functions into a single handler.
 * Middlewares run in order; if any returns a Response, the chain stops.
 */
export function withMiddleware(
  ...args: [...MiddlewareHandler[], RouteHandler]
) {
  const handler = args.pop() as RouteHandler;
  const middlewares = args as MiddlewareHandler[];

  return async (request: NextRequest): Promise<NextResponse> => {
    const ctx: MiddlewareContext = {
      request,
      startTime: Date.now(),
      requestId: crypto.randomUUID(),
    };

    try {
      for (const mw of middlewares) {
        const result = await mw(ctx);
        if (result instanceof NextResponse) return result;
      }

      const response = await handler(request, ctx);

      // Attach request ID to response headers
      response.headers.set("x-request-id", ctx.requestId);
      response.headers.set(
        "x-response-time",
        `${Date.now() - ctx.startTime}ms`
      );

      return response;
    } catch (error) {
      return handleError(error, ctx);
    }
  };
}

function handleError(error: unknown, ctx: MiddlewareContext): NextResponse {
  const elapsed = Date.now() - ctx.startTime;
  const message = error instanceof Error ? error.message : "Internal server error";
  const status = error instanceof ApiError ? error.status : 500;

  console.error(`[${ctx.requestId}] Error after ${elapsed}ms:`, error);

  return NextResponse.json(
    {
      error: message,
      request_id: ctx.requestId,
      ...(process.env.NODE_ENV === "development" && {
        stack: error instanceof Error ? error.stack : undefined,
      }),
    },
    { status }
  );
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}
// ─── Rate Limiter ───────────────────────────────────────────────

interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window size in seconds */
  window: number;
  /** Key extractor — defaults to IP address */
  keyBy?: (ctx: MiddlewareContext) => string;
}

// In-memory store (use Redis in production)
const rateLimitStore = new Map<
  string,
  { count: number; resetAt: number }
>();

// Cleanup stale entries every 60s
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
      if (entry.resetAt < now) rateLimitStore.delete(key);
    }
  }, 60_000);
}

/**
 * Rate limiting middleware using sliding window counter.
 *
 * @example
 *   withRateLimit({ limit: 100, window: 60 }) // 100 req/min
 */
export function withRateLimit(
  config: Partial<RateLimitConfig> = {}
): MiddlewareHandler {
  const { limit = 60, window: windowSec = 60, keyBy } = config;

  return async (ctx: MiddlewareContext) => {
    const ip = ctx.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? ctx.request.headers.get("x-real-ip")
      ?? "unknown";

    const key = keyBy ? keyBy(ctx) : `rl:${ip}:${ctx.request.nextUrl.pathname}`;
    const now = Date.now();
    const windowMs = windowSec * 1000;

    let entry = rateLimitStore.get(key);
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      rateLimitStore.set(key, entry);
    }

    entry.count++;

    const remaining = Math.max(0, limit - entry.count);
    const resetIn = Math.ceil((entry.resetAt - now) / 1000);

    if (entry.count > limit) {
      return NextResponse.json(
        {
          error: "Too many requests",
          retry_after: resetIn,
          request_id: ctx.requestId,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(resetIn),
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
          },
        }
      );
    }

    // Store rate limit info for response headers
    ctx.rateLimitRemaining = remaining;
    ctx.rateLimitLimit = limit;
    ctx.rateLimitReset = Math.ceil(entry.resetAt / 1000);
  };
}
// ─── Authentication ─────────────────────────────────────────────

interface AuthConfig {
  /** Require a specific role */
  requiredRole?: "admin" | "member" | "viewer";
  /** Allow API key authentication */
  allowApiKey?: boolean;
  /** Make auth optional (sets userId if present, but does not reject) */
  optional?: boolean;
}

/**
 * Authentication middleware. Validates Supabase JWT or API key.
 *
 * @example
 *   withAuth()                              // Require any authenticated user
 *   withAuth({ requiredRole: "admin" })     // Require admin role
 *   withAuth({ allowApiKey: true })         // Accept Bearer token or API key
 *   withAuth({ optional: true })            // Attach user if present
 */
export function withAuth(config: AuthConfig = {}): MiddlewareHandler {
  const { requiredRole, allowApiKey = false, optional = false } = config;

  return async (ctx: MiddlewareContext) => {
    const authHeader = ctx.request.headers.get("authorization");

    if (!authHeader) {
      if (optional) return;
      return NextResponse.json(
        { error: "Missing authorization header", request_id: ctx.requestId },
        { status: 401 }
      );
    }

    // API Key authentication
    if (authHeader.startsWith("sk_live_") && allowApiKey) {
      return await authenticateWithApiKey(authHeader, ctx);
    }

    // Bearer token (Supabase JWT)
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      if (optional) return;
      return NextResponse.json(
        { error: "Invalid authorization format", request_id: ctx.requestId },
        { status: 401 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      if (optional) return;
      return NextResponse.json(
        { error: "Invalid or expired token", request_id: ctx.requestId },
        { status: 401 }
      );
    }

    ctx.userId = user.id;

    // Check org role if required
    if (requiredRole) {
      const orgId = ctx.request.headers.get("x-org-id");
      if (!orgId) {
        return NextResponse.json(
          { error: "Missing x-org-id header", request_id: ctx.requestId },
          { status: 400 }
        );
      }

      const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: membership } = await adminSupabase
        .from("org_members")
        .select("role")
        .eq("org_id", orgId)
        .eq("user_id", user.id)
        .single();

      if (!membership) {
        return NextResponse.json(
          { error: "Not a member of this organization", request_id: ctx.requestId },
          { status: 403 }
        );
      }

      const ROLE_HIERARCHY = { admin: 3, member: 2, viewer: 1 };
      const userLevel = ROLE_HIERARCHY[membership.role as keyof typeof ROLE_HIERARCHY] ?? 0;
      const requiredLevel = ROLE_HIERARCHY[requiredRole];

      if (userLevel < requiredLevel) {
        return NextResponse.json(
          { error: `Requires ${requiredRole} role or higher`, request_id: ctx.requestId },
          { status: 403 }
        );
      }

      ctx.orgId = orgId;
      ctx.orgRole = membership.role as MiddlewareContext["orgRole"];
    }
  };
}

async function authenticateWithApiKey(
  apiKey: string,
  ctx: MiddlewareContext
): Promise<NextResponse | void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const keyPrefix = apiKey.slice(0, 12);
  const { data: keyRecord } = await supabase
    .from("api_keys")
    .select("id, project_id, is_active, expires_at, projects(org_id)")
    .eq("key_prefix", keyPrefix)
    .single();

  if (!keyRecord || !keyRecord.is_active) {
    return NextResponse.json(
      { error: "Invalid or inactive API key", request_id: ctx.requestId },
      { status: 401 }
    );
  }

  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "API key expired", request_id: ctx.requestId },
      { status: 401 }
    );
  }

  ctx.apiKeyId = keyRecord.id;
  ctx.orgId = (keyRecord.projects as any)?.org_id;

  // Update last_used_at asynchronously
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRecord.id)
    .then(() => {});
}
// ─── CORS ───────────────────────────────────────────────────────

interface CorsConfig {
  origins?: string[];
  methods?: string[];
  allowHeaders?: string[];
  exposeHeaders?: string[];
  maxAge?: number;
  credentials?: boolean;
}

const DEFAULT_CORS: Required<CorsConfig> = {
  origins: ["*"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-Org-Id", "X-Request-Id"],
  exposeHeaders: ["X-Request-Id", "X-Response-Time", "X-RateLimit-Remaining"],
  maxAge: 86400,
  credentials: true,
};

/**
 * CORS middleware with configurable origins.
 *
 * @example
 *   withCors({ origins: ["https://app.syncta.ai", "http://localhost:3000"] })
 */
export function withCors(config: CorsConfig = {}): MiddlewareHandler {
  const opts = { ...DEFAULT_CORS, ...config };

  return async (ctx: MiddlewareContext) => {
    const origin = ctx.request.headers.get("origin") ?? "";

    const isAllowed =
      opts.origins.includes("*") || opts.origins.includes(origin);

    // Handle preflight
    if (ctx.request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": isAllowed ? origin || "*" : "",
          "Access-Control-Allow-Methods": opts.methods.join(", "),
          "Access-Control-Allow-Headers": opts.allowHeaders.join(", "),
          "Access-Control-Max-Age": String(opts.maxAge),
          ...(opts.credentials && {
            "Access-Control-Allow-Credentials": "true",
          }),
        },
      });
    }

    // Store CORS headers to attach to response
    ctx.corsHeaders = {
      "Access-Control-Allow-Origin": isAllowed ? origin || "*" : "",
      "Access-Control-Expose-Headers": opts.exposeHeaders.join(", "),
      ...(opts.credentials && {
        "Access-Control-Allow-Credentials": "true",
      }),
    };
  };
}

// ─── Request Logging ────────────────────────────────────────────

interface LogConfig {
  /** Log request body (careful with sensitive data) */
  logBody?: boolean;
  /** Custom log function */
  logger?: (entry: LogEntry) => void;
  /** Skip logging for certain paths */
  skip?: string[];
}

interface LogEntry {
  requestId: string;
  method: string;
  path: string;
  status?: number;
  duration: number;
  ip: string;
  userAgent: string;
  userId?: string;
  orgId?: string;
  timestamp: string;
}

/**
 * Request logging middleware. Logs method, path, status, and duration.
 */
export function withLogging(config: LogConfig = {}): MiddlewareHandler {
  const { logBody = false, logger, skip = ["/api/health"] } = config;

  return async (ctx: MiddlewareContext) => {
    const { request, requestId, startTime } = ctx;
    const path = request.nextUrl.pathname;

    if (skip.some((p) => path.startsWith(p))) return;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip")
      ?? "unknown";

    const entry: LogEntry = {
      requestId,
      method: request.method,
      path,
      duration: 0,
      ip,
      userAgent: request.headers.get("user-agent") ?? "unknown",
      userId: ctx.userId,
      orgId: ctx.orgId,
      timestamp: new Date().toISOString(),
    };

    if (logBody && request.method !== "GET") {
      try {
        const body = await request.clone().text();
        (entry as any).body = body.slice(0, 1000);
      } catch {}
    }

    // Log on response (via a post-middleware hook)
    const originalStartTime = startTime;
    ctx._logEntry = entry;
    ctx._logger = logger;

    // Log inline for now
    const logFn = logger ?? defaultLogger;
    entry.duration = Date.now() - originalStartTime;
    logFn(entry);
  };
}

function defaultLogger(entry: LogEntry): void {
  const status = entry.status ?? "---";
  const line = [
    `[${entry.requestId.slice(0, 8)}]`,
    entry.method.padEnd(7),
    entry.path,
    `${status}`,
    `${entry.duration}ms`,
    entry.userId ? `user:${entry.userId.slice(0, 8)}` : "anon",
  ].join(" ");

  console.log(line);
}
// ─── Request Validation ────────────────────────────────────────

type ValidatorFn = (body: unknown) => { valid: boolean; errors?: string[] };

/**
 * Request body validation middleware.
 *
 * @example
 *   withValidation((body) => {
 *     const errors: string[] = [];
 *     if (!body.email) errors.push("email is required");
 *     return { valid: errors.length === 0, errors };
 *   })
 */
export function withValidation(validator: ValidatorFn): MiddlewareHandler {
  return async (ctx: MiddlewareContext) => {
    if (ctx.request.method === "GET" || ctx.request.method === "DELETE") return;

    let body: unknown;
    try {
      body = await ctx.request.clone().json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body", request_id: ctx.requestId },
        { status: 400 }
      );
    }

    const result = validator(body);
    if (!result.valid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: result.errors,
          request_id: ctx.requestId,
        },
        { status: 422 }
      );
    }

    ctx.validatedBody = body;
  };
}

// ─── Usage Metering ─────────────────────────────────────────────

interface MeterConfig {
  /** Feature being metered (e.g., "api_calls", "ai_queries") */
  feature: string;
  /** Cost per request in units */
  cost?: number;
}

/**
 * Usage metering middleware for billing. Tracks API usage per org.
 *
 * @example
 *   withMeter({ feature: "api_calls" })
 *   withMeter({ feature: "ai_queries", cost: 5 })
 */
export function withMeter(config: MeterConfig): MiddlewareHandler {
  const { feature, cost = 1 } = config;

  return async (ctx: MiddlewareContext) => {
    if (!ctx.orgId) return; // No org context, skip metering

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check usage limit
    const { data: usage } = await supabase
      .from("usage_meters")
      .select("current_usage, usage_limit")
      .eq("org_id", ctx.orgId)
      .eq("feature", feature)
      .eq("period", getCurrentBillingPeriod())
      .single();

    if (usage && usage.usage_limit > 0 && usage.current_usage >= usage.usage_limit) {
      return NextResponse.json(
        {
          error: "Usage limit exceeded",
          feature,
          current: usage.current_usage,
          limit: usage.usage_limit,
          request_id: ctx.requestId,
        },
        { status: 402 }
      );
    }

    // Increment usage asynchronously
    supabase.rpc("increment_usage", {
      p_org_id: ctx.orgId,
      p_feature: feature,
      p_cost: cost,
      p_period: getCurrentBillingPeriod(),
    }).then(() => {});
  };
}

function getCurrentBillingPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Convenience Presets ─────────────────────────────────────────

/** Standard API route: logging + CORS + rate limit + auth */
export function apiDefaults() {
  return [
    withLogging(),
    withCors(),
    withRateLimit({ limit: 100, window: 60 }),
    withAuth(),
  ];
}

/** Public API route: logging + CORS + stricter rate limit */
export function publicApiDefaults() {
  return [
    withLogging(),
    withCors(),
    withRateLimit({ limit: 30, window: 60 }),
  ];
}

/** Admin-only route: all defaults + admin role check */
export function adminDefaults() {
  return [
    withLogging(),
    withCors(),
    withRateLimit({ limit: 100, window: 60 }),
    withAuth({ requiredRole: "admin" }),
  ];
}

/** Webhook route: logging + lenient rate limit + API key auth */
export function webhookDefaults() {
  return [
    withLogging(),
    withRateLimit({ limit: 500, window: 60 }),
    withAuth({ allowApiKey: true }),
  ];
}
