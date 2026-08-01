import { NextRequest, NextResponse } from "next/server";
import { queryAlipayTrade } from "@/lib/alipay";
import { getCnOrder, markCnOrderPaid } from "@/lib/cn-orders";
import { extendProByMonth } from "@/lib/pro";

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId")?.trim();
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }
  let order = getCnOrder(orderId);
  if (!order) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Notify may fail (e.g. bad signature historically); poll Alipay as fallback.
  if (order.status === "pending" && order.channel === "alipay") {
    try {
      const q = await queryAlipayTrade(orderId);
      if (
        q &&
        (q.tradeStatus === "TRADE_SUCCESS" || q.tradeStatus === "TRADE_FINISHED")
      ) {
        markCnOrderPaid(orderId, q.tradeNo);
        await extendProByMonth(order.email);
        order = getCnOrder(orderId)!;
      }
    } catch (err) {
      console.error("[alipay/status] query failed", err);
    }
  }

  return NextResponse.json({
    orderId: order.outTradeNo,
    status: order.status,
    email: order.email,
    channel: order.channel,
  });
}
