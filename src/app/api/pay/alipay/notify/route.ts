import { NextRequest, NextResponse } from "next/server";
import {
  isAlipayMock,
  parseAlipayNotify,
  verifyAlipayParams,
} from "@/lib/alipay";
import { getCnOrder, markCnOrderPaid } from "@/lib/cn-orders";
import { extendProByMonth } from "@/lib/pro";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  try {
    if (isAlipayMock()) {
      const params = new URLSearchParams(raw);
      const outTradeNo =
        params.get("out_trade_no") ||
        (JSON.parse(raw || "{}") as { out_trade_no?: string }).out_trade_no;
      if (outTradeNo) {
        await fulfill(outTradeNo, "mock_alipay");
      }
      return new NextResponse("success");
    }

    const params = parseAlipayNotify(raw);
    if (!verifyAlipayParams(params)) {
      const keys = Object.keys(params).sort().join(",");
      console.error(
        "[alipay/notify] bad signature",
        `keys=${keys}`,
        `out_trade_no=${params.out_trade_no || ""}`,
        `trade_status=${params.trade_status || ""}`
      );
      return new NextResponse("failure");
    }

    const tradeStatus = params.trade_status || "";
    const outTradeNo = params.out_trade_no || "";
    const tradeNo = params.trade_no;

    if (
      outTradeNo &&
      (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED")
    ) {
      await fulfill(outTradeNo, tradeNo);
    }

    return new NextResponse("success");
  } catch (err) {
    console.error("[alipay/notify]", err);
    return new NextResponse("failure");
  }
}

async function fulfill(outTradeNo: string, transactionId?: string) {
  const order = getCnOrder(outTradeNo);
  if (!order) return;
  if (order.status === "paid") return;
  markCnOrderPaid(outTradeNo, transactionId);
  await extendProByMonth(order.email);
}
