/**
 * Database Seeder for Syncta SaaS Kit
 *
 * Seeds the Supabase database with realistic demo data for development
 * and testing. Supports multiple environments and idempotent execution.
 *
 * Usage:
 *   npx tsx scripts/seed.ts                  # Default seed
 *   npx tsx scripts/seed.ts --env staging     # Staging data
 *   npx tsx scripts/seed.ts --clean           # Wipe and re-seed
 *   npx tsx scripts/seed.ts --only users,orgs # Seed specific tables
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { faker } from "@faker-js/faker";

// ─── Configuration ───────────────────────────────────────────────

interface SeedConfig {
  env: "development" | "staging" | "test";
  clean: boolean;
  only: string[] | null;
  userCount: number;
  orgCount: number;
  projectsPerOrg: number;
  eventsPerUser: number;
}

const DEFAULT_CONFIG: SeedConfig = {
  env: "development",
  clean: false,
  only: null,
  userCount: 25,
  orgCount: 5,
  projectsPerOrg: 4,
  eventsPerUser: 10,
};

const ENV_MULTIPLIERS: Record<string, number> = {
  development: 1,
  staging: 3,
  test: 0.5,
};

// ─── Types ──────────────────────────────────────────────────────

interface SeededUser {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: "admin" | "member" | "viewer";
}

interface SeededOrg {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan: "free" | "starter" | "pro" | "enterprise";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

interface SeededProject {
  id: string;
  org_id: string;
  name: string;
  description: string;
  status: "active" | "paused" | "archived";
  api_key: string;
  created_by: string;
}

// ─── Seed Data Generators ────────────────────────────────────────

const PLANS = ["free", "starter", "pro", "enterprise"] as const;
const PLAN_WEIGHTS = [0.4, 0.3, 0.2, 0.1];

function weightedRandom<T>(items: readonly T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }
  return items[items.length - 1];
}

function generateApiKey(): string {
  const prefix = "sk_live";
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let key = "";
  for (let i = 0; i < 32; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}_${key}`;
}
function generateStripeId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

const INDUSTRIES = [
  "Technology", "Healthcare", "Finance", "Education", "E-commerce",
  "Real Estate", "Manufacturing", "Media", "Consulting", "Legal",
];

const PROJECT_NAMES = [
  "Customer Portal", "Analytics Dashboard", "API Gateway",
  "Email Campaigns", "User Onboarding", "Billing Module",
  "Support Ticket System", "Inventory Tracker", "CRM Integration",
  "Reporting Engine", "Notification Service", "Data Pipeline",
];

const ACTIVITY_TYPES = [
  "user.login", "user.signup", "project.created", "project.updated",
  "api_key.generated", "api_key.revoked", "billing.invoice_paid",
  "billing.subscription_changed", "member.invited", "member.removed",
  "webhook.created", "integration.connected",
] as const;

// ─── Seeder Class ───────────────────────────────────────────────

class DatabaseSeeder {
  private supabase: SupabaseClient;
  private config: SeedConfig;
  private users: SeededUser[] = [];
  private orgs: SeededOrg[] = [];
  private projects: SeededProject[] = [];

  constructor(supabase: SupabaseClient, config: SeedConfig) {
    this.supabase = supabase;
    this.config = config;
  }

  // ── Clean ──────────────────────────────────────────────────

  async clean(): Promise<void> {
    console.log("\n🧹 Cleaning database...");
    const tables = [
      "activity_events", "api_keys", "webhook_endpoints",
      "projects", "org_members", "organizations",
      "subscriptions", "profiles",
    ];

    for (const table of tables) {
      const { error } = await this.supabase
        .from(table)
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) {
        console.warn(`  ⚠️  Could not clean ${table}: ${error.message}`);
      } else {
        console.log(`  ✓ Cleaned ${table}`);
      }
    }
  }

  // ── Users ─────────────────────────────────────────────────

  async seedUsers(): Promise<void> {
    const multiplier = ENV_MULTIPLIERS[this.config.env] ?? 1;
    const count = Math.round(this.config.userCount * multiplier);
    console.log(`\n👤 Seeding ${count} users...`);

    // Always create a demo admin user
    const adminUser: SeededUser = {
      id: randomUUID(),
      email: "admin@syncta.ai",
      full_name: "Demo Admin",
      avatar_url: null,
      role: "admin",
    };
    this.users.push(adminUser);

    for (let i = 0; i < count - 1; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      this.users.push({
        id: randomUUID(),
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        full_name: `${firstName} ${lastName}`,
        avatar_url: Math.random() > 0.3 ? faker.image.avatar() : null,
        role: weightedRandom(["admin", "member", "viewer"] as const, [0.15, 0.6, 0.25]),
      });
    }

    const profiles = this.users.map((u) => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      avatar_url: u.avatar_url,
      created_at: faker.date.past({ years: 1 }).toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await this.supabase.from("profiles").upsert(profiles);
    if (error) throw new Error(`Failed to seed users: ${error.message}`);
    console.log(`  ✓ Created ${this.users.length} user profiles`);
  }
  // ── Organizations ──────────────────────────────────────────

  async seedOrganizations(): Promise<void> {
    const multiplier = ENV_MULTIPLIERS[this.config.env] ?? 1;
    const count = Math.round(this.config.orgCount * multiplier);
    console.log(`\n🏢 Seeding ${count} organizations...`);

    for (let i = 0; i < count; i++) {
      const companyName = faker.company.name();
      const plan = weightedRandom(PLANS, PLAN_WEIGHTS);
      const owner = this.users[i % this.users.length];

      const org: SeededOrg = {
        id: randomUUID(),
        name: companyName,
        slug: faker.helpers.slugify(companyName).toLowerCase(),
        owner_id: owner.id,
        plan,
        stripe_customer_id: plan !== "free" ? generateStripeId("cus") : null,
        stripe_subscription_id: plan !== "free" ? generateStripeId("sub") : null,
      };
      this.orgs.push(org);
    }

    const orgsData = this.orgs.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      owner_id: o.owner_id,
      plan: o.plan,
      stripe_customer_id: o.stripe_customer_id,
      stripe_subscription_id: o.stripe_subscription_id,
      industry: INDUSTRIES[Math.floor(Math.random() * INDUSTRIES.length)],
      created_at: faker.date.past({ years: 1 }).toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await this.supabase.from("organizations").upsert(orgsData);
    if (error) throw new Error(`Failed to seed organizations: ${error.message}`);
    console.log(`  ✓ Created ${this.orgs.length} organizations`);

    // Seed org members
    await this.seedOrgMembers();
  }

  private async seedOrgMembers(): Promise<void> {
    console.log("  → Assigning members to organizations...");
    const memberships: Array<{
      org_id: string;
      user_id: string;
      role: string;
      joined_at: string;
    }> = [];

    for (const org of this.orgs) {
      // Owner is always an admin member
      memberships.push({
        org_id: org.id,
        user_id: org.owner_id,
        role: "admin",
        joined_at: faker.date.past({ years: 1 }).toISOString(),
      });

      // Add 3-8 random members
      const memberCount = faker.number.int({ min: 3, max: 8 });
      const shuffled = [...this.users]
        .filter((u) => u.id !== org.owner_id)
        .sort(() => Math.random() - 0.5)
        .slice(0, memberCount);

      for (const user of shuffled) {
        memberships.push({
          org_id: org.id,
          user_id: user.id,
          role: user.role,
          joined_at: faker.date.past({ years: 0.5 }).toISOString(),
        });
      }
    }

    const { error } = await this.supabase.from("org_members").upsert(memberships);
    if (error) throw new Error(`Failed to seed org members: ${error.message}`);
    console.log(`  ✓ Created ${memberships.length} org memberships`);
  }
  // ── Projects ──────────────────────────────────────────────

  async seedProjects(): Promise<void> {
    const multiplier = ENV_MULTIPLIERS[this.config.env] ?? 1;
    const perOrg = Math.round(this.config.projectsPerOrg * multiplier);
    console.log(`\n📁 Seeding ~${perOrg} projects per org...`);

    const usedNames = new Set<string>();

    for (const org of this.orgs) {
      const count = faker.number.int({ min: Math.max(1, perOrg - 1), max: perOrg + 2 });

      for (let i = 0; i < count; i++) {
        let name = PROJECT_NAMES[Math.floor(Math.random() * PROJECT_NAMES.length)];
        const uniqueKey = `${org.id}-${name}`;
        if (usedNames.has(uniqueKey)) {
          name = `${name} v${faker.number.int({ min: 2, max: 5 })}`;
        }
        usedNames.add(`${org.id}-${name}`);

        this.projects.push({
          id: randomUUID(),
          org_id: org.id,
          name,
          description: faker.lorem.sentence({ min: 8, max: 20 }),
          status: weightedRandom(
            ["active", "paused", "archived"] as const,
            [0.7, 0.2, 0.1]
          ),
          api_key: generateApiKey(),
          created_by: this.users[Math.floor(Math.random() * this.users.length)].id,
        });
      }
    }

    const projectsData = this.projects.map((p) => ({
      id: p.id,
      org_id: p.org_id,
      name: p.name,
      description: p.description,
      status: p.status,
      created_by: p.created_by,
      created_at: faker.date.past({ years: 0.5 }).toISOString(),
      updated_at: faker.date.recent({ days: 30 }).toISOString(),
    }));

    const { error } = await this.supabase.from("projects").upsert(projectsData);
    if (error) throw new Error(`Failed to seed projects: ${error.message}`);
    console.log(`  ✓ Created ${this.projects.length} projects`);

    // Seed API keys for each project
    await this.seedApiKeys();
  }

  private async seedApiKeys(): Promise<void> {
    console.log("  → Generating API keys...");
    const apiKeys = this.projects.map((p) => ({
      id: randomUUID(),
      project_id: p.id,
      key_hash: generateApiKey(),
      key_prefix: p.api_key.slice(0, 12),
      name: `${p.name} - Production`,
      last_used_at: faker.date.recent({ days: 7 }).toISOString(),
      created_at: faker.date.past({ years: 0.3 }).toISOString(),
      expires_at: faker.date.future({ years: 1 }).toISOString(),
      is_active: p.status === "active",
    }));

    const { error } = await this.supabase.from("api_keys").upsert(apiKeys);
    if (error) throw new Error(`Failed to seed API keys: ${error.message}`);
    console.log(`  ✓ Created ${apiKeys.length} API keys`);
  }
  // ── Subscriptions ─────────────────────────────────────────

  async seedSubscriptions(): Promise<void> {
    console.log("\n💳 Seeding subscriptions...");
    const paidOrgs = this.orgs.filter((o) => o.plan !== "free");

    const PRICE_MAP: Record<string, number> = {
      starter: 2900,
      pro: 7900,
      enterprise: 29900,
    };

    const subscriptions = paidOrgs.map((org) => ({
      id: randomUUID(),
      org_id: org.id,
      stripe_subscription_id: org.stripe_subscription_id,
      stripe_customer_id: org.stripe_customer_id,
      plan: org.plan,
      status: weightedRandom(
        ["active", "trialing", "past_due", "canceled"] as const,
        [0.75, 0.1, 0.1, 0.05]
      ),
      price_cents: PRICE_MAP[org.plan] ?? 0,
      currency: "usd",
      interval: Math.random() > 0.3 ? "month" : "year",
      current_period_start: faker.date.recent({ days: 30 }).toISOString(),
      current_period_end: faker.date.future({ years: 0.1 }).toISOString(),
      created_at: faker.date.past({ years: 0.8 }).toISOString(),
    }));

    const { error } = await this.supabase.from("subscriptions").upsert(subscriptions);
    if (error) throw new Error(`Failed to seed subscriptions: ${error.message}`);
    console.log(`  ✓ Created ${subscriptions.length} subscriptions`);
  }

  // ── Activity Events ───────────────────────────────────────

  async seedActivityEvents(): Promise<void> {
    const multiplier = ENV_MULTIPLIERS[this.config.env] ?? 1;
    const perUser = Math.round(this.config.eventsPerUser * multiplier);
    console.log(`\n📊 Seeding ~${perUser} events per user...`);

    const events: Array<{
      id: string;
      user_id: string;
      org_id: string;
      type: string;
      metadata: Record<string, unknown>;
      created_at: string;
    }> = [];

    for (const user of this.users) {
      const count = faker.number.int({ min: Math.max(1, perUser - 3), max: perUser + 3 });
      const userOrg = this.orgs[Math.floor(Math.random() * this.orgs.length)];

      for (let i = 0; i < count; i++) {
        const type = ACTIVITY_TYPES[Math.floor(Math.random() * ACTIVITY_TYPES.length)];
        events.push({
          id: randomUUID(),
          user_id: user.id,
          org_id: userOrg.id,
          type,
          metadata: this.generateEventMetadata(type),
          created_at: faker.date.recent({ days: 90 }).toISOString(),
        });
      }
    }

    // Sort chronologically
    events.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Batch insert (Supabase has a row limit per request)
    const BATCH_SIZE = 500;
    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const batch = events.slice(i, i + BATCH_SIZE);
      const { error } = await this.supabase.from("activity_events").upsert(batch);
      if (error) throw new Error(`Failed to seed events batch: ${error.message}`);
    }
    console.log(`  ✓ Created ${events.length} activity events`);
  }

  private generateEventMetadata(type: string): Record<string, unknown> {
    switch (type) {
      case "user.login":
        return { ip: faker.internet.ip(), user_agent: faker.internet.userAgent() };
      case "user.signup":
        return { referral_source: faker.helpers.arrayElement(["google", "twitter", "direct", "referral"]) };
      case "project.created":
      case "project.updated":
        return { project_name: faker.helpers.arrayElement(PROJECT_NAMES) };
      case "billing.invoice_paid":
        return { amount_cents: faker.number.int({ min: 2900, max: 29900 }), currency: "usd" };
      case "billing.subscription_changed":
        return { from: faker.helpers.arrayElement(["free", "starter"]), to: faker.helpers.arrayElement(["pro", "enterprise"]) };
      case "member.invited":
        return { invited_email: faker.internet.email().toLowerCase(), role: "member" };
      default:
        return {};
    }
  }
  // ── Webhook Endpoints ─────────────────────────────────────

  async seedWebhooks(): Promise<void> {
    console.log("\n🔗 Seeding webhook endpoints...");
    const webhooks = this.projects
      .filter((p) => p.status === "active")
      .slice(0, Math.ceil(this.projects.length * 0.6))
      .map((project) => ({
        id: randomUUID(),
        project_id: project.id,
        url: `https://${faker.internet.domainName()}/webhooks/syncta`,
        events: faker.helpers.arrayElements(
          ["lead.qualified", "lead.scored", "lead.routed", "batch.completed", "error"],
          { min: 1, max: 4 }
        ),
        secret: generateApiKey(),
        is_active: Math.random() > 0.1,
        last_triggered_at: faker.date.recent({ days: 7 }).toISOString(),
        failure_count: faker.number.int({ min: 0, max: 3 }),
        created_at: faker.date.past({ years: 0.3 }).toISOString(),
      }));

    const { error } = await this.supabase.from("webhook_endpoints").upsert(webhooks);
    if (error) throw new Error(`Failed to seed webhooks: ${error.message}`);
    console.log(`  ✓ Created ${webhooks.length} webhook endpoints`);
  }

  // ── Run All ───────────────────────────────────────────────

  async run(): Promise<void> {
    const startTime = Date.now();
    console.log("━".repeat(60));
    console.log(`🌱 Syncta SaaS Kit — Database Seeder`);
    console.log(`   Environment: ${this.config.env}`);
    console.log(`   Clean mode:  ${this.config.clean}`);
    console.log("━".repeat(60));

    try {
      if (this.config.clean) {
        await this.clean();
      }

      const seeders: Record<string, () => Promise<void>> = {
        users: () => this.seedUsers(),
        orgs: () => this.seedOrganizations(),
        projects: () => this.seedProjects(),
        subscriptions: () => this.seedSubscriptions(),
        events: () => this.seedActivityEvents(),
        webhooks: () => this.seedWebhooks(),
      };

      const toRun = this.config.only
        ? Object.entries(seeders).filter(([key]) => this.config.only!.includes(key))
        : Object.entries(seeders);

      for (const [name, seeder] of toRun) {
        await seeder();
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log("\n" + "━".repeat(60));
      console.log(`✅ Seeding complete in ${elapsed}s`);
      console.log("━".repeat(60));
      console.log("\n📋 Summary:");
      console.log(`   Users:         ${this.users.length}`);
      console.log(`   Organizations: ${this.orgs.length}`);
      console.log(`   Projects:      ${this.projects.length}`);
      console.log(`   Demo login:    admin@syncta.ai`);
      console.log("");
    } catch (error) {
      console.error("\n❌ Seeding failed:", error);
      process.exit(1);
    }
  }
}

// ─── CLI ────────────────────────────────────────────────────────

function parseArgs(): SeedConfig {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--env":
        config.env = args[++i] as SeedConfig["env"];
        break;
      case "--clean":
        config.clean = true;
        break;
      case "--only":
        config.only = args[++i].split(",");
        break;
      case "--users":
        config.userCount = parseInt(args[++i], 10);
        break;
      case "--orgs":
        config.orgCount = parseInt(args[++i], 10);
        break;
      case "--help":
        console.log("Usage: npx tsx scripts/seed.ts [options]");
        console.log("  --env <env>       Environment: development|staging|test");
        console.log("  --clean           Wipe existing data before seeding");
        console.log("  --only <tables>   Comma-separated: users,orgs,projects,subscriptions,events,webhooks");
        console.log("  --users <n>       Number of users to create");
        console.log("  --orgs <n>        Number of organizations to create");
        process.exit(0);
    }
  }

  return config;
}

async function main() {
  const config = parseArgs();

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing environment variables:");
    if (!supabaseUrl) console.error("   - SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
    if (!supabaseKey) console.error("   - SUPABASE_SERVICE_ROLE_KEY");
    console.error("\nMake sure your .env.local file is configured.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const seeder = new DatabaseSeeder(supabase, config);
  await seeder.run();
}

main();
