import { createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

interface InvitePayload {
  email: string;
  role: "admin" | "member" | "viewer";
  org_id: string;
}

// GET /api/invites - List pending invites for an organization
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = request.nextUrl.searchParams.get("org_id");
    if (!orgId) {
      return NextResponse.json({ error: "org_id is required" }, { status: 400 });
    }

    // Verify user is admin of this org
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .single();

    if (!membership || membership.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: invites, error } = await supabase
      .from("invites")
      .select("id, email, role, status, created_at, expires_at")
      .eq("org_id", orgId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ invites });
  } catch (error) {
    console.error("Failed to fetch invites:", error);
    return NextResponse.json(
      { error: "Failed to fetch invites" },
      { status: 500 }
    );
  }
}
// POST /api/invites - Send team invites
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, role, org_id }: InvitePayload = await request.json();

    if (!email || !role || !org_id) {
      return NextResponse.json(
        { error: "email, role, and org_id are required" },
        { status: 400 }
      );
    }

    // Verify sender is admin
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", org_id)
      .eq("user_id", user.id)
      .single();

    if (!membership || membership.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check for existing pending invite
    const { data: existingInvite } = await supabase
      .from("invites")
      .select("id")
      .eq("org_id", org_id)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvite) {
      return NextResponse.json(
        { error: "An invite is already pending for this email" },
        { status: 409 }
      );
    }

    // Generate invite token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Get org name for the email
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", org_id)
      .single();

    // Create invite record
    const { data: invite, error: insertError } = await supabase
      .from("invites")
      .insert({
        org_id,
        email,
        role,
        token,
        invited_by: user.id,
        status: "pending",
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;
    // Send invite email via Resend
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;

    await resend.emails.send({
      from: "noreply@syncta.ai",
      to: email,
      subject: `Join ${org?.name || "a team"} on Syncta`,
      html: buildInviteEmail({
        orgName: org?.name || "a team",
        inviterEmail: user.email || "A team member",
        role,
        inviteUrl,
        expiresAt,
      }),
    });

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    console.error("Failed to create invite:", error);
    return NextResponse.json(
      { error: "Failed to send invite" },
      { status: 500 }
    );
  }
}

// DELETE /api/invites - Revoke a pending invite
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { invite_id, org_id } = await request.json();

    // Verify admin permission
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", org_id)
      .eq("user_id", user.id)
      .single();

    if (!membership || membership.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabase
      .from("invites")
      .update({ status: "revoked" })
      .eq("id", invite_id)
      .eq("org_id", org_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to revoke invite:", error);
    return NextResponse.json(
      { error: "Failed to revoke invite" },
      { status: 500 }
    );
  }
}
// Helper: Build invite email HTML
function buildInviteEmail(params: {
  orgName: string;
  inviterEmail: string;
  role: string;
  inviteUrl: string;
  expiresAt: Date;
}) {
  const parts = [
    "<!DOCTYPE html>",
    "<html>",
    '<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; background: #f9fafb;">',
    '<div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">',
    '<h2 style="margin: 0 0 16px; color: #111827;">Team Invite</h2>',
    `<p style="color: #6b7280; line-height: 1.6;">`,
    `<strong>${params.inviterEmail}</strong> has invited you to join`,
    `<strong>${params.orgName}</strong> as a <strong>${params.role}</strong>.`,
    `</p>`,
    `<a href="${params.inviteUrl}" style="display: inline-block; margin: 24px 0; padding: 12px 24px; background: #111827; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">`,
    `Accept Invite</a>`,
    `<p style="color: #9ca3af; font-size: 14px;">`,
    `This invite expires on ${params.expiresAt.toLocaleDateString()}.`,
    `</p>`,
    "</div>",
    "</body>",
    "</html>",
  ];
  return parts.join("\n");
}
