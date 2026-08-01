import { NextRequest, NextResponse } from "next/server";
import { createAlipayPagePay, isAlipayConfigured } from "@/lib/alipay";
import { getCnOrder } from "@/lib/cn-orders";
import { cnPriceYuan } from "@/lib/pro";

/**
 * Serves an auto-submit HTML form that POSTs to Alipay gateway.
 * Official recommended pattern for alipay.trade.page.pay.
 */
export async function GET(req: NextRequest) {
  if (!isAlipayConfigured()) {
    return new NextResponse("Alipay not configured", { status: 503 });
  }

  const orderId = req.nextUrl.searchParams.get("orderId")?.trim();
  if (!orderId) {
    return new NextResponse("orderId required", { status: 400 });
  }

  const order = getCnOrder(orderId);
  if (!order || order.channel !== "alipay") {
    return new NextResponse("order not found", { status: 404 });
  }
  if (order.status === "paid") {
    return NextResponse.redirect(
      new URL(
        `/cn/pricing?orderId=${encodeURIComponent(orderId)}`,
        req.nextUrl.origin
      )
    );
  }

  const base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://regex.ststudio.top"
  ).replace(/\/$/, "");
  const notifyUrl =
    process.env.ALIPAY_NOTIFY_URL || `${base}/api/pay/alipay/notify`;
  const returnUrl =
    process.env.ALIPAY_RETURN_URL ||
    `${base}/cn/pricing?orderId=${encodeURIComponent(orderId)}`;

  const totalYuan = (order.totalFeeFen / 100).toFixed(2);
  const { payFormHtml } = createAlipayPagePay({
    outTradeNo: orderId,
    subject: "Forge Regex Pro",
    totalYuan: totalYuan || cnPriceYuan().toFixed(2),
    notifyUrl,
    returnUrl,
  });

  return new NextResponse(payFormHtml, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
