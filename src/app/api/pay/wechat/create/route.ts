import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createCnOrder, newOutTradeNo, setCnOrderCodeUrl } from "@/lib/cn-orders";
import { cnPriceFen } from "@/lib/pro";
import {
  createNativePrepay,
  isWechatPayConfigured,
} from "@/lib/wechat-pay";

export async function POST() {
  if (!isWechatPayConfigured()) {
    return NextResponse.json(
      { error: "WeChat Pay not configured", code: "coming_soon" },
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
  const outTradeNo = newOutTradeNo("wechat");
  const totalFen = cnPriceFen();
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://regex.ststudio.top";
  const notifyUrl =
    process.env.WECHAT_NOTIFY_URL || `${base.replace(/\/$/, "")}/api/pay/wechat/notify`;

  createCnOrder({
    outTradeNo,
    email,
    channel: "wechat",
    totalFeeFen: totalFen,
  });

  try {
    const { codeUrl } = await createNativePrepay({
      outTradeNo,
      description: "Forge Regex Pro 月付",
      totalFen,
      notifyUrl,
      attach: email,
    });
    setCnOrderCodeUrl(outTradeNo, codeUrl);
    return NextResponse.json({
      orderId: outTradeNo,
      codeUrl,
      amountFen: totalFen,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "prepay failed";
    console.error("[wechat/create]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
