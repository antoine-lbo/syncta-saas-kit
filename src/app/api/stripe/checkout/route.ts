import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout session for subscription upgrades.
 *
 * Request body:
 *   - priceId: Stripe price ID for the subscription plan
 *   - successUrl?: Custom success redirect URL
 *   - cancelUrl?: Custom cancel redirect URL
 */
export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    // Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { priceId, successUrl, cancelUrl } = body;

    if (!priceId) {
      return NextResponse.json(
        { error: "Price ID is required" },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    const { data: org } = await supabase
      .from("organizations")
      .select("id, stripe_customer_id, name")
      .eq("id", (
        await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .single()
      ).data?.organization_id)
      .single();

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    let stripeCustomerId = org.stripe_customer_id;

    if (!stripeCustomerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: org.name,
        metadata: {
          org_id: org.id,
          user_id: user.id,
        },
      });

      stripeCustomerId = customer.id;

      // Store customer ID
      await supabase
        .from("organizations")
        .update({ stripe_customer_id: customer.id })
        .eq("id", org.id);
    }

    // Create Checkout session
    const origin = new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${origin}/dashboard?checkout=success`,
      cancel_url: cancelUrl || `${origin}/dashboard/settings?checkout=cancelled`,
      subscription_data: {
        metadata: {
          org_id: org.id,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      tax_id_collection: {
        enabled: true,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
