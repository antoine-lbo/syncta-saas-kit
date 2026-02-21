import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * Next.js middleware for Supabase auth session management.
 * Handles:
 * - Session refresh on every request
 * - Protected route enforcement
 * - Role-based access control for admin routes
 * - Redirect logic for auth pages when already logged in
 */

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/reset-password",
  "/auth/callback",
  "/api/webhooks/stripe",
  "/api/health",
];

const ADMIN_ROUTES = ["/dashboard/admin", "/dashboard/settings/team"];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req, res });

  // Refresh session — this is required to keep the session alive
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    // If user is logged in and tries to access auth pages, redirect to dashboard
    if (session && ["/login", "/signup"].includes(pathname)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return res;
  }

  // Protect all /dashboard routes
  if (!session && pathname.startsWith("/dashboard")) {
    const redirectUrl = new URL("/login", req.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Admin route protection
  if (ADMIN_ROUTES.some((route) => pathname.startsWith(route))) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", session?.user.id ?? "")
      .single();

    if (!membership || membership.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // Check subscription status for premium routes
  if (pathname.startsWith("/dashboard/billing") || pathname.startsWith("/dashboard/analytics")) {
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status, plan_id")
      .eq("user_id", session?.user.id ?? "")
      .single();

    if (!subscription || subscription.status !== "active") {
      return NextResponse.redirect(new URL("/dashboard/upgrade", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
