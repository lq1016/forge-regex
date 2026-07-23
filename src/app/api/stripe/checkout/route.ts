import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const PRICE_ID = process.env.STRIPE_PRICE_ID || "";
const DOMAIN = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session for the $7/month plan.
 */
export async function POST(req: NextRequest) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
      apiVersion: "2026-06-24.dahlia",
    });
    const body = await req.json().catch(() => ({}));
    const { email } = body;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: PRICE_ID,
          quantity: 1,
        },
      ],
      ...(email ? { customer_email: email } : {}),
      success_url: `${DOMAIN}?checkout=success`,
      cancel_url: `${DOMAIN}`,
      metadata: {
        source: "forge-regex",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe/checkout]", message);
    return NextResponse.json(
      { error: "Failed to create checkout session." },
      { status: 500 }
    );
  }
}
