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

interface WelcomeEmailProps {
  userName: string;
  orgName: string;
  dashboardUrl: string;
  docsUrl?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.syncta.ai";

export const WelcomeEmail = ({
  userName = "there",
  orgName = "your organization",
  dashboardUrl = `${baseUrl}/dashboard`,
  docsUrl = "https://docs.syncta.ai",
}: WelcomeEmailProps) => {
  const previewText = `Welcome to Syncta — let's get ${orgName} set up`;

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
              style={logo}
            />
          </Section>

          {/* Hero */}
          <Section style={heroSection}>
            <Heading style={h1}>Welcome to Syncta</Heading>
            <Text style={heroText}>
              Hi {userName}, your account for <strong>{orgName}</strong> is ready.
              Let's get you set up in under 5 minutes.
            </Text>
          </Section>

          {/* CTA */}
          <Section style={ctaSection}>
            <Button style={ctaButton} href={dashboardUrl}>
              Go to your Dashboard
            </Button>
          </Section>

          <Hr style={hr} />

          {/* Steps */}
          <Section style={stepsSection}>
            <Heading as="h2" style={h2}>
              Getting Started
            </Heading>

            <div style={stepRow}>
              <div style={stepNumber}>1</div>
              <div style={stepContent}>
                <Text style={stepTitle}>Connect your data source</Text>
                <Text style={stepDescription}>
                  Link your database, API, or upload a CSV to start syncing.
                </Text>
              </div>
            </div>

            <div style={stepRow}>
              <div style={stepNumber}>2</div>
              <div style={stepContent}>
                <Text style={stepTitle}>Invite your team</Text>
                <Text style={stepDescription}>
                  Add team members and set roles — admin, member, or viewer.
                </Text>
              </div>
            </div>

            <div style={stepRow}>
              <div style={stepNumber}>3</div>
              <div style={stepContent}>
                <Text style={stepTitle}>Configure automations</Text>
                <Text style={stepDescription}>
                  Set up workflows, alerts, and scheduled reports.
                </Text>
              </div>
            </div>
          </Section>

          <Hr style={hr} />

          {/* Resources */}
          <Section style={resourcesSection}>
            <Text style={resourcesTitle}>Helpful Resources</Text>
            <Text style={resourceLink}>
              📖 <Link href={docsUrl} style={link}>Documentation</Link> —
              Guides, API reference, and tutorials
            </Text>
            <Text style={resourceLink}>
              💬 <Link href="https://community.syncta.ai" style={link}>Community</Link> —
              Ask questions and share workflows
            </Text>
            <Text style={resourceLink}>
              🎓 <Link href={`${docsUrl}/quickstart`} style={link}>Quickstart Guide</Link> —
              Up and running in 5 minutes
            </Text>
          </Section>

          <Hr style={hr} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Syncta · Built by{" "}
              <Link href="https://syncta.ai" style={link}>
                syncta.ai
              </Link>
            </Text>
            <Text style={footerSubtext}>
              You're receiving this because you signed up for Syncta.
              <br />
              <Link href={`${baseUrl}/settings/notifications`} style={link}>
                Manage email preferences
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default WelcomeEmail;

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

const logo: React.CSSProperties = {
  display: "block",
};

const heroSection: React.CSSProperties = {
  padding: "24px 40px",
};

const h1: React.CSSProperties = {
  color: "#111827",
  fontSize: "28px",
  fontWeight: "700",
  lineHeight: "1.3",
  margin: "0 0 16px",
};

const h2: React.CSSProperties = {
  color: "#111827",
  fontSize: "20px",
  fontWeight: "600",
  margin: "0 0 20px",
};

const heroText: React.CSSProperties = {
  color: "#4b5563",
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0",
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

const hr: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "0 40px",
};

const stepsSection: React.CSSProperties = {
  padding: "32px 40px",
};

const stepRow: React.CSSProperties = {
  display: "flex",
  marginBottom: "20px",
};

const stepNumber: React.CSSProperties = {
  backgroundColor: "#2563eb",
  borderRadius: "50%",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "700",
  height: "28px",
  lineHeight: "28px",
  textAlign: "center" as const,
  width: "28px",
  minWidth: "28px",
  marginRight: "16px",
  marginTop: "2px",
};

const stepContent: React.CSSProperties = {
  flex: "1",
};

const stepTitle: React.CSSProperties = {
  color: "#111827",
  fontSize: "15px",
  fontWeight: "600",
  margin: "0 0 4px",
};

const stepDescription: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "0",
};

const resourcesSection: React.CSSProperties = {
  padding: "32px 40px",
};

const resourcesTitle: React.CSSProperties = {
  color: "#111827",
  fontSize: "16px",
  fontWeight: "600",
  margin: "0 0 12px",
};

const resourceLink: React.CSSProperties = {
  color: "#4b5563",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 8px",
};

const link: React.CSSProperties = {
  color: "#2563eb",
  textDecoration: "underline",
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
};
