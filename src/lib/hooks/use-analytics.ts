"use client";

/**
 * useAnalytics — Unified analytics hook for Syncta SaaS Kit.
 *
 * Provides a single interface for tracking page views, custom events,
 * and user identification across multiple analytics providers.
 * Supports PostHog, Mixpanel, and custom backends.
 *
 * @example
 * ```tsx
 * const { track, identify, page } = useAnalytics();
 *
 * // Track a custom event
 * track("subscription_upgraded", { plan: "pro", interval: "monthly" });
 *
 * // Identify a user after login
 * identify(user.id, { email: user.email, plan: user.plan });
 * ```
 */

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// ── Types ────────────────────────────────────────────────────────

interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp?: Date;
}

interface UserTraits {
  email?: string;
  name?: string;
  plan?: string;
  company?: string;
  [key: string]: unknown;
}

interface AnalyticsProvider {
  name: string;
  track: (event: string, properties?: Record<string, unknown>) => void;
  identify: (userId: string, traits?: UserTraits) => void;
  page: (name?: string, properties?: Record<string, unknown>) => void;
  reset: () => void;
}

interface AnalyticsConfig {
  providers?: AnalyticsProvider[];
  debug?: boolean;
  enabled?: boolean;
  respectDNT?: boolean;
}

// ── Default Providers ─────────────────────────────────────────────

const createPostHogProvider = (): AnalyticsProvider | null => {
  if (typeof window === "undefined") return null;
  const posthog = (window as any).posthog;
  if (!posthog) return null;

  return {
    name: "posthog",
    track: (event, properties) => posthog.capture(event, properties),
    identify: (userId, traits) => posthog.identify(userId, traits),
    page: (name, properties) => posthog.capture("$pageview", { ...properties, page: name }),
    reset: () => posthog.reset(),
  };
};

const createConsoleProvider = (): AnalyticsProvider => ({
  name: "console",
  track: (event, properties) =>
    console.log("[Analytics] Track:", event, properties),
  identify: (userId, traits) =>
    console.log("[Analytics] Identify:", userId, traits),
  page: (name, properties) =>
    console.log("[Analytics] Page:", name, properties),
  reset: () => console.log("[Analytics] Reset"),
});

// ── Hook ─────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AnalyticsConfig = {
  debug: process.env.NODE_ENV === "development",
  enabled: process.env.NODE_ENV === "production",
  respectDNT: true,
};

export function useAnalytics(config: AnalyticsConfig = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousPathname = useRef<string>("");

  // Check Do Not Track
  const isDNT =
    typeof navigator !== "undefined" &&
    mergedConfig.respectDNT &&
    navigator.doNotTrack === "1";

  // Resolve providers
  const providers = useRef<AnalyticsProvider[]>([]);
  useEffect(() => {
    if (config.providers) {
      providers.current = config.providers;
      return;
    }

    const detected: AnalyticsProvider[] = [];
    const posthog = createPostHogProvider();
    if (posthog) detected.push(posthog);
    if (mergedConfig.debug) detected.push(createConsoleProvider());
    providers.current = detected;
  }, [config.providers, mergedConfig.debug]);

  // Auto-track page views on route change
  useEffect(() => {
    if (!mergedConfig.enabled || isDNT) return;
    if (pathname === previousPathname.current) return;

    previousPathname.current = pathname;
    const url = searchParams.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;

    providers.current.forEach((p) => {
      try {
        p.page(pathname, { url, referrer: document.referrer });
      } catch (e) {
        console.warn(`[Analytics] ${p.name} page tracking failed:`, e);
      }
    });
  }, [pathname, searchParams, mergedConfig.enabled, isDNT]);

  // Track a custom event
  const track = useCallback(
    (event: string, properties?: Record<string, unknown>) => {
      if (!mergedConfig.enabled || isDNT) return;

      const enrichedProps = {
        ...properties,
        timestamp: new Date().toISOString(),
        path: pathname,
      };

      providers.current.forEach((p) => {
        try {
          p.track(event, enrichedProps);
        } catch (e) {
          console.warn(`[Analytics] ${p.name} track failed:`, e);
        }
      });
    },
    [mergedConfig.enabled, isDNT, pathname]
  );

  // Identify a user
  const identify = useCallback(
    (userId: string, traits?: UserTraits) => {
      if (!mergedConfig.enabled || isDNT) return;

      providers.current.forEach((p) => {
        try {
          p.identify(userId, traits);
        } catch (e) {
          console.warn(`[Analytics] ${p.name} identify failed:`, e);
        }
      });
    },
    [mergedConfig.enabled, isDNT]
  );

  // Reset analytics state (e.g., on logout)
  const reset = useCallback(() => {
    providers.current.forEach((p) => {
      try {
        p.reset();
      } catch (e) {
        console.warn(`[Analytics] ${p.name} reset failed:`, e);
      }
    });
  }, []);

  return {
    track,
    identify,
    reset,
    isEnabled: mergedConfig.enabled && !isDNT,
  };
}


// ── Pre-built Event Helpers ───────────────────────────────────────

export const AnalyticsEvents = {
  // Auth events
  SIGNED_UP: "signed_up",
  SIGNED_IN: "signed_in",
  SIGNED_OUT: "signed_out",
  PASSWORD_RESET: "password_reset",

  // Subscription events
  SUBSCRIPTION_STARTED: "subscription_started",
  SUBSCRIPTION_UPGRADED: "subscription_upgraded",
  SUBSCRIPTION_DOWNGRADED: "subscription_downgraded",
  SUBSCRIPTION_CANCELED: "subscription_canceled",
  TRIAL_STARTED: "trial_started",
  TRIAL_EXPIRED: "trial_expired",

  // Feature usage
  FEATURE_USED: "feature_used",
  INVITE_SENT: "invite_sent",
  INVITE_ACCEPTED: "invite_accepted",
  SETTINGS_UPDATED: "settings_updated",

  // Engagement
  CTA_CLICKED: "cta_clicked",
  FEEDBACK_SUBMITTED: "feedback_submitted",
  ONBOARDING_COMPLETED: "onboarding_completed",
} as const;

export type AnalyticsEventName =
  (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];
