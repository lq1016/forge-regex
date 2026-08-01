import { NextRequest, NextResponse } from "next/server";
import { getCnOrder, markCnOrderPaid } from "@/lib/cn-orders";
import { extendProByMonth } from "@/lib/pro";
import { isWechatPayConfigured, queryByOutTradeNo } from "@/lib/wechat-pay";

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId")?.trim();
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  let order = getCnOrder(orderId);
  if (!order) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (order.status === "pending" && isWechatPayConfigured()) {
    try {
      const q = await queryByOutTradeNo(orderId);
      if (q.tradeState === "SUCCESS") {
        markCnOrderPaid(orderId, q.transactionId);
        await extendProByMonth(order.email);
        order = getCnOrder(orderId)!;
      }
    } catch {
      // ignore query errors while pending
    }
  }

  return NextResponse.json({
    orderId: order.outTradeNo,
    status: order.status,
    email: order.email,
    channel: order.channel,
  });
}
