# Syncta SaaS Kit

[![CI](https://github.com/antoine-lbo/syncta-saas-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/antoine-lbo/syncta-saas-kit/actions/workflows/ci.yml)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E.svg)](https://supabase.com)
[![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF.svg)](https://stripe.com)

A production-ready SaaS starter kit built with Next.js 14, Supabase, Stripe, and Tailwind CSS. Skip weeks of boilerplate -- launch your SaaS in days.

## Features

- **Authentication** -- Email/password, Google OAuth, magic links via Supabase Auth
- **Multi-tenant** -- Organization-based access control with role management (admin, member, viewer)
- **Billing** -- Stripe subscriptions with usage-based metering, customer portal, and webhook handling
- **Dashboard** -- Pre-built admin dashboard with analytics charts (Recharts)
- **Database** -- Supabase PostgreSQL with Row Level Security policies and Edge Functions
- **Email** -- Transactional emails via Resend with React Email templates
- **Deployment** -- One-click deploy to Vercel with environment variable setup

## Quick Start

```bash
npx create-syncta-app my-saas
cd my-saas
cp .env.example .env.local
npm run dev
```

## Project Structure

```
src/
  app/
    (auth)/          # Auth pages (login, signup, reset)
    (dashboard)/     # Protected dashboard routes
    api/             # API routes & webhooks
    layout.tsx       # Root layout
  components/
    ui/              # Reusable UI components (shadcn/ui)
    forms/           # Form components with validation
    dashboard/       # Dashboard-specific components
  lib/
    supabase/        # Supabase client & helpers
    stripe/          # Stripe integration
    utils/           # Utility functions
  types/             # TypeScript type definitions
supabase/
  migrations/        # Database migrations
  functions/         # Edge Functions
emails/              # React Email templates
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Payments | Stripe |
| Styling | Tailwind CSS + shadcn/ui |
| Email | Resend + React Email |
| Hosting | Vercel |

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Resend
RESEND_API_KEY=re_...
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

For vulnerability reports, please see [SECURITY.md](SECURITY.md).

## License

MIT -- built and maintained by [Antoine Batreau](https://github.com/antoine-lbo) at [Syncta.ai](https://syncta.ai)
