/**
 * API Middleware Utilities
 *
 * Provides rate limiting, request validation, error handling,
 * and audit logging for API routes.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─── Types ─────────────────────────────────────────────────────────

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

interface ApiError {
  code: string;
  message: string;
  status: number;
  details?: Record<string, unknown>;
}

interface AuditLogEntry {
  action: string;
  resource: string;
  user_id: string;
  org_id?: string;
  ip_address: string;
  user_agent: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

type ApiHandler = (
  req: NextRequest,
  context: { userId: string; orgId?: string }
) => Promise<NextResponse>;

// ─── Rate Limiter (In-Memory) ───────────────────────────────────────

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

// Clean up expired entries periodically
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
      if (now > entry.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }, 60_000);
}
// ─── Error Handling ──────────────────────────────────────────────────

export class ApiException extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiException";
  }
}

function formatError(error: unknown): ApiError {
  if (error instanceof ApiException) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      code: "INTERNAL_ERROR",
      message: process.env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : error.message,
      status: 500,
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: "An unexpected error occurred",
    status: 500,
  };
}

// ─── Audit Logger ───────────────────────────────────────────────────

async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from("audit_logs").insert(entry);
  } catch (error) {
    // Audit logging should never break the request
    console.error("[Audit] Failed to log event:", error);
  }
}

// ─── Request Validation ────────────────────────────────────────────

export function validateBody<T>(
  body: unknown,
  requiredFields: (keyof T)[]
): asserts body is T {
  if (!body || typeof body !== "object") {
    throw new ApiException("INVALID_BODY", "Request body is required", 400);
  }

  const record = body as Record<string, unknown>;
  const missing = requiredFields.filter(
    (field) => !(field as string in record) || record[field as string] === undefined
  );

  if (missing.length > 0) {
    throw new ApiException(
      "MISSING_FIELDS",
      `Missing required fields: ${missing.join(", ")}`,
      400,
      { missing }
    );
  }
}

// ─── Auth + Rate Limit Wrapper ───────────────────────────────────────

interface WithAuthOptions {
  rateLimit?: RateLimitConfig;
  requiredRole?: "admin" | "member" | "viewer";
  audit?: { action: string; resource: string };
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 60,
  keyPrefix: "api",
};

/**
 * Higher-order function that wraps API route handlers with:
 * - Authentication (Supabase session verification)
 * - Rate limiting (per-user, in-memory)
 * - Role-based access control
 * - Audit logging
 * - Structured error handling
 *
 * @example
 * ```ts
 * export const POST = withAuth(
 *   async (req, { userId, orgId }) => {
 *     const body = await req.json();
 *     validateBody(body, ["name", "email"]);
 *     // ... handle request
 *     return NextResponse.json({ success: true });
 *   },
 *   { requiredRole: "admin", audit: { action: "create", resource: "invite" } }
 * );
 * ```
 */
export function withAuth(handler: ApiHandler, options: WithAuthOptions = {}) {
  const rateLimitConfig = options.rateLimit ?? DEFAULT_RATE_LIMIT;

  return async (req: NextRequest): Promise<NextResponse> => {
    const startTime = performance.now();

    try {
      // 1. Authenticate
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json(
          { code: "UNAUTHORIZED", message: "Authentication required" },
          { status: 401 }
        );
      }

      // 2. Rate limit
      const rateLimitKey = `${rateLimitConfig.keyPrefix}:${user.id}`;
      const limit = checkRateLimit(rateLimitKey, rateLimitConfig);

      if (!limit.allowed) {
        return NextResponse.json(
          { code: "RATE_LIMITED", message: "Too many requests" },
          {
            status: 429,
            headers: {
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": String(Math.ceil(limit.resetAt / 1000)),
              "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
            },
          }
        );
      }
      // 3. Get org membership and check role
      let orgId: string | undefined;

      if (options.requiredRole) {
        const { data: membership } = await supabase
          .from("org_members")
          .select("org_id, role")
          .eq("user_id", user.id)
          .single();

        if (!membership) {
          return NextResponse.json(
            { code: "NO_ORG", message: "Organization membership required" },
            { status: 403 }
          );
        }

        orgId = membership.org_id;

        const roleHierarchy = { admin: 3, member: 2, viewer: 1 };
        const userLevel = roleHierarchy[membership.role as keyof typeof roleHierarchy] ?? 0;
        const requiredLevel = roleHierarchy[options.requiredRole];

        if (userLevel < requiredLevel) {
          return NextResponse.json(
            {
              code: "INSUFFICIENT_ROLE",
              message: `This action requires ${options.requiredRole} role or higher`,
            },
            { status: 403 }
          );
        }
      }

      // 4. Execute handler
      const response = await handler(req, { userId: user.id, orgId });

      // 5. Audit log (non-blocking)
      if (options.audit) {
        logAuditEvent({
          action: options.audit.action,
          resource: options.audit.resource,
          user_id: user.id,
          org_id: orgId,
          ip_address: req.headers.get("x-forwarded-for") ?? req.ip ?? "unknown",
          user_agent: req.headers.get("user-agent") ?? "unknown",
          metadata: {
            method: req.method,
            path: req.nextUrl.pathname,
            status: response.status,
            duration_ms: Math.round(performance.now() - startTime),
          },
          timestamp: new Date().toISOString(),
        });
      }

      // Add rate limit headers
      response.headers.set("X-RateLimit-Remaining", String(limit.remaining));
      response.headers.set("X-RateLimit-Reset", String(Math.ceil(limit.resetAt / 1000)));

      return response;
    } catch (error) {
      const apiError = formatError(error);

      if (apiError.status >= 500) {
        console.error("[API Error]", {
          path: req.nextUrl.pathname,
          method: req.method,
          error: error instanceof Error ? error.stack : error,
          duration_ms: Math.round(performance.now() - startTime),
        });
      }

      return NextResponse.json(
        {
          code: apiError.code,
          message: apiError.message,
          ...(apiError.details && { details: apiError.details }),
        },
        { status: apiError.status }
      );
    }
  };
}

// ─── Convenience Exports ────────────────────────────────────────────

export const RATE_LIMITS = {
  strict: { windowMs: 60_000, maxRequests: 10, keyPrefix: "strict" } as RateLimitConfig,
  standard: { windowMs: 60_000, maxRequests: 60, keyPrefix: "standard" } as RateLimitConfig,
  relaxed: { windowMs: 60_000, maxRequests: 200, keyPrefix: "relaxed" } as RateLimitConfig,
};
