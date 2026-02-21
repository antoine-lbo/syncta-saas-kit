/**
 * Supabase Server Client Configuration
 *
 * Server-side Supabase client for use in Server Components,
 * Route Handlers, and Server Actions. Uses the service role key
 * for admin operations, or cookie-based auth for user context.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import type { CookieOptions } from '@supabase/ssr';

/**
 * Create a Supabase client for server-side usage.
 * Handles cookie-based auth for Server Components and Route Handlers.
 *
 * Uses the anon key with cookie-based session management,
 * so all queries respect Row Level Security policies.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Cookie setting may fail in Server Components
            // This is expected behavior — cookies can only be set
            // in Route Handlers and Server Actions
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // Same as above
          }
        },
      },
    }
  );
}

/**
 * Create an admin Supabase client with the service role key.
 * CAUTION: This bypasses Row Level Security!
 * Only use for admin operations, webhooks, and background jobs.
 */
export function createAdminClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get() { return undefined; },
        set() {},
        remove() {},
      },
    }
  );
}

/**
 * Get the current authenticated user from the server context.
 * Returns null if not authenticated.
 */
export async function getUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

/**
 * Get user profile with organization membership.
 * Fetches the full profile including role and org details.
 */
export async function getUserProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, organization_members(*, organizations(*))')
    .eq('id', user.id)
    .single();

  return profile;
}

/**
 * Check if the current user has a specific role in their organization.
 */
export async function hasRole(role: 'admin' | 'member' | 'viewer') {
  const profile = await getUserProfile();
  if (!profile) return false;

  const membership = (profile as any).organization_members?.[0];
  if (!membership) return false;

  if (role === 'admin') return membership.role === 'admin';
  if (role === 'member') return ['admin', 'member'].includes(membership.role);
  return true; // viewer has minimum access
}

/**
 * Get the current subscription for the authenticated user.
 */
export async function getSubscription() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['active', 'trialing'])
    .single();

  return subscription;
}
