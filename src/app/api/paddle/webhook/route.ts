import { NextRequest, NextResponse } from "next/server";
import { verifyPaddleWebhookSignature } from "@/lib/paddle";
import {
  getSubscriptionById,
  type ProStatus,
  upsertSubscription,
} from "@/lib/pro";

type PaddleEvent = {
  event_type?: string;
  data?: {
    id?: string;
    customer_id?: string | null;
    status?: string;
    subscription_id?: string | null;
    email?: string;
  };
};

function mapStatus(raw?: string): ProStatus {
  switch (raw) {
    case "active":
    case "trialing":
      return "active";
    case "canceled":
    case "cancelled":
      return "canceled";
    case "past_due":
      return "past_due";
    case "paused":
      return "paused";
    default:
      return "none";
  }
}

/**
 * POST /api/paddle/webhook
 * Notification destination: https://regex.ststudio.top/api/paddle/webhook
 */
export async function POST(req: NextRequest) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[paddle/webhook] PADDLE_WEBHOOK_SECRET not set");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 }
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get("paddle-signature");

  if (!verifyPaddleWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: PaddleEvent;
  try {
    event = JSON.parse(rawBody) as PaddleEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = event.event_type ?? "";
  const data = event.data ?? {};

  try {
    if (
      type === "subscription.created" ||
      type === "subscription.updated" ||
      type === "subscription.activated" ||
      type === "subscription.canceled" ||
      type === "subscription.past_due" ||
      type === "subscription.paused" ||
      type === "subscription.resumed"
    ) {
      const customerId = data.customer_id;
      const subscriptionId = data.id;
      if (customerId && subscriptionId) {
        await upsertSubscription({
          customerId,
          subscriptionId,
          email: data.email,
          status: mapStatus(data.status),
        });
      }
    }

    if (type === "transaction.completed") {
      const customerId = data.customer_id;
      if (customerId) {
        const existing = data.subscription_id
          ? await getSubscriptionById(data.subscription_id)
          : null;
        await upsertSubscription({
          customerId,
          subscriptionId: data.subscription_id ?? existing?.subscriptionId,
          email: data.email ?? existing?.email,
          status: "active",
        });
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook handler error";
    console.error("[paddle/webhook]", type, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
