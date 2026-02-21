/**
 * Testing Helpers for Syncta SaaS Kit
 *
 * Utilities for creating test fixtures, mocking Supabase,
 * Stripe, and common test patterns used across the app.
 */

import { createClient } from "@supabase/supabase-js";
import type {
  User,
  Session,
  AuthError,
} from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// ─── Types ──────────────────────────────────────────────

export type OrgRole = "owner" | "admin" | "member" | "viewer";
export type PlanTier = "free" | "starter" | "pro" | "enterprise";

export interface TestUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
}

export interface TestOrg {
  id: string;
  name: string;
  slug: string;
  plan: PlanTier;
  stripeCustomerId?: string;
}

export interface TestMembership {
  userId: string;
  orgId: string;
  role: OrgRole;
}

export interface TestProject {
  id: string;
  orgId: string;
  name: string;
  description?: string;
}

// ─── ID Generators ──────────────────────────────────────

let idCounter = 0;

export function resetIdCounter(): void {
  idCounter = 0;
}

export function generateId(prefix = "test"): string {
  idCounter++;
  return `${prefix}_${idCounter.toString().padStart(6, "0")}`;
}

export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Factory Functions ───────────────────────────────────

export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  const id = overrides.id ?? generateUUID();
  return {
    id,
    email: `user-${id.slice(0, 8)}@test.syncta.ai`,
    fullName: `Test User ${id.slice(0, 8)}`,
    ...overrides,
  };
}

export function createTestOrg(overrides: Partial<TestOrg> = {}): TestOrg {
  const id = overrides.id ?? generateUUID();
  const name = overrides.name ?? `Test Org ${id.slice(0, 8)}`;
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    plan: "free",
    ...overrides,
  };
}

export function createTestProject(
  orgId: string,
  overrides: Partial<TestProject> = {}
): TestProject {
  const id = overrides.id ?? generateUUID();
  return {
    id,
    orgId,
    name: `Project ${id.slice(0, 8)}`,
    description: "A test project",
    ...overrides,
  };
}

export function createTestMembership(
  userId: string,
  orgId: string,
  role: OrgRole = "member"
): TestMembership {
  return { userId, orgId, role };
}

// ─── Auth Mocks ─────────────────────────────────────────

export function createMockSession(user: TestUser): Session {
  return {
    access_token: `mock-access-token-${user.id}`,
    refresh_token: `mock-refresh-token-${user.id}`,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: {
      id: user.id,
      email: user.email,
      aud: "authenticated",
      role: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: {
        full_name: user.fullName,
        avatar_url: user.avatarUrl,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as User,
  };
}

export function createMockAuthError(
  message = "Invalid credentials",
  status = 401
): AuthError {
  return {
    name: "AuthApiError",
    message,
    status,
  } as AuthError;
}

// ─── Supabase Client Mock ────────────────────────────────

export interface MockSupabaseOptions {
  user?: TestUser;
  session?: Session;
  authError?: AuthError;
}

export function createMockSupabaseClient(options: MockSupabaseOptions = {}) {
  const { user, session, authError } = options;

  const mockAuth = {
    getSession: jest.fn().mockResolvedValue({
      data: { session: session ?? null },
      error: authError ?? null,
    }),
    getUser: jest.fn().mockResolvedValue({
      data: { user: session?.user ?? null },
      error: authError ?? null,
    }),
    signInWithPassword: jest.fn().mockResolvedValue({
      data: { session, user: session?.user },
      error: authError ?? null,
    }),
    signUp: jest.fn().mockResolvedValue({
      data: { session, user: session?.user },
      error: authError ?? null,
    }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: jest.fn().mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    }),
  };

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    then: jest.fn().mockResolvedValue({ data: [], error: null }),
  };

  return {
    auth: mockAuth,
    from: jest.fn().mockReturnValue(mockQueryBuilder),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    _queryBuilder: mockQueryBuilder,
  };
}

// ─── Stripe Mocks ───────────────────────────────────────

export interface MockStripeSubscription {
  id: string;
  customerId: string;
  status: "active" | "trialing" | "past_due" | "canceled" | "unpaid";
  plan: PlanTier;
  currentPeriodStart: number;
  currentPeriodEnd: number;
}

export function createMockStripeSubscription(
  overrides: Partial<MockStripeSubscription> = {}
): MockStripeSubscription {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: `sub_${generateId("stripe")}`,
    customerId: `cus_${generateId("stripe")}`,
    status: "active",
    plan: "pro",
    currentPeriodStart: now,
    currentPeriodEnd: now + 30 * 24 * 60 * 60,
    ...overrides,
  };
}

export function createMockStripeEvent(
  type: string,
  data: Record<string, unknown> = {}
) {
  return {
    id: `evt_${generateId("stripe")}`,
    type,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: { object: data },
    api_version: "2023-10-16",
  };
}

export function createMockStripeInvoice(
  customerId: string,
  amount = 2900
) {
  return {
    id: `in_${generateId("stripe")}`,
    customer: customerId,
    amount_due: amount,
    amount_paid: amount,
    currency: "usd",
    status: "paid",
    subscription: `sub_${generateId("stripe")}`,
    hosted_invoice_url: "https://invoice.stripe.com/mock",
    invoice_pdf: "https://invoice.stripe.com/mock.pdf",
    created: Math.floor(Date.now() / 1000),
  };
}

// ─── API Key Mocks ──────────────────────────────────────

export function createMockApiKey(orgId: string) {
  const keyValue = `sk_test_${generateId("key")}_${Math.random().toString(36).slice(2, 18)}`;
  return {
    id: generateUUID(),
    org_id: orgId,
    name: "Test API Key",
    key_prefix: keyValue.slice(0, 12),
    key_hash: `hashed_${keyValue}`,
    scopes: ["read", "write"],
    last_used_at: null,
    expires_at: null,
    created_at: new Date().toISOString(),
  };
}

// ─── Request / Response Helpers ──────────────────────────

export function createMockRequest(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  body?: Record<string, unknown>,
  headers: Record<string, string> = {}
): Request {
  const url = "http://localhost:3000/api/test";
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };
  if (body && method !== "GET") {
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

export function createAuthenticatedRequest(
  user: TestUser,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  body?: Record<string, unknown>
): Request {
  return createMockRequest(method, body, {
    Authorization: `Bearer mock-token-${user.id}`,
  });
}

// ─── Assertion Helpers ───────────────────────────────────

export async function expectApiError(
  response: Response,
  status: number,
  messageContains?: string
) {
  expect(response.status).toBe(status);
  const body = await response.json();
  expect(body.error).toBeDefined();
  if (messageContains) {
    expect(body.error.message).toContain(messageContains);
  }
  return body;
}

export async function expectApiSuccess<T>(
  response: Response
): Promise<T> {
  expect(response.status).toBeGreaterThanOrEqual(200);
  expect(response.status).toBeLessThan(300);
  const body = await response.json();
  expect(body.data).toBeDefined();
  return body.data as T;
}

// ─── Test Scenario Builders ──────────────────────────────

/**
 * Creates a complete test scenario with user, org, membership, and project.
 * Useful for integration tests that need a full context.
 */
export function createTestScenario(options: {
  plan?: PlanTier;
  role?: OrgRole;
  projectCount?: number;
} = {}) {
  const { plan = "pro", role = "owner", projectCount = 1 } = options;

  const user = createTestUser();
  const org = createTestOrg({ plan });
  const membership = createTestMembership(user.id, org.id, role);
  const session = createMockSession(user);
  const projects = Array.from({ length: projectCount }, () =>
    createTestProject(org.id)
  );
  const subscription = createMockStripeSubscription({
    customerId: org.stripeCustomerId ?? `cus_${generateId("stripe")}`,
    plan,
  });

  return {
    user,
    org,
    membership,
    session,
    projects,
    subscription,
    supabase: createMockSupabaseClient({ user, session }),
  };
}

// ─── Time Helpers ────────────────────────────────────────

export function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export function daysAgo(days: number): Date {
  return daysFromNow(-days);
}

export function toUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

// ─── Cleanup ────────────────────────────────────────────

/**
 * Call in beforeEach or afterEach to reset all test state.
 */
export function resetTestState(): void {
  resetIdCounter();
  jest.clearAllMocks();
}
