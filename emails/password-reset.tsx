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

interface PasswordResetEmailProps {
  userName?: string;
  resetLink?: string;
  expiresInMinutes?: number;
  ipAddress?: string;
  userAgent?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.syncta.ai";

export const PasswordResetEmail = ({
  userName = "there",
  resetLink = `${baseUrl}/auth/reset-password?token=example`,
  expiresInMinutes = 60,
  ipAddress = "Unknown",
  userAgent = "Unknown",
}: PasswordResetEmailProps) => {
  const previewText = `Reset your password for Syncta`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Img
              src={`${baseUrl}/logo.png`}
              width="120"
              height="36"
              alt="Syncta"
              style={logo}
            />
          </Section>

          {/* Content */}
          <Section style={content}>
            <Heading style={h1}>Reset your password</Heading>

            <Text style={paragraph}>
              Hi {userName},
            </Text>

            <Text style={paragraph}>
              We received a request to reset your password. Click the button below
              to choose a new password. This link will expire in{" "}
              <strong>{expiresInMinutes} minutes</strong>.
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={resetLink}>
                Reset Password
              </Button>
            </Section>

            <Text style={paragraph}>
              If you didn't request this password reset, you can safely ignore
              this email. Your password will remain unchanged.
            </Text>

            <Hr style={hr} />

            {/* Security Info */}
            <Text style={securityHeading}>Security Details</Text>
            <Text style={securityText}>
              This request was made from IP address <code>{ipAddress}</code>
              {userAgent !== "Unknown" && (
                <> using <code>{userAgent}</code></>
              )}
              . If this wasn't you, please{" "}
              <Link href={`${baseUrl}/support`} style={link}>
                contact our support team
              </Link>
              {" "}immediately.
            </Text>

            <Hr style={hr} />

            {/* Fallback link */}
            <Text style={fallbackText}>
              If the button above doesn't work, copy and paste this URL into
              your browser:
            </Text>
            <Text style={linkText}>{resetLink}</Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              This email was sent by{" "}
              <Link href={baseUrl} style={link}>
                Syncta
              </Link>
              . You're receiving this because a password reset was requested
              for your account.
            </Text>
            <Text style={footerLinks}>
              <Link href={`${baseUrl}/privacy`} style={link}>
                Privacy Policy
              </Link>
              {" · "}
              <Link href={`${baseUrl}/terms`} style={link}>
                Terms of Service
              </Link>
              {" · "}
              <Link href={`${baseUrl}/support`} style={link}>
                Support
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default PasswordResetEmail;
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  maxWidth: "600px",
  borderRadius: "8px",
  overflow: "hidden" as const,
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
};

const header = {
  backgroundColor: "#0f172a",
  padding: "32px 40px",
  textAlign: "center" as const,
};

const logo = {
  margin: "0 auto",
};

const content = {
  padding: "40px",
};

const h1 = {
  color: "#0f172a",
  fontSize: "24px",
  fontWeight: "700",
  lineHeight: "32px",
  margin: "0 0 16px",
};

const paragraph = {
  color: "#475569",
  fontSize: "16px",
  lineHeight: "26px",
  margin: "0 0 24px",
};
const buttonContainer = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#6366f1",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "16px",
  fontWeight: "600",
  lineHeight: "1",
  padding: "16px 32px",
  textDecoration: "none",
  textAlign: "center" as const,
};

const hr = {
  borderColor: "#e2e8f0",
  margin: "24px 0",
};

const securityHeading = {
  color: "#0f172a",
  fontSize: "14px",
  fontWeight: "600",
  margin: "0 0 8px",
};

const securityText = {
  color: "#64748b",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0 0 4px",
};

const link = {
  color: "#6366f1",
  textDecoration: "underline",
};

const fallbackText = {
  color: "#94a3b8",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "24px 0 0",
};

const linkText = {
  color: "#6366f1",
  fontSize: "13px",
  wordBreak: "break-all" as const,
};
const footer = {
  backgroundColor: "#f8fafc",
  padding: "24px 40px",
  borderTop: "1px solid #e2e8f0",
};

const footerText = {
  color: "#94a3b8",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0 0 8px",
  textAlign: "center" as const,
};

const footerLinks = {
  textAlign: "center" as const,
  margin: "0",
};
