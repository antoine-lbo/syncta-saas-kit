/**
 * Dashboard Layout
 *
 * Shared layout for all authenticated dashboard routes.
 * Handles session validation, sidebar navigation, and responsive
 * layout with collapsible sidebar for mobile views.
 *
 * @module app/(dashboard)/layout
 */

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";
import { DashboardProviders } from "./providers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  plan: "free" | "starter" | "pro" | "enterprise";
  created_at: string;
}

export interface DashboardUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "owner" | "admin" | "member" | "viewer";
  organization: Organization;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getDashboardUser(): Promise<DashboardUser | null> {
  const supabase = createServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) return null;

  // Fetch user profile with organization details in a single query
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      `
      id,
      email,
      full_name,
      avatar_url,
      role,
      organization:organizations (
        id,
        name,
        slug,
        logo_url,
        plan,
        created_at
      )
    `
    )
    .eq("id", session.user.id)
    .single();

  if (!profile) return null;
  return {
    ...profile,
    organization: Array.isArray(profile.organization)
      ? profile.organization[0]
      : profile.organization,
  } as DashboardUser;
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata = {
  title: {
    template: "%s | Syncta Dashboard",
    default: "Dashboard | Syncta",
  },
  description: "Manage your Syncta workspace",
};

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const user = await getDashboardUser();

  // Redirect unauthenticated users to login
  if (!user) {
    const headersList = headers();
    const pathname = (await headersList).get("x-pathname") ?? "/";
    redirect(`/login?redirect=${encodeURIComponent(pathname)}`);
  }

  // Redirect users without an organization to onboarding
  if (!user.organization) {
    redirect("/onboarding");
  }

  return (
    <DashboardProviders user={user} organization={user.organization}>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        {/* Sidebar navigation */}
        <Sidebar
          user={{
            name: user.full_name ?? user.email,
            email: user.email,
            avatar: user.avatar_url,
            role: user.role,
          }}
          organization={{
            name: user.organization.name,
            logo: user.organization.logo_url,
            plan: user.organization.plan,
          }}
        />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto">
          {/* Top bar with breadcrumbs & actions */}
          <div className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-white/80 px-6 backdrop-blur-sm">
            <MobileMenuTrigger />
            <div className="flex-1" />
            <NotificationBell userId={user.id} />
            <UserMenu user={user} />
          </div>

          {/* Page content */}
          <div className="mx-auto max-w-7xl px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </DashboardProviders>
  );
}
// ---------------------------------------------------------------------------
// Client-side helper components
// ---------------------------------------------------------------------------

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DashboardUser } from "./layout";

/** Mobile hamburger menu trigger */
function MobileMenuTrigger() {
  return (
    <button
      className="lg:hidden -ml-2 rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      aria-label="Open sidebar"
      onClick={() => {
        document.dispatchEvent(new CustomEvent("toggle-sidebar"));
      }}
    >
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
      </svg>
    </button>
  );
}

/** Notification bell with unread count badge */
function NotificationBell({ userId }: { userId: string }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Subscribe to real-time notifications via Supabase
    const fetchUnread = async () => {
      try {
        const res = await fetch(`/api/notifications/unread?userId=${userId}`);
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.count ?? 0);
        }
      } catch {
        // Silently fail — non-critical feature
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30_000);
    return () => clearInterval(interval);
  }, [userId]);

  return (
    <button
      className="relative rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}
/** User avatar dropdown menu */
function UserMenu({ user }: { user: DashboardUser }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close menu on route change
  useEffect(() => setOpen(false), [pathname]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = (user.full_name ?? user.email)
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full p-1 hover:bg-gray-100"
        aria-expanded={open}
        aria-haspopup="true"
      >
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
            {initials}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-lg border bg-white py-1 shadow-lg ring-1 ring-black/5">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-medium text-gray-900">
              {user.full_name ?? "User"}
            </p>
            <p className="truncate text-xs text-gray-500">{user.email}</p>
          </div>
          <Link href="/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Settings
          </Link>
          <Link href="/billing" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Billing
          </Link>
          <div className="border-t">
            <form action="/auth/signout" method="POST">
              <button
                type="submit"
                className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
