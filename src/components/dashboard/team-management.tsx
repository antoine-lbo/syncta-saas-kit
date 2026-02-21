"use client";

import { useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Database } from "@/types/database";

// ─── Types ──────────────────────────────────────────────

type Role = "admin" | "member" | "viewer";

interface TeamMember {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: Role;
  joinedAt: string;
  status: "active" | "invited" | "suspended";
}

interface Invitation {
  id: string;
  email: string;
  role: Role;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
}

interface TeamManagementProps {
  organizationId: string;
  currentUserRole: Role;
  members: TeamMember[];
  pendingInvitations: Invitation[];
}

// ─── Role Badge ─────────────────────────────────────────

function RoleBadge({ role }: { role: Role }) {
  const colors: Record<Role, string> = {
    admin: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    member: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    viewer: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[role]}`}
    >
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

// ─── Invite Form ────────────────────────────────────────

function InviteForm({
  organizationId,
  onInviteSent,
}: {
  organizationId: string;
  onInviteSent: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, organizationId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send invitation");
      }

      setEmail("");
      setRole("member");
      onInviteSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleInvite} className="flex gap-3 items-end">
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Email address
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@company.com"
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
            focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
            dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Role
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm
            dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="viewer">Viewer</option>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={loading || !email}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white
          hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Sending..." : "Send Invite"}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}

// ─── Main Component ─────────────────────────────────────

export default function TeamManagement({
  organizationId,
  currentUserRole,
  members: initialMembers,
  pendingInvitations: initialInvitations,
}: TeamManagementProps) {
  const supabase = createClientComponentClient<Database>();
  const [members, setMembers] = useState(initialMembers);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [updatingMember, setUpdatingMember] = useState<string | null>(null);
  const isAdmin = currentUserRole === "admin";

  const refreshData = async () => {
    const [membersRes, invitesRes] = await Promise.all([
      supabase
        .from("organization_members")
        .select("*, profiles(email, full_name, avatar_url)")
        .eq("organization_id", organizationId)
        .eq("status", "active"),
      supabase
        .from("invitations")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("status", "pending"),
    ]);

    if (membersRes.data) {
      setMembers(
        membersRes.data.map((m: any) => ({
          id: m.id,
          userId: m.user_id,
          email: m.profiles?.email || "",
          name: m.profiles?.full_name || null,
          avatarUrl: m.profiles?.avatar_url || null,
          role: m.role as Role,
          joinedAt: m.created_at,
          status: m.status,
        }))
      );
    }

    if (invitesRes.data) {
      setInvitations(
        invitesRes.data.map((i: any) => ({
          id: i.id,
          email: i.email,
          role: i.role as Role,
          invitedBy: i.invited_by,
          createdAt: i.created_at,
          expiresAt: i.expires_at,
        }))
      );
    }
  };

  const updateRole = async (memberId: string, newRole: Role) => {
    setUpdatingMember(memberId);
    const { error } = await supabase
      .from("organization_members")
      .update({ role: newRole })
      .eq("id", memberId);

    if (!error) {
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
    }
    setUpdatingMember(null);
  };

  const removeMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;

    const { error } = await supabase
      .from("organization_members")
      .delete()
      .eq("id", memberId);

    if (!error) {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    }
  };

  const revokeInvitation = async (invitationId: string) => {
    const { error } = await supabase
      .from("invitations")
      .delete()
      .eq("id", invitationId);

    if (!error) {
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    }
  };
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Team Members
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {members.length} member{members.length !== 1 ? "s" : ""}{" "}
            {invitations.length > 0 &&
              `\u00b7 ${invitations.length} pending invitation${
                invitations.length !== 1 ? "s" : ""
              }`}
          </p>
        </div>
      </div>

      {/* Invite Form (admin only) */}
      {isAdmin && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <h3 className="mb-3 text-sm font-medium text-gray-900 dark:text-white">
            Invite new member
          </h3>
          <InviteForm
            organizationId={organizationId}
            onInviteSent={refreshData}
          />
        </div>
      )}

      {/* Members List */}
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Member
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Joined
              </th>
              {isAdmin && (
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt=""
                          className="h-8 w-8 rounded-full"
                        />
                      ) : (
                        <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                          {(member.name || member.email)[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {member.name || "Unnamed"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {member.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  {isAdmin && member.role !== "admin" ? (
                    <select
                      value={member.role}
                      onChange={(e) => updateRole(member.id, e.target.value as Role)}
                      disabled={updatingMember === member.id}
                      className="rounded border border-gray-300 px-2 py-1 text-xs
                        dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <RoleBadge role={member.role} />
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {new Date(member.joinedAt).toLocaleDateString()}
                </td>
                {isAdmin && (
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    {member.role !== "admin" && (
                      <button
                        onClick={() => removeMember(member.id)}
                        className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-gray-900 dark:text-white">
            Pending Invitations
          </h3>
          <div className="space-y-2">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between rounded-lg border
                  border-dashed border-gray-300 px-4 py-3
                  dark:border-gray-600"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800
                    flex items-center justify-center"
                  >
                    <svg
                      className="h-4 w-4 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {invitation.email}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Invited as <RoleBadge role={invitation.role} />{" "}
                      {new Date(invitation.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => revokeInvitation(invitation.id)}
                    className="text-xs text-gray-500 hover:text-red-600
                      dark:text-gray-400 dark:hover:text-red-400"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
