# Syncta SaaS Kit 🚀

A production-ready SaaS starter kit built with **Next.js 14**, **Supabase**, **Stripe**, and **Tailwind CSS**. Skip weeks of boilerplate — launch your SaaS in days.

![Next.js](https://img.shields.io/badge/Next.js_14-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat&logo=supabase&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-635BFF?style=flat&logo=stripe&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white)

## Features

- **Authentication** — Email/password, Google OAuth, magic links via Supabase Auth
- **Multi-tenant** — Organization-based access control with role management (admin, member, viewer)
- **Billing** — Stripe subscriptions with usage-based metering, customer portal, and webhook handling
- **Dashboard** — Pre-built admin dashboard with analytics charts (Recharts)
- **Database** — Supabase PostgreSQL with Row Level Security policies and Edge Functions
- **Email** — Transactional emails via Resend with React Email templates
- **Deployment** — One-click deploy to Vercel with environment variable setup

## Quick Start

```bash
npx create-syncta-app my-saas
cd my-saas
cp .env.example .env.local
npm run dev
```

## Project Structure

```
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/             # Auth pages (login, signup, reset)
│   │   ├── (dashboard)/        # Protected dashboard routes
│   │   ├── api/                # API routes & webhooks
│   │   └── layout.tsx          # Root layout
│   ├── components/
│   │   ├── ui/                 # Reusable UI components (shadcn/ui)
│   │   ├── forms/              # Form components with validation
│   │   └── dashboard/          # Dashboard-specific components
│   ├── lib/
│   │   ├── supabase/           # Supabase client & helpers
│   │   ├── stripe/             # Stripe integration
│   │   └── utils/              # Utility functions
│   └── types/                  # TypeScript type definitions
├── supabase/
│   ├── migrations/             # Database migrations
│   └── functions/              # Edge Functions
└── emails/                     # React Email templates
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

```env
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

## License

MIT — built and maintained by [Antoine Batreau](https://github.com/antoine-lbo) at [Syncta.ai](https://syncta.ai)
