"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Settings,
  BarChart3,
  FileText,
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  HelpCircle,
  Zap,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const MAIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Team", href: "/members", icon: Users },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Integrations", href: "/integrations", icon: Zap, badge: "New" },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Notifications", href: "/notifications", icon: Bell },
];

const BOTTOM_NAV: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Help & Support", href: "/help", icon: HelpCircle },
];

interface SidebarProps {
  orgName?: string;
  orgLogo?: string;
  userName?: string;
  userEmail?: string;
  userAvatar?: string;
  plan?: "starter" | "pro" | "enterprise";
}

export default function Sidebar({
  orgName = "My Organization",
  orgLogo,
  userName = "Antoine Batreau",
  userEmail = "antoine@syncta.ai",
  userAvatar,
  plan = "pro",
}: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const planColors = {
    starter: "bg-gray-100 text-gray-600",
    pro: "bg-indigo-100 text-indigo-700",
    enterprise: "bg-amber-100 text-amber-700",
  };
  return (
    <aside
      className={`
        flex flex-col border-r border-gray-200 bg-white transition-all duration-300
        ${collapsed ? "w-[68px]" : "w-[260px]"}
      `}
    >
      {/* Organization header */}
      <div className="flex h-16 items-center justify-between border-b border-gray-100 px-4">
        {!collapsed && (
          <div className="flex items-center gap-3 overflow-hidden">
            {orgLogo ? (
              <img src={orgLogo} alt={orgName} className="h-8 w-8 rounded-lg" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
                {orgName.charAt(0)}
              </div>
            )}
            <div className="truncate">
              <p className="truncate text-sm font-semibold text-gray-900">{orgName}</p>
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${planColors[plan]}`}>
                {plan}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {MAIN_NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                ${active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }
                ${collapsed ? "justify-center px-2" : ""}
              `}
              title={collapsed ? item.label : undefined}
            >
              <item.icon
                className={`h-5 w-5 shrink-0 ${
                  active ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-600"
                }`}
              />
              {!collapsed && (
                <>
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>
      {/* Bottom navigation */}
      <div className="border-t border-gray-100 px-3 py-3">
        {BOTTOM_NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
                ${active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }
                ${collapsed ? "justify-center px-2" : ""}
              `}
              title={collapsed ? item.label : undefined}
            >
              <item.icon
                className={`h-5 w-5 shrink-0 ${
                  active ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-500"
                }`}
              />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </div>

      {/* User profile */}
      <div className="border-t border-gray-200 p-3">
        <div
          className={`flex items-center gap-3 rounded-lg p-2 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          {userAvatar ? (
            <img
              src={userAvatar}
              alt={userName}
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white">
              {userName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
          )}
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-gray-900">
                {userName}
              </p>
              <p className="truncate text-xs text-gray-500">{userEmail}</p>
            </div>
          )}
          {!collapsed && (
            <button
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Sign out"
              onClick={() => {
                // Handle sign out via Supabase
                window.location.href = "/api/auth/signout";
              }}
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
