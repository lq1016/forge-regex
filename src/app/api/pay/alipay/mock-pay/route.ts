import { NextRequest, NextResponse } from "next/server";
import { getCnOrder, markCnOrderPaid } from "@/lib/cn-orders";
import { extendProByMonth } from "@/lib/pro";
import { isAlipayMock } from "@/lib/alipay";

export async function POST(req: NextRequest) {
  if (!isAlipayMock()) {
    return NextResponse.json({ error: "mock disabled" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { orderId?: string };
  const orderId = body.orderId?.trim();
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }
  const order = getCnOrder(orderId);
  if (!order || order.channel !== "alipay") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (order.status !== "paid") {
    markCnOrderPaid(orderId, "mock_pay");
    await extendProByMonth(order.email);
  }
  return NextResponse.json({ ok: true, status: "paid" });
}
