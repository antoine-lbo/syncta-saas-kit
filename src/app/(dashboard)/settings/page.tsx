import { redirect } from "next/navigation";
import { createClient, getUser, getUserProfile, getSubscription } from "@/lib/supabase/server";

export const metadata = {
  title: "Settings | Syncta",
  description: "Manage your account, team, and billing settings.",
};

async function getTeamMembers(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_members")
    .select("user_id, role, created_at, profiles(full_name, email, avatar_url)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });
  return data || [];
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50">
      <div className="border-b border-zinc-800 p-6">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-zinc-400">{description}</p>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    free: "bg-zinc-700 text-zinc-300",
    pro: "bg-blue-900/50 text-blue-300",
    enterprise: "bg-purple-900/50 text-purple-300",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[plan] || colors.free}`}>
      {plan.charAt(0).toUpperCase() + plan.slice(1)}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin: "bg-amber-900/50 text-amber-300",
    member: "bg-zinc-700 text-zinc-300",
    viewer: "bg-zinc-800 text-zinc-400",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[role] || colors.member}`}>
      {role}
    </span>
  );
}

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getUserProfile();
  if (!profile?.organization_members?.[0]) redirect("/onboarding");

  const orgId = profile.organization_members[0].organization_id;
  const [subscription, members] = await Promise.all([
    getSubscription(),
    getTeamMembers(orgId),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-zinc-400 mt-1">Manage your account and organization.</p>
      </div>

      {/* Profile Section */}
      <SettingsSection title="Profile" description="Your personal account information.">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-zinc-800 flex items-center justify-center text-xl font-bold text-zinc-400">
              {profile.full_name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div>
              <p className="font-medium text-white">{profile.full_name || "No name set"}</p>
              <p className="text-sm text-zinc-400">{profile.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Full Name</label>
              <input
                type="text"
                defaultValue={profile.full_name || ""}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Email</label>
              <input
                type="email"
                defaultValue={profile.email}
                disabled
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-zinc-400 cursor-not-allowed"
              />
            </div>
          </div>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition">
            Save Changes
          </button>
        </div>
      </SettingsSection>

      {/* Team Members */}
      <SettingsSection title="Team Members" description="Manage who has access to your organization.">
        <div className="space-y-3">
          {members.map((member: any) => (
            <div key={member.user_id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-medium text-zinc-400">
                  {member.profiles?.full_name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {member.profiles?.full_name || member.profiles?.email}
                  </p>
                  <p className="text-xs text-zinc-500">{member.profiles?.email}</p>
                </div>
              </div>
              <RoleBadge role={member.role} />
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <button className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition">
            Invite Member
          </button>
        </div>
      </SettingsSection>

      {/* Billing */}
      <SettingsSection title="Billing & Plan" description="Manage your subscription and billing details.">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-white">Current Plan</p>
              <PlanBadge plan={subscription?.plan || "free"} />
            </div>
            <p className="text-sm text-zinc-400 mt-1">
              {subscription?.status === "active"
                ? `Renews ${new Date(subscription.current_period_end).toLocaleDateString()}`
                : "No active subscription"}
            </p>
          </div>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition">
            {subscription?.plan === "free" ? "Upgrade" : "Manage Billing"}
          </button>
        </div>
      </SettingsSection>

      {/* Danger Zone */}
      <SettingsSection title="Danger Zone" description="Irreversible and destructive actions.">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-red-400">Delete Organization</p>
            <p className="text-sm text-zinc-500">Permanently delete your organization and all data.</p>
          </div>
          <button className="rounded-lg border border-red-800 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-900/20 transition">
            Delete
          </button>
        </div>
      </SettingsSection>
    </div>
  );
}
