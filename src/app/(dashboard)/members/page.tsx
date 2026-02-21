"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

interface Member {
  id: string;
  user_id: string;
  role: "admin" | "member" | "viewer";
  joined_at: string;
  profile: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
}

const ROLE_BADGES: Record<string, { label: string; color: string }> = {
  admin: { label: "Admin", color: "bg-purple-100 text-purple-700" },
  member: { label: "Member", color: "bg-blue-100 text-blue-700" },
  viewer: { label: "Viewer", color: "bg-gray-100 text-gray-600" },
};

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const supabase = createBrowserClient();

  useEffect(() => {
    fetchMembers();
    fetchInvites();
  }, []);

  async function fetchMembers() {
    const { data } = await supabase
      .from("organization_members")
      .select(`
        id, user_id, role, joined_at,
        profile:profiles(full_name, email, avatar_url)
      `)
      .order("joined_at", { ascending: true });
    if (data) setMembers(data as unknown as Member[]);
    setLoading(false);
  }

  async function fetchInvites() {
    const res = await fetch("/api/invites?org_id=current");
    if (res.ok) {
      const { invites: data } = await res.json();
      setInvites(data || []);
    }
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSending(true);

    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inviteEmail,
        role: inviteRole,
        org_id: "current",
      }),
    });

    if (res.ok) {
      setInviteEmail("");
      fetchInvites();
    }
    setSending(false);
  }

  async function revokeInvite(inviteId: string) {
    await fetch("/api/invites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_id: inviteId, org_id: "current" }),
    });
    fetchInvites();
  }

  async function updateRole(memberId: string, newRole: string) {
    await supabase
      .from("organization_members")
      .update({ role: newRole })
      .eq("id", memberId);
    fetchMembers();
  }

  async function removeMember(memberId: string) {
    if (!confirm("Are you sure you want to remove this member?")) return;
    await supabase
      .from("organization_members")
      .delete()
      .eq("id", memberId);
    fetchMembers();
  }
  const filteredMembers = members.filter(
    (m) =>
      m.profile.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.profile.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
          <p className="text-gray-500 mt-1">
            {members.length} member{members.length !== 1 ? "s" : ""} &middot;{" "}
            {invites.length} pending invite{invites.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Invite Form */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Invite a team member</h2>
        <form onSubmit={sendInvite} className="flex gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
            required
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "admin" | "member" | "viewer")}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            type="submit"
            disabled={sending}
            className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors font-medium"
          >
            {sending ? "Sending..." : "Send Invite"}
          </button>
        </form>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search members..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
        />
      </div>

      {/* Members List */}
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {filteredMembers.map((member) => (
          <div key={member.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                {member.profile.avatar_url ? (
                  <img
                    src={member.profile.avatar_url}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  member.profile.full_name?.charAt(0)?.toUpperCase() || "?"
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900">{member.profile.full_name}</p>
                <p className="text-sm text-gray-500">{member.profile.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGES[member.role]?.color}`}>
                {ROLE_BADGES[member.role]?.label}
              </span>
              <select
                value={member.role}
                onChange={(e) => updateRole(member.id, e.target.value)}
                className="text-sm border border-gray-200 rounded px-2 py-1 bg-white"
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={() => removeMember(member.id)}
                className="text-sm text-red-500 hover:text-red-700 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      {/* Pending Invites */}
      {invites.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">Pending Invites</h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {invites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center">
                    <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{invite.email}</p>
                    <p className="text-sm text-gray-500">
                      Invited as {invite.role} &middot; Expires{" "}
                      {new Date(invite.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => revokeInvite(invite.id)}
                  className="text-sm text-gray-400 hover:text-red-500 transition-colors"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
