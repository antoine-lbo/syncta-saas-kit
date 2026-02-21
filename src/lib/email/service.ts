import { Resend } from "resend";
import { render } from "@react-email/render";
import { WelcomeEmail } from "../../../emails/welcome";
import { InviteEmail } from "../../../emails/invite";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = process.env.EMAIL_FROM || "Syncta <noreply@syncta.ai>";
const REPLY_TO = process.env.EMAIL_REPLY_TO || "support@syncta.ai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WelcomeEmailPayload {
  to: string;
  userName: string;
  orgName: string;
  dashboardUrl?: string;
}

export interface InviteEmailPayload {
  to: string;
  inviterName: string;
  inviterEmail: string;
  orgName: string;
  role: "admin" | "member" | "viewer";
  inviteUrl: string;
  expiresIn?: string;
}

export interface GenericEmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

async function sendEmail(payload: GenericEmailPayload): Promise<SendEmailResult> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: Array.isArray(payload.to) ? payload.to : [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      reply_to: payload.replyTo || REPLY_TO,
      tags: payload.tags,
    });

    if (error) {
      console.error("[Email] Send failed:", error);
      return { success: false, error: error.message };
    }

    console.log(`[Email] Sent successfully: ${data?.id}`);
    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Email] Unexpected error:", message);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Template-specific senders
// ---------------------------------------------------------------------------

/**
 * Send a welcome email to a new user after signup.
 */
export async function sendWelcomeEmail(
  payload: WelcomeEmailPayload
): Promise<SendEmailResult> {
  const html = render(
    WelcomeEmail({
      userName: payload.userName,
      orgName: payload.orgName,
      dashboardUrl: payload.dashboardUrl,
    })
  );

  return sendEmail({
    to: payload.to,
    subject: `Welcome to Syncta, ${payload.userName}!`,
    html,
    tags: [
      { name: "category", value: "welcome" },
      { name: "org", value: payload.orgName },
    ],
  });
}

/**
 * Send a team invitation email.
 */
export async function sendInviteEmail(
  payload: InviteEmailPayload
): Promise<SendEmailResult> {
  const html = render(
    InviteEmail({
      inviterName: payload.inviterName,
      inviterEmail: payload.inviterEmail,
      orgName: payload.orgName,
      role: payload.role,
      inviteUrl: payload.inviteUrl,
      expiresIn: payload.expiresIn,
    })
  );

  return sendEmail({
    to: payload.to,
    subject: `${payload.inviterName} invited you to join ${payload.orgName} on Syncta`,
    html,
    tags: [
      { name: "category", value: "invite" },
      { name: "org", value: payload.orgName },
      { name: "role", value: payload.role },
    ],
  });
}

/**
 * Send a password reset email.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  userName?: string
): Promise<SendEmailResult> {
  const name = userName || "there";
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 580px; margin: 0 auto;">
      <h2>Reset your password</h2>
      <p>Hi ${name},</p>
      <p>We received a request to reset your Syncta password. Click the button below to choose a new one:</p>
      <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">Reset Password</a>
      <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;

  return sendEmail({
    to,
    subject: "Reset your Syncta password",
    html,
    tags: [{ name: "category", value: "password-reset" }],
  });
}

/**
 * Send a generic notification email (e.g., billing alerts, usage limits).
 */
export async function sendNotificationEmail(
  to: string,
  subject: string,
  body: string,
  category: string = "notification"
): Promise<SendEmailResult> {
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 580px; margin: 0 auto;">
      ${body}
      <hr style="border-color: #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">
        Syncta &middot; <a href="https://syncta.ai" style="color: #2563eb;">syncta.ai</a>
      </p>
    </div>
  `;

  return sendEmail({
    to,
    subject,
    html,
    tags: [{ name: "category", value: category }],
  });
}
