import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Auth callback handler for Supabase OAuth and magic link flows.
 * Exchanges the auth code for a session and redirects to the dashboard.
 *
 * Flow:
 * 1. User clicks OAuth/magic link
 * 2. Supabase redirects to /auth/callback?code=xxx
 * 3. This route exchanges the code for a session
 * 4. User is redirected to /dashboard or /onboarding
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle OAuth errors (e.g., user denied access)
  if (error) {
    console.error(`Auth callback error: ${error} - ${errorDescription}`);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (code) {
    const cookieStore = cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method is called from a Server Component.
              // This can be ignored if middleware refreshes sessions.
            }
          },
        },
      }
    );

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("Failed to exchange code for session:", exchangeError.message);
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent("Authentication failed. Please try again.")}`
      );
    }

    // Check if user needs onboarding (no organization yet)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: memberships } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1);

      // Redirect to onboarding if user has no organization
      if (!memberships || memberships.length === 0) {
        return NextResponse.redirect(`${origin}/onboarding`);
      }
    }

    // Redirect to the intended destination
    return NextResponse.redirect(`${origin}${next}`);
  }

  // No code provided — redirect to login
  return NextResponse.redirect(`${origin}/login`);
}
