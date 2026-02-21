'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/database';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise';
export type BillingInterval = 'month' | 'year';
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete';

export interface PlanLimits {
  maxMembers: number;
  maxProjects: number;
  maxApiCalls: number;
  maxStorage: number; // in GB
  features: string[];
}

export interface Subscription {
  id: string;
  orgId: string;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  plan: PlanTier;
  status: SubscriptionStatus;
  interval: BillingInterval;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd: Date | null;
}

export interface UsageData {
  members: number;
  projects: number;
  apiCalls: number;
  storage: number;
}

export interface SubscriptionState {
  subscription: Subscription | null;
  usage: UsageData | null;
  limits: PlanLimits;
  isLoading: boolean;
  error: Error | null;
  // Computed
  isActive: boolean;
  isTrialing: boolean;
  isPastDue: boolean;
  daysUntilRenewal: number | null;
  daysUntilTrialEnd: number | null;
  canUpgrade: boolean;
  usagePercentages: Record<string, number>;
  // Actions
  refreshSubscription: () => Promise<void>;
  redirectToCheckout: (plan: PlanTier, interval?: BillingInterval) => Promise<void>;
  redirectToPortal: () => Promise<void>;
  checkFeature: (feature: string) => boolean;
  checkLimit: (resource: keyof UsageData) => { allowed: boolean; current: number; limit: number; percentage: number };
}

// ─── Plan Configuration ────────────────────────────────────────────────────────

const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    maxMembers: 2,
    maxProjects: 3,
    maxApiCalls: 1_000,
    maxStorage: 1,
    features: ['basic_analytics', 'email_support'],
  },
  starter: {
    maxMembers: 5,
    maxProjects: 10,
    maxApiCalls: 10_000,
    maxStorage: 10,
    features: ['basic_analytics', 'advanced_analytics', 'email_support', 'api_access', 'webhooks'],
  },
  pro: {
    maxMembers: 25,
    maxProjects: 50,
    maxApiCalls: 100_000,
    maxStorage: 100,
    features: ['basic_analytics', 'advanced_analytics', 'custom_reports', 'email_support', 'priority_support', 'api_access', 'webhooks', 'sso', 'audit_log'],
  },
  enterprise: {
    maxMembers: Infinity,
    maxProjects: Infinity,
    maxApiCalls: Infinity,
    maxStorage: Infinity,
    features: ['basic_analytics', 'advanced_analytics', 'custom_reports', 'email_support', 'priority_support', 'dedicated_support', 'api_access', 'webhooks', 'sso', 'audit_log', 'custom_integrations', 'sla'],
  },
};

// ─── Helper Functions ──────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function parseSubscription(row: any): Subscription {
  return {
    id: row.id,
    orgId: row.org_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripeCustomerId: row.stripe_customer_id,
    plan: row.plan as PlanTier,
    status: row.status as SubscriptionStatus,
    interval: row.interval as BillingInterval,
    currentPeriodStart: new Date(row.current_period_start),
    currentPeriodEnd: new Date(row.current_period_end),
    cancelAtPeriodEnd: row.cancel_at_period_end,
    trialEnd: row.trial_end ? new Date(row.trial_end) : null,
  };
    }
// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSubscription(orgId: string | undefined): SubscriptionState {
  const supabase = createClientComponentClient<Database>();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const limits = useMemo(() => PLAN_LIMITS[subscription?.plan ?? 'free'], [subscription?.plan]);

  // Fetch subscription data
  const fetchSubscription = useCallback(async () => {
    if (!orgId) return;
    try {
      const { data, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('org_id', orgId)
        .single();

      if (fetchError) throw new Error(fetchError.message);
      setSubscription(data ? parseSubscription(data) : null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch subscription'));
    }
  }, [orgId, supabase]);

  // Fetch usage data
  const fetchUsage = useCallback(async () => {
    if (!orgId) return;
    try {
      const [membersRes, projectsRes, apiRes, storageRes] = await Promise.all([
        supabase.from('org_members').select('id', { count: 'exact' }).eq('org_id', orgId),
        supabase.from('projects').select('id', { count: 'exact' }).eq('org_id', orgId),
        supabase.from('api_usage').select('count').eq('org_id', orgId).gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()).single(),
        supabase.from('storage_usage').select('bytes_used').eq('org_id', orgId).single(),
      ]);

      setUsage({
        members: membersRes.count ?? 0,
        projects: projectsRes.count ?? 0,
        apiCalls: apiRes.data?.count ?? 0,
        storage: (storageRes.data?.bytes_used ?? 0) / (1024 * 1024 * 1024), // Convert to GB
      });
    } catch (err) {
      console.error('Failed to fetch usage:', err);
    }
  }, [orgId, supabase]);

  // Load data on mount and org change
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      await Promise.all([fetchSubscription(), fetchUsage()]);
      setIsLoading(false);
    }
    load();
  }, [fetchSubscription, fetchUsage]);

  // Real-time subscription updates
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`subscription:${orgId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'subscriptions',
        filter: `org_id=eq.${orgId}`,
      }, (payload) => {
        if (payload.new) setSubscription(parseSubscription(payload.new));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId, supabase]);

  // Computed values
  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';
  const isTrialing = subscription?.status === 'trialing';
  const isPastDue = subscription?.status === 'past_due';

  const daysUntilRenewal = useMemo(() => {
    if (!subscription?.currentPeriodEnd) return null;
    return daysBetween(new Date(), subscription.currentPeriodEnd);
  }, [subscription?.currentPeriodEnd]);

  const daysUntilTrialEnd = useMemo(() => {
    if (!subscription?.trialEnd) return null;
    return daysBetween(new Date(), subscription.trialEnd);
  }, [subscription?.trialEnd]);

  const canUpgrade = subscription?.plan !== 'enterprise';
  const usagePercentages = useMemo(() => {
    if (!usage) return {};
    return {
      members: limits.maxMembers === Infinity ? 0 : (usage.members / limits.maxMembers) * 100,
      projects: limits.maxProjects === Infinity ? 0 : (usage.projects / limits.maxProjects) * 100,
      apiCalls: limits.maxApiCalls === Infinity ? 0 : (usage.apiCalls / limits.maxApiCalls) * 100,
      storage: limits.maxStorage === Infinity ? 0 : (usage.storage / limits.maxStorage) * 100,
    };
  }, [usage, limits]);

  // Actions
  const redirectToCheckout = useCallback(async (plan: PlanTier, interval: BillingInterval = 'month') => {
    const response = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, plan, interval }),
    });

    const { url, error: checkoutError } = await response.json();
    if (checkoutError) throw new Error(checkoutError);
    if (url) window.location.href = url;
  }, [orgId]);

  const redirectToPortal = useCallback(async () => {
    const response = await fetch('/api/stripe/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId }),
    });

    const { url, error: portalError } = await response.json();
    if (portalError) throw new Error(portalError);
    if (url) window.location.href = url;
  }, [orgId]);

  const checkFeature = useCallback((feature: string): boolean => {
    return limits.features.includes(feature);
  }, [limits]);

  const checkLimit = useCallback((resource: keyof UsageData) => {
    const current = usage?.[resource] ?? 0;
    const limitMap: Record<keyof UsageData, number> = {
      members: limits.maxMembers,
      projects: limits.maxProjects,
      apiCalls: limits.maxApiCalls,
      storage: limits.maxStorage,
    };
    const limit = limitMap[resource];
    return {
      allowed: current < limit,
      current,
      limit,
      percentage: limit === Infinity ? 0 : (current / limit) * 100,
    };
  }, [usage, limits]);

  const refreshSubscription = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchSubscription(), fetchUsage()]);
    setIsLoading(false);
  }, [fetchSubscription, fetchUsage]);

  return {
    subscription,
    usage,
    limits,
    isLoading,
    error,
    isActive,
    isTrialing,
    isPastDue,
    daysUntilRenewal,
    daysUntilTrialEnd,
    canUpgrade,
    usagePercentages,
    refreshSubscription,
    redirectToCheckout,
    redirectToPortal,
    checkFeature,
    checkLimit,
  };
}
