import { NextRequest, NextResponse } from "next/server";
import { getCnOrder, markCnOrderPaid } from "@/lib/cn-orders";
import { extendProByMonth } from "@/lib/pro";
import {
  decryptNotifyResource,
  isWechatPayMock,
  parseNotifyBody,
} from "@/lib/wechat-pay";

export async function POST(req: NextRequest) {
  const raw = await req.text();

  try {
    if (isWechatPayMock()) {
      // Mock: body { out_trade_no, mock: true }
      const data = JSON.parse(raw) as {
        out_trade_no?: string;
        mock?: boolean;
      };
      if (data.mock && data.out_trade_no) {
        await fulfill(data.out_trade_no, "mock_txn");
        return new NextResponse(null, { status: 204 });
      }
    }

    const parsed = parseNotifyBody(raw);
    if (!parsed.resource) {
      return NextResponse.json({ code: "FAIL", message: "no resource" }, { status: 400 });
    }
    const plain = decryptNotifyResource(parsed.resource);
    const outTradeNo = String(plain.out_trade_no || "");
    const tradeState = String(plain.trade_state || "");
    const transactionId = plain.transaction_id
      ? String(plain.transaction_id)
      : undefined;

    if (tradeState === "SUCCESS" && outTradeNo) {
      await fulfill(outTradeNo, transactionId);
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[wechat/notify]", err);
    return NextResponse.json(
      { code: "FAIL", message: "notify error" },
      { status: 500 }
    );
  }
}

async function fulfill(outTradeNo: string, transactionId?: string) {
  const order = getCnOrder(outTradeNo);
  if (!order) return;
  if (order.status === "paid") return;
  markCnOrderPaid(outTradeNo, transactionId);
  await extendProByMonth(order.email);
}
