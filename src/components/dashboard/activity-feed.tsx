"use client";

import { useEffect, useState, useCallback } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/database";

// ─── Types ────────────────────────────────────────────────────────

type ActivityType =
  | "member_joined"
  | "member_invited"
  | "member_removed"
  | "role_changed"
  | "api_key_created"
  | "api_key_revoked"
  | "subscription_updated"
  | "settings_changed"
  | "workflow_created"
  | "workflow_deleted"
  | "integration_connected"
  | "integration_disconnected";

interface ActivityEvent {
  id: string;
  type: ActivityType;
  actor: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
  };
  target?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  organization_id: string;
}

interface ActivityFeedProps {
  organizationId: string;
  limit?: number;
  showFilters?: boolean;
}

// ─── Activity Icons & Colors ─────────────────────────────────────

const ACTIVITY_CONFIG: Record<
  ActivityType,
  { icon: string; color: string; bgColor: string; label: string }
> = {
  member_joined: {
    icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z",
    color: "text-green-500",
    bgColor: "bg-green-50 dark:bg-green-950",
    label: "joined the team",
  },
  member_invited: {
    icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    label: "invited",
  },
  member_removed: {
    icon: "M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6",
    color: "text-red-500",
    bgColor: "bg-red-50 dark:bg-red-950",
    label: "removed",
  },
  role_changed: {
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    color: "text-purple-500",
    bgColor: "bg-purple-50 dark:bg-purple-950",
    label: "changed role of",
  },
  api_key_created: {
    icon: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z",
    color: "text-yellow-500",
    bgColor: "bg-yellow-50 dark:bg-yellow-950",
    label: "created an API key",
  },
  api_key_revoked: {
    icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
    color: "text-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-950",
    label: "revoked an API key",
  },
  subscription_updated: {
    icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
    color: "text-indigo-500",
    bgColor: "bg-indigo-50 dark:bg-indigo-950",
    label: "updated subscription to",
  },
  settings_changed: {
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
    color: "text-gray-500",
    bgColor: "bg-gray-50 dark:bg-gray-800",
    label: "updated settings",
  },
  workflow_created: {
    icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
    color: "text-teal-500",
    bgColor: "bg-teal-50 dark:bg-teal-950",
    label: "created workflow",
  },
  workflow_deleted: {
    icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
    color: "text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950",
    label: "deleted workflow",
  },
  integration_connected: {
    icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
    color: "text-emerald-500",
    bgColor: "bg-emerald-50 dark:bg-emerald-950",
    label: "connected",
  },
  integration_disconnected: {
    icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
    color: "text-gray-400",
    bgColor: "bg-gray-50 dark:bg-gray-800",
    label: "disconnected",
  },
};

// ─── Helper Components ───────────────────────────────────────────

function ActivityIcon({ type }: { type: ActivityType }) {
  const config = ACTIVITY_CONFIG[type];
  return (
    <div
      className={`flex h-8 w-8 items-center justify-center rounded-full ${config.bgColor}`}
    >
      <svg
        className={`h-4 w-4 ${config.color}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
      </svg>
    </div>
  );
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="h-6 w-6 rounded-full ring-2 ring-white dark:ring-gray-900"
      />
    );
  }

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600 ring-2 ring-white dark:bg-gray-700 dark:text-gray-300 dark:ring-gray-900">
      {initials}
    </div>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function buildActivityMessage(event: ActivityEvent): string {
  const config = ACTIVITY_CONFIG[event.type];
  const target = event.target ? ` ${event.target}` : "";

  switch (event.type) {
    case "subscription_updated":
      return `${config.label} ${(event.metadata?.plan as string) || "unknown"}`;
    case "role_changed":
      return `${config.label} ${event.target} to ${(event.metadata?.new_role as string) || "member"}`;
    default:
      return `${config.label}${target}`;
  }
}

// ─── Filter Component ────────────────────────────────────────────

const FILTER_GROUPS = [
  { label: "All", value: "all" },
  { label: "Team", value: "team", types: ["member_joined", "member_invited", "member_removed", "role_changed"] },
  { label: "API", value: "api", types: ["api_key_created", "api_key_revoked"] },
  { label: "Billing", value: "billing", types: ["subscription_updated"] },
  { label: "Workflows", value: "workflows", types: ["workflow_created", "workflow_deleted"] },
  { label: "Integrations", value: "integrations", types: ["integration_connected", "integration_disconnected"] },
] as const;

function ActivityFilter({
  activeFilter,
  onFilterChange,
}: {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FILTER_GROUPS.map((group) => (
        <button
          key={group.value}
          onClick={() => onFilterChange(group.value)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            activeFilter === group.value
              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          }`}
        >
          {group.label}
        </button>
      ))}
    </div>
  );
}

// ─── Activity Item ──────────────────────────────────────────────

function ActivityItem({
  event,
  isLast,
}: {
  event: ActivityEvent;
  isLast: boolean;
}) {
  return (
    <div className="relative flex gap-3 pb-6">
      {/* Timeline connector */}
      {!isLast && (
        <div className="absolute left-4 top-8 h-full w-px bg-gray-200 dark:bg-gray-700" />
      )}

      {/* Icon */}
      <div className="relative z-10 flex-shrink-0">
        <ActivityIcon type={event.type} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Avatar name={event.actor.name} avatarUrl={event.actor.avatar_url} />
          <p className="text-sm text-gray-900 dark:text-gray-100">
            <span className="font-medium">{event.actor.name}</span>{" "}
            <span className="text-gray-500 dark:text-gray-400">
              {buildActivityMessage(event)}
            </span>
          </p>
        </div>
        <p className="mt-0.5 pl-8 text-xs text-gray-400 dark:text-gray-500">
          {formatRelativeTime(event.created_at)}
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export default function ActivityFeed({
  organizationId,
  limit = 20,
  showFilters = true,
}: ActivityFeedProps) {
  const supabase = createClientComponentClient<Database>();
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const fetchActivities = useCallback(
    async (pageNum: number, append = false) => {
      setLoading(true);

      let query = supabase
        .from("audit_logs")
        .select(`
          id,
          action,
          target,
          metadata,
          created_at,
          organization_id,
          profiles!audit_logs_user_id_fkey (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .range(pageNum * limit, (pageNum + 1) * limit);

      // Apply type filter
      if (activeFilter !== "all") {
        const group = FILTER_GROUPS.find((g) => g.value === activeFilter);
        if (group && "types" in group) {
          query = query.in("action", group.types as unknown as string[]);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error("Failed to fetch activities:", error);
        setLoading(false);
        return;
      }

      const mapped: ActivityEvent[] = (data || []).map((row: any) => ({
        id: row.id,
        type: row.action as ActivityType,
        actor: {
          id: row.profiles?.id || "unknown",
          name: row.profiles?.full_name || "Unknown User",
          email: row.profiles?.email || "",
          avatar_url: row.profiles?.avatar_url || undefined,
        },
        target: row.target,
        metadata: row.metadata,
        created_at: row.created_at,
        organization_id: row.organization_id,
      }));

      setHasMore(mapped.length > limit);
      const trimmed = mapped.slice(0, limit);

      if (append) {
        setActivities((prev) => [...prev, ...trimmed]);
      } else {
        setActivities(trimmed);
      }

      setLoading(false);
    },
    [supabase, organizationId, activeFilter, limit]
  );

  // Fetch on mount and filter change
  useEffect(() => {
    setPage(0);
    fetchActivities(0);
  }, [fetchActivities]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`activity-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_logs",
          filter: `organization_id=eq.${organizationId}`,
        },
        async (payload) => {
          // Fetch the full record with profile join
          const { data } = await supabase
            .from("audit_logs")
            .select(`
              id, action, target, metadata, created_at, organization_id,
              profiles!audit_logs_user_id_fkey (id, full_name, email, avatar_url)
            `)
            .eq("id", payload.new.id)
            .single();

          if (data) {
            const newEvent: ActivityEvent = {
              id: data.id,
              type: data.action as ActivityType,
              actor: {
                id: (data as any).profiles?.id || "unknown",
                name: (data as any).profiles?.full_name || "Unknown User",
                email: (data as any).profiles?.email || "",
                avatar_url: (data as any).profiles?.avatar_url || undefined,
              },
              target: data.target,
              metadata: data.metadata as Record<string, unknown>,
              created_at: data.created_at,
              organization_id: data.organization_id,
            };

            // Check if it matches the current filter
            if (activeFilter !== "all") {
              const group = FILTER_GROUPS.find((g) => g.value === activeFilter);
              if (group && "types" in group && !group.types.includes(newEvent.type as any)) {
                return;
              }
            }

            setActivities((prev) => [newEvent, ...prev].slice(0, limit));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, organizationId, activeFilter, limit]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchActivities(nextPage, true);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Activity Feed
            </h3>
            {activities.length > 0 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                {activities.length}
              </span>
            )}
          </div>
          <div className="flex h-2 w-2 items-center">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className="ml-2 text-xs text-gray-400">Live</span>
          </div>
        </div>

        {showFilters && (
          <div className="mt-3">
            <ActivityFilter
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
            />
          </div>
        )}
      </div>

      {/* Activity List */}
      <div className="px-5 py-4">
        {loading && activities.length === 0 ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex animate-pulse gap-3">
                <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-3 w-1/4 rounded bg-gray-100 dark:bg-gray-800" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="py-8 text-center">
            <svg
              className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              No activity yet
            </p>
          </div>
        ) : (
          <div>
            {activities.map((event, index) => (
              <ActivityItem
                key={event.id}
                event={event}
                isLast={index === activities.length - 1}
              />
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className="mt-2 text-center">
            <button
              onClick={handleLoadMore}
              disabled={loading}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              {loading ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
