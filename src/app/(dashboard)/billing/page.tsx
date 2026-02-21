"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

interface Subscription {
  id: string;
  plan: "starter" | "pro" | "enterprise";
  status: "active" | "past_due" | "canceled" | "trialing";
  current_period_end: string;
  cancel_at_period_end: boolean;
}

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  pdf_url: string | null;
}

interface UsageMetric {
  name: string;
  current: number;
  limit: number;
  unit: string;
}

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 0,
    features: ["Up to 3 team members", "1,000 API requests/mo", "Community support", "Basic analytics"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 29,
    popular: true,
    features: ["Up to 20 team members", "50,000 API requests/mo", "Priority support", "Advanced analytics", "Custom integrations", "Webhook events"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 99,
    features: ["Unlimited team members", "Unlimited API requests", "Dedicated support", "Custom analytics", "SSO / SAML", "SLA guarantee", "Audit logs"],
  },
];

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [usage, setUsage] = useState<UsageMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const supabase = createBrowserClient();

  useEffect(() => {
    fetchBillingData();
  }, []);

  async function fetchBillingData() {
    const [subRes, invRes, useRes] = await Promise.all([
      supabase.from("subscriptions").select("*").single(),
      supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(10),
      supabase.from("usage_metrics").select("*"),
    ]);
    if (subRes.data) setSubscription(subRes.data as Subscription);
    if (invRes.data) setInvoices(invRes.data as Invoice[]);
    if (useRes.data) setUsage(useRes.data as UsageMetric[]);
    setLoading(false);
  }

  async function handleUpgrade(planId: string) {
    setUpgrading(true);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planId }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setUpgrading(false);
  }

  async function openPortal() {
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const { url } = await res.json();
    if (url) window.location.href = url;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }
  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Billing & Plans</h1>

      {/* Current Plan */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Current Plan</h2>
            <p className="text-gray-500 mt-1">
              {subscription ? (
                <>
                  <span className="capitalize font-medium text-gray-900">{subscription.plan}</span>
                  {" "}&middot;{" "}
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    subscription.status === "active" ? "bg-green-100 text-green-700" :
                    subscription.status === "trialing" ? "bg-blue-100 text-blue-700" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>
                    {subscription.status}
                  </span>
                </>
              ) : "No active subscription"}
            </p>
            {subscription && (
              <p className="text-sm text-gray-400 mt-2">
                {subscription.cancel_at_period_end
                  ? `Cancels on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                  : `Renews on ${new Date(subscription.current_period_end).toLocaleDateString()}`}
              </p>
            )}
          </div>
          <button
            onClick={openPortal}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Manage Subscription
          </button>
        </div>
      </div>

      {/* Usage */}
      {usage.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Usage This Period</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {usage.map((metric) => (
              <div key={metric.name} className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">{metric.name}</p>
                <p className="text-2xl font-bold mt-1">
                  {metric.current.toLocaleString()}
                  <span className="text-sm font-normal text-gray-400"> / {metric.limit.toLocaleString()} {metric.unit}</span>
                </p>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${metric.current / metric.limit > 0.9 ? "bg-red-500" : metric.current / metric.limit > 0.7 ? "bg-yellow-500" : "bg-green-500"}`}
                    style={{ width: `${Math.min((metric.current / metric.limit) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plans */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white border rounded-xl p-6 relative ${
                plan.popular ? "border-black ring-1 ring-black" : "border-gray-200"
              } ${subscription?.plan === plan.id ? "bg-gray-50" : ""}`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-3 py-1 rounded-full">
                  Most Popular
                </span>
              )}
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="text-3xl font-bold mt-2">
                ${plan.price}<span className="text-sm font-normal text-gray-400">/mo</span>
              </p>
              <ul className="mt-4 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={upgrading || subscription?.plan === plan.id}
                className={`w-full mt-6 py-2 rounded-lg font-medium transition-colors ${
                  subscription?.plan === plan.id
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : plan.popular
                    ? "bg-black text-white hover:bg-gray-800"
                    : "border border-gray-300 hover:bg-gray-50"
                }`}
              >
                {subscription?.plan === plan.id ? "Current Plan" : "Upgrade"}
              </button>
            </div>
          ))}
        </div>
      </div>
      {/* Invoices */}
      {invoices.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Invoice History</h2>
          <div className="divide-y divide-gray-100">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-gray-900">
                    {new Date(invoice.created_at).toLocaleDateString("en-US", {
                      year: "numeric", month: "long", day: "numeric",
                    })}
                  </p>
                  <p className="text-sm text-gray-500 capitalize">{invoice.status}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-medium">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency", currency: invoice.currency,
                    }).format(invoice.amount / 100)}
                  </span>
                  {invoice.pdf_url && (
                    <a
                      href={invoice.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Download
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
