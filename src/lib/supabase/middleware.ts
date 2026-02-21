import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// =============================================================================
// Supabase Auth Middleware for Next.js 14
// Handles session refresh, route protection, org-based access control,
// and role-based authorization with support for custom redirects.
// =============================================================================

// --- Types ---

type UserRole = "owner" | "admin" | "member" | "viewer";

interface RouteConfig {
  pattern: RegExp;
  requireAuth: boolean;
  requiredRoles?: UserRole[];
  requireOrg?: boolean;
  redirectTo?: string;
}

interface OrgMembership {
  org_id: string;
  role: UserRole;
  is_active: boolean;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// --- Configuration ---

const PUBLIC_ROUTES: string[] = [
  "/",
  "/pricing",
  "/blog",
  "/docs",
  "/changelog",
  "/legal/privacy",
  "/legal/terms",
];

const AUTH_ROUTES: string[] = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

const ROUTE_CONFIG: RouteConfig[] = [
  {
    pattern: /^\/dashboard\/([^/]+)\/settings/,
    requireAuth: true,
    requireOrg: true,
    requiredRoles: ["owner", "admin"],
    redirectTo: "/dashboard",
  },
  {
    pattern: /^\/dashboard\/([^/]+)\/billing/,
    requireAuth: true,
    requireOrg: true,
    requiredRoles: ["owner"],
    redirectTo: "/dashboard",
  },
  {
    pattern: /^\/dashboard\/([^/]+)\/members/,
    requireAuth: true,
    requireOrg: true,
    requiredRoles: ["owner", "admin"],
  },
  {
    pattern: /^\/dashboard\/([^/]+)/,
    requireAuth: true,
    requireOrg: true,
  },
  {
    pattern: /^\/dashboard/,
    requireAuth: true,
  },
  {
    pattern: /^\/api\//,
    requireAuth: true,
  },
  {
    pattern: /^\/onboarding/,
    requireAuth: true,
  },
];

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;
const rateLimitStore = new Map<string, RateLimitEntry>();
// --- Supabase Client Factory ---

function createMiddlewareClient(request: NextRequest, response: NextResponse) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  return supabase;
}

// --- Helper Functions ---

function isPublicRoute(pathname: string): boolean {
  return (
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith("/blog/") ||
    pathname.startsWith("/docs/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff2?)$/) !== null
  );
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname.startsWith(route));
}

function extractOrgSlug(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/([^/]+)/);
  return match ? match[1] : null;
}

function getMatchingRouteConfig(pathname: string): RouteConfig | null {
  return ROUTE_CONFIG.find((config) => config.pattern.test(pathname)) ?? null;
}

function checkRateLimit(identifier: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + RATE_LIMIT_WINDOW;
    rateLimitStore.set(identifier, { count: 1, resetAt });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetAt };
  }

  entry.count += 1;
  const allowed = entry.count <= RATE_LIMIT_MAX_REQUESTS;
  const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - entry.count);

  return { allowed, remaining, resetAt: entry.resetAt };
}
// --- Organization Access ---

async function getOrgMembership(
  supabase: ReturnType<typeof createMiddlewareClient>,
  userId: string,
  orgSlug: string
): Promise<OrgMembership | null> {
  const { data, error } = await supabase
    .from("org_members")
    .select("org_id, role, is_active, organizations!inner(slug)")
    .eq("user_id", userId)
    .eq("organizations.slug", orgSlug)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;

  return {
    org_id: data.org_id,
    role: data.role as UserRole,
    is_active: data.is_active,
  };
}

function hasRequiredRole(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    owner: 4,
    admin: 3,
    member: 2,
    viewer: 1,
  };

  const minRequired = Math.min(...requiredRoles.map((r) => roleHierarchy[r]));
  return roleHierarchy[userRole] >= minRequired;
}

// --- Security Headers ---

function addSecurityHeaders(response: NextResponse): void {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
}

// --- Main Middleware ---

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public routes and static assets
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Rate limiting for API routes
  if (pathname.startsWith("/api/")) {
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    const { allowed, remaining, resetAt } = checkRateLimit(clientIp);

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests", retryAfter: Math.ceil((resetAt - Date.now()) / 1000) },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }
  }
  // Create response and Supabase client
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createMiddlewareClient(request, response);

  // Refresh session — this is critical for keeping the session alive
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // If on an auth route and already logged in, redirect to dashboard
  if (isAuthRoute(pathname) && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  // Check route config for auth requirements
  const routeConfig = getMatchingRouteConfig(pathname);

  if (routeConfig?.requireAuth && (!user || authError)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Organization-scoped route checks
  if (routeConfig?.requireOrg && user) {
    const orgSlug = extractOrgSlug(pathname);

    if (!orgSlug) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      return NextResponse.redirect(redirectUrl);
    }

    const membership = await getOrgMembership(supabase, user.id, orgSlug);

    if (!membership) {
      // User is not a member of this organization
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      redirectUrl.searchParams.set("error", "org_access_denied");
      return NextResponse.redirect(redirectUrl);
    }

    // Role-based access check
    if (
      routeConfig.requiredRoles &&
      !hasRequiredRole(membership.role, routeConfig.requiredRoles)
    ) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = routeConfig.redirectTo ?? `/dashboard/${orgSlug}`;
      redirectUrl.searchParams.set("error", "insufficient_permissions");
      return NextResponse.redirect(redirectUrl);
    }

    // Inject org context into headers for downstream use
    response.headers.set("x-org-id", membership.org_id);
    response.headers.set("x-org-role", membership.role);
    response.headers.set("x-org-slug", orgSlug);
  }

  // Add security headers to all responses
  addSecurityHeaders(response);

  // Add rate limit headers for API routes
  if (pathname.startsWith("/api/")) {
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    const { remaining, resetAt } = checkRateLimit(clientIp);
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    response.headers.set("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
  }

  return response;
}

// --- Middleware Matcher ---

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
