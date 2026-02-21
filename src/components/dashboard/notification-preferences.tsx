"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationChannel {
  id: string;
  label: string;
  description: string;
  email: boolean;
  push: boolean;
  slack: boolean;
}

const DEFAULT_CHANNELS: NotificationChannel[] = [
  {
    id: "billing",
    label: "Billing & Invoices",
    description: "Payment confirmations, failed charges, and invoice receipts",
    email: true,
    push: false,
    slack: false,
  },
  {
    id: "security",
    label: "Security Alerts",
    description: "Login attempts, password changes, and suspicious activity",
    email: true,
    push: true,
    slack: true,
  },
  {
    id: "team",
    label: "Team Activity",
    description: "New members, role changes, and team invitations",
    email: true,
    push: true,
    slack: true,
  },
  {
    id: "product",
    label: "Product Updates",
    description: "New features, improvements, and changelog",
    email: true,
    push: false,
    slack: false,
  },
  {
    id: "usage",
    label: "Usage Alerts",
    description: "Approaching limits, quota warnings, and overages",
    email: true,
    push: true,
    slack: true,
  },
  {
    id: "reports",
    label: "Weekly Reports",
    description: "Weekly summary of activity, analytics, and key metrics",
    email: true,
    push: false,
    slack: false,
  },
];

// ---------------------------------------------------------------------------
// Toggle Component
// ---------------------------------------------------------------------------

function Toggle({
  enabled,
  onChange,
  label,
}: {
  enabled: boolean;
  onChange: (val: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={() => onChange(!enabled)}
      style={{
        position: "relative",
        display: "inline-flex",
        height: "24px",
        width: "44px",
        flexShrink: 0,
        cursor: "pointer",
        borderRadius: "9999px",
        border: "2px solid transparent",
        backgroundColor: enabled ? "#2563eb" : "#d1d5db",
        transition: "background-color 200ms",
      }}
    >
      <span
        style={{
          display: "inline-block",
          height: "20px",
          width: "20px",
          borderRadius: "9999px",
          backgroundColor: "#ffffff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          transform: enabled ? "translateX(20px)" : "translateX(0px)",
          transition: "transform 200ms",
        }}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function NotificationPreferences() {
  const [channels, setChannels] = useState<NotificationChannel[]>(DEFAULT_CHANNELS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const updateChannel = (
    id: string,
    field: "email" | "push" | "slack",
    value: boolean
  ) => {
    setChannels((prev) =>
      prev.map((ch) => (ch.id === id ? { ...ch, [field]: value } : ch))
    );
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels }),
      });
      if (!response.ok) throw new Error("Failed to save");
      setSaved(true);
    } catch (err) {
      console.error("Failed to save notification preferences:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: "720px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#111827", margin: 0 }}>
          Notification Preferences
        </h2>
        <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
          Choose how you want to be notified for each type of activity.
        </p>
      </div>

      {/* Header row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 80px 80px 80px",
          gap: "16px",
          padding: "12px 0",
          borderBottom: "1px solid #e5e7eb",
          marginBottom: "8px",
        }}
      >
        <div style={{ fontSize: "13px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
          Notification Type
        </div>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "#6b7280", textAlign: "center" as const, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
          Email
        </div>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "#6b7280", textAlign: "center" as const, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
          Push
        </div>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "#6b7280", textAlign: "center" as const, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
          Slack
        </div>
      </div>

      {/* Channel rows */}
      {channels.map((channel) => (
        <div
          key={channel.id}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 80px 80px 80px",
            gap: "16px",
            alignItems: "center",
            padding: "16px 0",
            borderBottom: "1px solid #f3f4f6",
          }}
        >
          <div>
            <div style={{ fontSize: "15px", fontWeight: 500, color: "#111827" }}>
              {channel.label}
            </div>
            <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "2px" }}>
              {channel.description}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Toggle
              enabled={channel.email}
              onChange={(val) => updateChannel(channel.id, "email", val)}
              label={`${channel.label} email notifications`}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Toggle
              enabled={channel.push}
              onChange={(val) => updateChannel(channel.id, "push", val)}
              label={`${channel.label} push notifications`}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Toggle
              enabled={channel.slack}
              onChange={(val) => updateChannel(channel.id, "slack", val)}
              label={`${channel.label} Slack notifications`}
            />
          </div>
        </div>
      ))}

      {/* Save button */}
      <div style={{ marginTop: "24px", display: "flex", alignItems: "center", gap: "12px" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            backgroundColor: saving ? "#93c5fd" : "#2563eb",
            color: "#ffffff",
            padding: "10px 24px",
            borderRadius: "6px",
            border: "none",
            fontSize: "14px",
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save Preferences"}
        </button>
        {saved && (
          <span style={{ fontSize: "14px", color: "#059669", fontWeight: 500 }}>
            Preferences saved
          </span>
        )}
      </div>
    </div>
  );
}

export default NotificationPreferences;
