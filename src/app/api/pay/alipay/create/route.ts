import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createAlipayPagePay, isAlipayConfigured } from "@/lib/alipay";
import { createCnOrder, newOutTradeNo, setCnOrderCodeUrl } from "@/lib/cn-orders";
import { cnPriceFen, cnPriceYuan } from "@/lib/pro";

export async function POST() {
  if (!isAlipayConfigured()) {
    return NextResponse.json(
      { error: "Alipay not configured", code: "coming_soon" },
      { status: 503 }
    );
  }

  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json(
      { error: "请先登录", code: "sign_in_required" },
      { status: 401 }
    );
  }

  const email = session.email;
  const outTradeNo = newOutTradeNo("alipay");
  const totalFen = cnPriceFen();
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://regex.ststudio.top"
  ).replace(/\/$/, "");
  const notifyUrl =
    process.env.ALIPAY_NOTIFY_URL || `${base}/api/pay/alipay/notify`;
  const returnUrl =
    process.env.ALIPAY_RETURN_URL ||
    `${base}/cn/pricing?orderId=${encodeURIComponent(outTradeNo)}`;

  createCnOrder({
    outTradeNo,
    email,
    channel: "alipay",
    totalFeeFen: totalFen,
  });

  try {
    // Warm-sign once to validate keys; cashier re-signs with fresh timestamp.
    createAlipayPagePay({
      outTradeNo,
      subject: "Forge Regex Pro",
      totalYuan: cnPriceYuan().toFixed(2),
      notifyUrl,
      returnUrl,
    });
    setCnOrderCodeUrl(outTradeNo, "page_pay");
    return NextResponse.json({
      orderId: outTradeNo,
      cashierPath: `/api/pay/alipay/cashier?orderId=${encodeURIComponent(outTradeNo)}`,
      mode: "page",
      amountFen: totalFen,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "prepay failed";
    console.error("[alipay/create]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
