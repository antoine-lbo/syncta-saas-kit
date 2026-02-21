/**
 * Landing Page
 *
 * Public marketing page with hero, features, pricing, and CTA sections.
 * Server-rendered for optimal SEO performance.
 *
 * @module app/page
 */

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Syncta — The SaaS Starter Kit for Next.js",
  description:
    "Launch your SaaS in days, not months. Production-ready Next.js 14 starter with auth, billing, multi-tenancy, and more.",
  openGraph: {
    title: "Syncta — Ship Your SaaS Faster",
    description: "Production-ready SaaS starter kit built with Next.js 14, Supabase, and Stripe.",
    type: "website",
  },
};

// ---------------------------------------------------------------------------
// Feature data
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    title: "Authentication",
    description: "Email, Google OAuth, and magic links via Supabase Auth. Fully configured with protected routes and session management.",
    icon: "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z",
  },
  {
    title: "Stripe Billing",
    description: "Subscriptions, usage-based metering, customer portal, and webhook handling. Supports free trials and plan upgrades.",
    icon: "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z",
  },
  {
    title: "Multi-Tenancy",
    description: "Organization-based access with role management. Invite team members, manage permissions, and switch between workspaces.",
    icon: "M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z",
  },
  {
    title: "Dashboard",
    description: "Pre-built admin dashboard with analytics charts, data tables, activity feeds, and notification preferences.",
    icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z",
  },
  {
    title: "Database & RLS",
    description: "Supabase PostgreSQL with Row Level Security policies, migrations, and Edge Functions for serverless logic.",
    icon: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125",
  },
  {
    title: "Email Templates",
    description: "Beautiful transactional emails via Resend with React Email templates for welcome, invite, and password reset flows.",
    icon: "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75",
  },
] as const;
const PRICING = [
  {
    name: "Starter",
    price: "$0",
    period: "forever",
    description: "For side projects and MVPs",
    features: ["Up to 3 team members", "1,000 API requests/mo", "Community support", "Basic analytics"],
    cta: "Get Started Free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$49",
    period: "/month",
    description: "For growing teams and products",
    features: ["Unlimited team members", "100,000 API requests/mo", "Priority support", "Advanced analytics", "Custom domains", "SSO"],
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large-scale deployments",
    features: ["Everything in Pro", "Unlimited API requests", "Dedicated support", "SLA guarantee", "On-premise option", "Custom integrations"],
    cta: "Contact Sales",
    highlighted: false,
  },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="text-xl font-bold text-gray-900">
            Syncta
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-gray-600 hover:text-gray-900">Features</a>
            <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900">Pricing</a>
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">Sign in</Link>
            <Link
              href="/signup"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>
      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm text-blue-700">
            Built with Next.js 14 + Supabase + Stripe
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-7xl">
            Ship your SaaS{" "}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              in days, not months
            </span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600 sm:text-xl">
            Production-ready starter kit with authentication, billing, multi-tenancy,
            and a beautiful dashboard. Skip weeks of boilerplate and focus on what
            makes your product unique.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Start Building Free
            </Link>
            <a
              href="https://github.com/antoine-lbo/syncta-saas-kit"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-gray-300 px-6 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-gray-50 px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to launch
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Pre-built features so you can focus on your product, not infrastructure.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Pricing */}
      <section id="pricing" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Start free, scale as you grow. No hidden fees.
            </p>
          </div>
          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {PRICING.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-8 ${
                  plan.highlighted
                    ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
                    : "border-gray-200 bg-white"
                }`}
              >
                {plan.highlighted && (
                  <p className="mb-4 text-sm font-semibold text-blue-600">Most popular</p>
                )}
                <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                <p className="mt-1 text-sm text-gray-500">{plan.description}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-sm text-gray-500">{plan.period}</span>
                </div>
                <Link
                  href="/signup"
                  className={`mt-6 block w-full rounded-lg py-2.5 text-center text-sm font-semibold ${
                    plan.highlighted
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {plan.cta}
                </Link>
                <ul className="mt-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-gray-600">
                      <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 px-6 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to ship faster?
          </h2>
          <p className="mt-4 text-lg text-blue-100">
            Join hundreds of developers who launched their SaaS with Syncta.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-block rounded-lg bg-white px-8 py-3 text-base font-semibold text-blue-600 shadow-sm hover:bg-blue-50"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50 px-6 py-12">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Syncta. Built by{" "}
            <a href="https://github.com/antoine-lbo" className="underline hover:text-gray-700">
              Antoine Batreau
            </a>
          </p>
          <div className="flex gap-6">
            <Link href="/terms" className="text-sm text-gray-500 hover:text-gray-700">Terms</Link>
            <Link href="/privacy" className="text-sm text-gray-500 hover:text-gray-700">Privacy</Link>
            <a href="https://github.com/antoine-lbo/syncta-saas-kit" className="text-sm text-gray-500 hover:text-gray-700">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
