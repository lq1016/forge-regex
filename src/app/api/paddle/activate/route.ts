import { NextRequest, NextResponse } from "next/server";
import { setSession } from "@/lib/auth";
import { fetchCustomerEmail, fetchTransaction } from "@/lib/paddle";
import { setProCookie, upsertSubscription } from "@/lib/pro";

/**
 * POST /api/paddle/activate
 * Body: { transactionId: string }
 *
 * Called after Paddle.js checkout.completed — verifies the transaction
 * via the Paddle API and sets the Pro cookie.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const transactionId =
      typeof body?.transactionId === "string" ? body.transactionId.trim() : "";

    if (!transactionId.startsWith("txn_")) {
      return NextResponse.json(
        { error: "Invalid transaction id." },
        { status: 400 }
      );
    }

    const txn = await fetchTransaction(transactionId);

    if (txn.status !== "completed" && txn.status !== "paid") {
      return NextResponse.json(
        { error: `Transaction not completed (status: ${txn.status}).` },
        { status: 402 }
      );
    }

    if (!txn.customer_id) {
      return NextResponse.json(
        { error: "Transaction has no customer." },
        { status: 422 }
      );
    }

    const email = await fetchCustomerEmail(txn.customer_id);

    await upsertSubscription({
      customerId: txn.customer_id,
      subscriptionId: txn.subscription_id ?? undefined,
      email,
      status: "active",
    });

    await setProCookie({
      cid: txn.customer_id,
      status: "active",
      email,
    });

    if (email) {
      await setSession({ email });
    }

    return NextResponse.json({
      ok: true,
      isPro: true,
      customerId: txn.customer_id,
      email: email ?? null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Activation failed";
    console.error("[api/paddle/activate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
