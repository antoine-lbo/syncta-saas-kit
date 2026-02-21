-- ==========================================================================
-- Initial Schema — Syncta SaaS Kit
-- ==========================================================================
-- Multi-tenant SaaS schema with Row Level Security (RLS).
-- Supports organisations, members, projects, subscriptions, API keys,
-- usage metering, webhooks, and activity logging.
--
-- Run: supabase db push
-- ==========================================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------------
-- Enums
-- --------------------------------------------------------------------------

create type org_role as enum ('owner', 'admin', 'member', 'viewer');
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'unpaid');
create type plan_tier as enum ('free', 'starter', 'pro', 'enterprise');

-- --------------------------------------------------------------------------
-- Users (extends Supabase auth.users)
-- --------------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  full_name     text,
  avatar_url    text,
  email         text not null,
  timezone      text default 'UTC',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- --------------------------------------------------------------------------
-- Organisations
-- --------------------------------------------------------------------------

create table public.organizations (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  slug                text unique not null,
  logo_url            text,
  plan                plan_tier default 'free',
  subscription_status subscription_status default 'trialing',
  stripe_customer_id  text unique,
  billing_email       text,
  billing_name        text,
  past_due_since      timestamptz,
  metadata            jsonb default '{}',
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table public.organizations enable row level security;

-- --------------------------------------------------------------------------
-- Organisation Members (join table)
-- --------------------------------------------------------------------------

create table public.org_members (
  id       uuid primary key default uuid_generate_v4(),
  org_id   uuid not null references public.organizations on delete cascade,
  user_id  uuid not null references public.profiles on delete cascade,
  role     org_role not null default 'member',
  joined_at timestamptz default now(),
  unique (org_id, user_id)
);

alter table public.org_members enable row level security;

create policy "Members can view their org members"
  on public.org_members for select
  using (
    exists (
      select 1 from public.org_members om
      where om.org_id = org_members.org_id
      and om.user_id = auth.uid()
    )
  );

create policy "Org view for members"
  on public.organizations for select
  using (
    exists (
      select 1 from public.org_members
      where org_id = organizations.id
      and user_id = auth.uid()
    )
  );
-- --------------------------------------------------------------------------
-- Projects
-- --------------------------------------------------------------------------

create table public.projects (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references public.organizations on delete cascade,
  name        text not null,
  description text,
  status      text default 'active',
  metadata    jsonb default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.projects enable row level security;

create policy "Project access for org members"
  on public.projects for all
  using (
    exists (
      select 1 from public.org_members
      where org_id = projects.org_id
      and user_id = auth.uid()
    )
  );

-- --------------------------------------------------------------------------
-- Subscriptions
-- --------------------------------------------------------------------------

create table public.subscriptions (
  id                      uuid primary key default uuid_generate_v4(),
  org_id                  uuid not null references public.organizations on delete cascade,
  stripe_subscription_id  text unique not null,
  stripe_customer_id      text not null,
  plan                    plan_tier not null,
  status                  subscription_status not null,
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean default false,
  canceled_at             timestamptz,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

alter table public.subscriptions enable row level security;

-- --------------------------------------------------------------------------
-- API Keys
-- --------------------------------------------------------------------------

create table public.api_keys (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references public.organizations on delete cascade,
  name        text not null,
  key_hash    text unique not null,
  prefix      text not null,             -- e.g. "sk_live_abc..." (first 8 chars)
  scopes      text[] default '{"read","write"}',
  last_used_at timestamptz,
  expires_at  timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz default now()
);

alter table public.api_keys enable row level security;

create policy "Admins can manage API keys"
  on public.api_keys for all
  using (
    exists (
      select 1 from public.org_members
      where org_id = api_keys.org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
    )
  );

-- --------------------------------------------------------------------------
-- Usage Metering
-- --------------------------------------------------------------------------

create table public.usage_daily (
  id            uuid primary key default uuid_generate_v4(),
  org_id        uuid not null references public.organizations on delete cascade,
  date          date not null,
  api_calls     integer default 0,
  tokens_used   bigint default 0,
  active_users  integer default 0,
  created_at    timestamptz default now(),
  unique (org_id, date)
);

alter table public.usage_daily enable row level security;

-- --------------------------------------------------------------------------
-- Invoices
-- --------------------------------------------------------------------------

create table public.invoices (
  id                  uuid primary key default uuid_generate_v4(),
  org_id              uuid not null references public.organizations on delete cascade,
  stripe_invoice_id   text unique,
  amount_paid         integer not null,
  currency            text default 'usd',
  status              text default 'pending',
  period_start        timestamptz,
  period_end          timestamptz,
  hosted_invoice_url  text,
  pdf_url             text,
  created_at          timestamptz default now()
);

alter table public.invoices enable row level security;

-- --------------------------------------------------------------------------
-- Webhook Events (idempotency)
-- --------------------------------------------------------------------------

create table public.webhook_events (
  id              uuid primary key default uuid_generate_v4(),
  stripe_event_id text unique not null,
  event_type      text not null,
  processed_at    timestamptz not null,
  success         boolean not null,
  metadata        jsonb default '{}'
);

-- --------------------------------------------------------------------------
-- Activity Log
-- --------------------------------------------------------------------------

create table public.activity_log (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references public.organizations on delete cascade,
  user_id     uuid references public.profiles,
  action      text not null,
  metadata    jsonb default '{}',
  created_at  timestamptz default now()
);

alter table public.activity_log enable row level security;

create index idx_activity_log_org on public.activity_log (org_id, created_at desc);
create index idx_usage_daily_org on public.usage_daily (org_id, date desc);
create index idx_api_keys_hash on public.api_keys (key_hash);
create index idx_subscriptions_org on public.subscriptions (org_id);
create index idx_webhook_events_stripe on public.webhook_events (stripe_event_id);

-- --------------------------------------------------------------------------
-- Triggers: auto-update updated_at
-- --------------------------------------------------------------------------

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.profiles for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.organizations for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.projects for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.subscriptions for each row execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- Auto-create profile on sign-up
-- --------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
