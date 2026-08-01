import { NextResponse } from "next/server";
import { isAlipayConfigured, isAlipayMock } from "@/lib/alipay";
import { isWechatPayConfigured, isWechatPayMock } from "@/lib/wechat-pay";

export async function GET() {
  return NextResponse.json({
    wechat: isWechatPayConfigured(),
    alipay: isAlipayConfigured(),
    wechatMock: isWechatPayMock(),
    alipayMock: isAlipayMock(),
    paddle: Boolean(
      process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN &&
        process.env.NEXT_PUBLIC_PADDLE_PRICE_ID
    ),
    cnPriceYuan: Number(process.env.CN_PRICE_CNY || process.env.NEXT_PUBLIC_CN_PRICE_CNY || "9.9"),
  });
}
