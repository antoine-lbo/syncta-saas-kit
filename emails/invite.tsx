import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface InviteEmailProps {
  inviterName: string;
  inviterEmail: string;
  orgName: string;
  role: "admin" | "member" | "viewer";
  inviteUrl: string;
  expiresIn?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.syncta.ai";

const roleDescriptions: Record<string, string> = {
  admin: "full access to manage settings, billing, and team members",
  member: "access to create and manage projects and data",
  viewer: "read-only access to dashboards and reports",
};

export const InviteEmail = ({
  inviterName = "Someone",
  inviterEmail = "inviter@example.com",
  orgName = "a team",
  role = "member",
  inviteUrl = `${baseUrl}/invite/accept`,
  expiresIn = "7 days",
}: InviteEmailProps) => {
  const previewText = `${inviterName} invited you to join ${orgName} on Syncta`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <Img
              src={`${baseUrl}/logo.png`}
              width="120"
              height="36"
              alt="Syncta"
            />
          </Section>

          {/* Main content */}
          <Section style={contentSection}>
            <Heading style={h1}>You've been invited</Heading>
            <Text style={paragraph}>
              <strong>{inviterName}</strong> ({inviterEmail}) has invited you to
              join <strong>{orgName}</strong> on Syncta as a{" "}
              <span style={roleBadge}>{role}</span>.
            </Text>
            <Text style={paragraph}>
              As a {role}, you'll have {roleDescriptions[role]}.
            </Text>
          </Section>

          {/* CTA */}
          <Section style={ctaSection}>
            <Button style={ctaButton} href={inviteUrl}>
              Accept Invitation
            </Button>
            <Text style={expiryText}>
              This invitation expires in {expiresIn}
            </Text>
          </Section>

          <Hr style={hr} />

          {/* Security note */}
          <Section style={securitySection}>
            <Text style={securityTitle}>Security Note</Text>
            <Text style={securityText}>
              If you weren't expecting this invitation, you can safely ignore
              this email. Only click the button above if you know and trust
              {" "}{inviterName} and want to join {orgName}.
            </Text>
          </Section>

          <Hr style={hr} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Syncta · Built by{" "}
              <Link href="https://syncta.ai" style={link}>syncta.ai</Link>
            </Text>
            <Text style={footerSubtext}>
              If the button doesn't work, copy and paste this URL into your browser:
              <br />
              <Link href={inviteUrl} style={link}>{inviteUrl}</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default InviteEmail;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const main: React.CSSProperties = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "0",
  maxWidth: "580px",
  borderRadius: "8px",
  overflow: "hidden",
  border: "1px solid #e5e7eb",
};

const logoSection: React.CSSProperties = {
  padding: "32px 40px 0",
};

const contentSection: React.CSSProperties = {
  padding: "24px 40px",
};

const h1: React.CSSProperties = {
  color: "#111827",
  fontSize: "28px",
  fontWeight: "700",
  lineHeight: "1.3",
  margin: "0 0 16px",
};

const paragraph: React.CSSProperties = {
  color: "#4b5563",
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0 0 12px",
};

const roleBadge: React.CSSProperties = {
  backgroundColor: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: "4px",
  color: "#1d4ed8",
  fontSize: "14px",
  fontWeight: "600",
  padding: "2px 8px",
};

const ctaSection: React.CSSProperties = {
  padding: "0 40px 32px",
  textAlign: "center" as const,
};

const ctaButton: React.CSSProperties = {
  backgroundColor: "#2563eb",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "16px",
  fontWeight: "600",
  padding: "12px 32px",
  textDecoration: "none",
  textAlign: "center" as const,
};

const expiryText: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "13px",
  margin: "12px 0 0",
};

const hr: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "0 40px",
};

const securitySection: React.CSSProperties = {
  padding: "24px 40px",
};

const securityTitle: React.CSSProperties = {
  color: "#111827",
  fontSize: "14px",
  fontWeight: "600",
  margin: "0 0 8px",
};

const securityText: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "0",
};

const footer: React.CSSProperties = {
  padding: "24px 40px 32px",
  textAlign: "center" as const,
};

const footerText: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "13px",
  margin: "0 0 8px",
};

const footerSubtext: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "0",
  wordBreak: "break-all",
};

const link: React.CSSProperties = {
  color: "#2563eb",
  textDecoration: "underline",
};
