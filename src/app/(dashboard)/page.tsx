import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient, getUser, getUserProfile } from "@/lib/supabase/server";
import { AnalyticsCards } from "@/components/dashboard/analytics-cards";

// Dashboard page — Server Component
// Fetches user data server-side, renders analytics client-side

export const metadata = {
  title: "Dashboard | Syncta",
  description: "View your analytics, team activity, and subscription usage.",
};

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-lg bg-zinc-800/50 animate-pulse"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-80 rounded-lg bg-zinc-800/50 animate-pulse" />
        <div className="h-80 rounded-lg bg-zinc-800/50 animate-pulse" />
      </div>
    </div>
  );
}

interface RecentActivity {
  id: string;
  type: "member_joined" | "subscription_changed" | "usage_spike" | "invite_sent";
  description: string;
  timestamp: string;
}

async function getRecentActivity(orgId: string): Promise<RecentActivity[]> {
  const supabase = await createClient();

  // Fetch recent org members
  const { data: recentMembers } = await supabase
    .from("organization_members")
    .select("user_id, created_at, profiles(full_name, email)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(5);

  // Fetch recent usage spikes
  const { data: usageRecords } = await supabase
    .from("usage_records")
    .select("feature, quantity, recorded_at")
    .eq("organization_id", orgId)
    .order("recorded_at", { ascending: false })
    .limit(10);

  const activities: RecentActivity[] = [];

  recentMembers?.forEach((member: any) => {
    activities.push({
      id: member.user_id,
      type: "member_joined",
      description: `${member.profiles?.full_name || member.profiles?.email} joined the team`,
      timestamp: member.created_at,
    });
  });

  usageRecords?.forEach((record: any) => {
    if (record.quantity > 100) {
      activities.push({
        id: `usage-${record.recorded_at}`,
        type: "usage_spike",
        description: `High usage detected: ${record.feature} (${record.quantity} requests)`,
        timestamp: record.recorded_at,
      });
    }
  });

  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);
}

function ActivityIcon({ type }: { type: RecentActivity["type"] }) {
  const icons = {
    member_joined: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    subscription_changed: "M2 10h20M22 10v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8",
    usage_spike: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
    invite_sent: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  };

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d={icons[type]} />
    </svg>
  );
}

function formatTimeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getUserProfile();
  if (!profile?.organization_members?.[0]?.organization_id) {
    redirect("/onboarding");
  }

  const orgId = profile.organization_members[0].organization_id;
  const activities = await getRecentActivity(orgId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-zinc-400 mt-1">
          Here's what's happening with your project today.
        </p>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <AnalyticsCards />
      </Suspense>

      {/* Recent Activity */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
        {activities.length === 0 ? (
          <p className="text-zinc-500 text-sm">No recent activity to show.</p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center gap-3 text-sm"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                  <ActivityIcon type={activity.type} />
                </div>
                <span className="text-zinc-300 flex-1">{activity.description}</span>
                <span className="text-zinc-500 text-xs">
                  {formatTimeAgo(activity.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
