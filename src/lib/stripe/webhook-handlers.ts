/**
 * Stripe Webhook Event Handlers
 *
 * Processes Stripe webhook events for subscription lifecycle management,
 * payment tracking, and customer synchronization. Each handler is isolated
 * and idempotent — safe to retry on failure.
 *
 * @module stripe/webhook-handlers
 */

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebhookResult {
  success: boolean;
  event_type: string;
  message: string;
  metadata?: Record<string, unknown>;
}

type EventHandler = (event: Stripe.Event) => Promise<WebhookResult>;

/** Maps Stripe price IDs to internal plan identifiers. */
const PRICE_TO_PLAN: Record<string, string> = {
  [process.env.STRIPE_PRICE_STARTER!]: "starter",
  [process.env.STRIPE_PRICE_PRO!]: "pro",
  [process.env.STRIPE_PRICE_ENTERPRISE!]: "enterprise",
};

// ---------------------------------------------------------------------------
// Handler Registry
// ---------------------------------------------------------------------------

/**
 * Central registry mapping Stripe event types to their handlers.
 * Only events listed here will be processed — all others are acknowledged
 * but ignored (returns 200 to prevent Stripe retries).
 */
export const EVENT_HANDLERS: Record<string, EventHandler> = {
  "checkout.session.completed": handleCheckoutCompleted,
  "customer.subscription.created": handleSubscriptionCreated,
  "customer.subscription.updated": handleSubscriptionUpdated,
  "customer.subscription.deleted": handleSubscriptionDeleted,
  "invoice.payment_succeeded": handleInvoicePaymentSucceeded,
  "invoice.payment_failed": handleInvoicePaymentFailed,
  "customer.updated": handleCustomerUpdated,
};
// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

/**
 * Ensures each webhook event is processed exactly once.
 * Uses the `webhook_events` table with a unique constraint on `stripe_event_id`.
 *
 * @returns `true` if the event has already been processed.
 */
export async function isEventProcessed(eventId: string): Promise<boolean> {
  const { data } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("stripe_event_id", eventId)
    .single();

  return !!data;
}

/**
 * Records a processed event for idempotency tracking.
 */
export async function markEventProcessed(
  eventId: string,
  eventType: string,
  result: WebhookResult
): Promise<void> {
  await supabase.from("webhook_events").insert({
    stripe_event_id: eventId,
    event_type: eventType,
    processed_at: new Date().toISOString(),
    success: result.success,
    metadata: result.metadata ?? {},
  });
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

/**
 * Handles successful checkout sessions.
 *
 * After a customer completes Stripe Checkout we:
 * 1. Link the Stripe customer to their organisation.
 * 2. Create the initial subscription record.
 * 3. Update the organisation plan.
 */
async function handleCheckoutCompleted(
  event: Stripe.Event
): Promise<WebhookResult> {
  const session = event.data.object as Stripe.Checkout.Session;

  if (session.mode !== "subscription") {
    return {
      success: true,
      event_type: event.type,
      message: `Ignored non-subscription checkout (mode=${session.mode})`,
    };
  }

  const orgId = session.metadata?.org_id;
  if (!orgId) {
    throw new Error("checkout.session.completed missing org_id in metadata");
  }

  // Link Stripe customer to organisation
  await supabase
    .from("organizations")
    .update({ stripe_customer_id: session.customer as string })
    .eq("id", orgId);

  // Retrieve the full subscription to determine the plan
  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  );

  const plan = determinePlan(subscription);

  await upsertSubscription(orgId, subscription, plan);
  await logActivity(orgId, "subscription.created", {
    plan,
    stripe_subscription_id: subscription.id,
  });

  return {
    success: true,
    event_type: event.type,
    message: `Organisation ${orgId} subscribed to ${plan}`,
    metadata: { orgId, plan, subscriptionId: subscription.id },
  };
}
// ---------------------------------------------------------------------------
// Subscription Lifecycle
// ---------------------------------------------------------------------------

async function handleSubscriptionCreated(
  event: Stripe.Event
): Promise<WebhookResult> {
  const subscription = event.data.object as Stripe.Subscription;
  const orgId = await getOrgIdByCustomer(subscription.customer as string);

  if (!orgId) {
    return {
      success: true,
      event_type: event.type,
      message: "No organisation linked to this customer — skipping",
    };
  }

  const plan = determinePlan(subscription);
  await upsertSubscription(orgId, subscription, plan);

  return {
    success: true,
    event_type: event.type,
    message: `Subscription created for org ${orgId} (${plan})`,
    metadata: { orgId, plan },
  };
}

async function handleSubscriptionUpdated(
  event: Stripe.Event
): Promise<WebhookResult> {
  const subscription = event.data.object as Stripe.Subscription;
  const orgId = await getOrgIdByCustomer(subscription.customer as string);

  if (!orgId) {
    return {
      success: true,
      event_type: event.type,
      message: "No organisation linked — skipping",
    };
  }

  const plan = determinePlan(subscription);
  const previousPlan = determinePlanFromPrevious(event);

  await upsertSubscription(orgId, subscription, plan);

  // Detect plan changes (upgrades / downgrades)
  if (previousPlan && previousPlan !== plan) {
    await logActivity(orgId, "subscription.plan_changed", {
      from: previousPlan,
      to: plan,
      stripe_subscription_id: subscription.id,
    });
  }

  // Handle cancellation scheduling
  if (subscription.cancel_at_period_end) {
    await logActivity(orgId, "subscription.cancel_scheduled", {
      cancel_at: subscription.cancel_at,
      current_period_end: subscription.current_period_end,
    });
  }

  return {
    success: true,
    event_type: event.type,
    message: `Subscription updated for org ${orgId} (${plan})`,
    metadata: { orgId, plan, status: subscription.status },
  };
}

async function handleSubscriptionDeleted(
  event: Stripe.Event
): Promise<WebhookResult> {
  const subscription = event.data.object as Stripe.Subscription;
  const orgId = await getOrgIdByCustomer(subscription.customer as string);

  if (!orgId) {
    return {
      success: true,
      event_type: event.type,
      message: "No organisation linked — skipping",
    };
  }

  // Downgrade to free plan
  await supabase
    .from("organizations")
    .update({ plan: "free", subscription_status: "canceled" })
    .eq("id", orgId);

  await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  await logActivity(orgId, "subscription.canceled", {
    stripe_subscription_id: subscription.id,
  });

  return {
    success: true,
    event_type: event.type,
    message: `Subscription canceled for org ${orgId} — downgraded to free`,
    metadata: { orgId },
  };
}
// ---------------------------------------------------------------------------
// Invoice / Payment
// ---------------------------------------------------------------------------

async function handleInvoicePaymentSucceeded(
  event: Stripe.Event
): Promise<WebhookResult> {
  const invoice = event.data.object as Stripe.Invoice;

  // Skip draft or zero-value invoices
  if (!invoice.subscription || invoice.amount_paid === 0) {
    return {
      success: true,
      event_type: event.type,
      message: "Non-subscription or zero-value invoice — skipping",
    };
  }

  const orgId = await getOrgIdByCustomer(invoice.customer as string);
  if (!orgId) {
    return {
      success: true,
      event_type: event.type,
      message: "No organisation linked — skipping",
    };
  }

  // Record payment in the invoices table
  await supabase.from("invoices").insert({
    org_id: orgId,
    stripe_invoice_id: invoice.id,
    amount_paid: invoice.amount_paid,
    currency: invoice.currency,
    status: "paid",
    period_start: new Date(invoice.period_start * 1000).toISOString(),
    period_end: new Date(invoice.period_end * 1000).toISOString(),
    hosted_invoice_url: invoice.hosted_invoice_url,
    pdf_url: invoice.invoice_pdf,
  });

  // Reset any past-due flags
  await supabase
    .from("organizations")
    .update({ subscription_status: "active", past_due_since: null })
    .eq("id", orgId);

  await logActivity(orgId, "invoice.paid", {
    amount: invoice.amount_paid,
    currency: invoice.currency,
    invoice_id: invoice.id,
  });

  return {
    success: true,
    event_type: event.type,
    message: `Payment of ${invoice.amount_paid} ${invoice.currency} recorded for org ${orgId}`,
    metadata: { orgId, amount: invoice.amount_paid },
  };
}

async function handleInvoicePaymentFailed(
  event: Stripe.Event
): Promise<WebhookResult> {
  const invoice = event.data.object as Stripe.Invoice;
  const orgId = await getOrgIdByCustomer(invoice.customer as string);

  if (!orgId) {
    return {
      success: true,
      event_type: event.type,
      message: "No organisation linked — skipping",
    };
  }

  const attemptCount = invoice.attempt_count ?? 1;

  // Mark organisation as past-due
  await supabase
    .from("organizations")
    .update({
      subscription_status: "past_due",
      past_due_since: new Date().toISOString(),
    })
    .eq("id", orgId);

  await logActivity(orgId, "invoice.payment_failed", {
    attempt_count: attemptCount,
    next_attempt: invoice.next_payment_attempt
      ? new Date(invoice.next_payment_attempt * 1000).toISOString()
      : null,
    amount_due: invoice.amount_due,
  });

  return {
    success: true,
    event_type: event.type,
    message: `Payment failed for org ${orgId} (attempt #${attemptCount})`,
    metadata: { orgId, attemptCount },
  };
}
// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

async function handleCustomerUpdated(
  event: Stripe.Event
): Promise<WebhookResult> {
  const customer = event.data.object as Stripe.Customer;
  const orgId = await getOrgIdByCustomer(customer.id);

  if (!orgId) {
    return {
      success: true,
      event_type: event.type,
      message: "No organisation linked — skipping",
    };
  }

  // Sync billing details
  await supabase
    .from("organizations")
    .update({
      billing_email: customer.email,
      billing_name: customer.name,
    })
    .eq("id", orgId);

  return {
    success: true,
    event_type: event.type,
    message: `Billing details synced for org ${orgId}`,
    metadata: { orgId, email: customer.email },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolves a Stripe price ID to the internal plan name. */
function determinePlan(subscription: Stripe.Subscription): string {
  const priceId = subscription.items.data[0]?.price.id;
  return PRICE_TO_PLAN[priceId] ?? "unknown";
}

/**
 * Extracts the previous plan from the `previous_attributes` field
 * present on subscription.updated events.
 */
function determinePlanFromPrevious(event: Stripe.Event): string | null {
  const prev = (event.data as any).previous_attributes;
  if (!prev?.items?.data?.[0]?.price?.id) return null;
  return PRICE_TO_PLAN[prev.items.data[0].price.id] ?? null;
}

/** Looks up the organisation tied to a Stripe customer. */
async function getOrgIdByCustomer(
  customerId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  return data?.id ?? null;
}

/** Creates or updates a subscription record. */
async function upsertSubscription(
  orgId: string,
  subscription: Stripe.Subscription,
  plan: string
): Promise<void> {
  const record = {
    org_id: orgId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
    plan,
    status: subscription.status,
    current_period_start: new Date(
      subscription.current_period_start * 1000
    ).toISOString(),
    current_period_end: new Date(
      subscription.current_period_end * 1000
    ).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
  };

  await supabase
    .from("subscriptions")
    .upsert(record, { onConflict: "stripe_subscription_id" });

  // Keep the organisation plan in sync
  await supabase
    .from("organizations")
    .update({ plan, subscription_status: subscription.status })
    .eq("id", orgId);
}

/** Writes an entry to the activity log for audit / analytics. */
async function logActivity(
  orgId: string,
  action: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await supabase.from("activity_log").insert({
    org_id: orgId,
    action,
    metadata,
    created_at: new Date().toISOString(),
  });
}
