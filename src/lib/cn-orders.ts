import { randomBytes } from "crypto";
import { getDb } from "@/lib/db";

export type CnChannel = "wechat" | "alipay";
export type CnOrderStatus = "pending" | "paid" | "failed";

export type CnOrder = {
  outTradeNo: string;
  email: string;
  channel: CnChannel;
  totalFeeFen: number;
  status: CnOrderStatus;
  codeUrl?: string;
  transactionId?: string;
  createdAt: string;
  paidAt?: string;
};

type Row = {
  out_trade_no: string;
  email: string;
  channel: string;
  total_fee_fen: number;
  status: string;
  code_url: string | null;
  transaction_id: string | null;
  created_at: string;
  paid_at: string | null;
};

function rowToOrder(row: Row): CnOrder {
  return {
    outTradeNo: row.out_trade_no,
    email: row.email,
    channel: row.channel as CnChannel,
    totalFeeFen: row.total_fee_fen,
    status: row.status as CnOrderStatus,
    codeUrl: row.code_url ?? undefined,
    transactionId: row.transaction_id ?? undefined,
    createdAt: row.created_at,
    paidAt: row.paid_at ?? undefined,
  };
}

export function newOutTradeNo(channel: CnChannel): string {
  const prefix = channel === "wechat" ? "WX" : "ALI";
  return `${prefix}${Date.now()}${randomBytes(3).toString("hex")}`.slice(0, 32);
}

export function createCnOrder(input: {
  outTradeNo: string;
  email: string;
  channel: CnChannel;
  totalFeeFen: number;
  codeUrl?: string;
}): CnOrder {
  const createdAt = new Date().toISOString();
  getDb()
    .prepare(
      `
      INSERT INTO cn_orders (
        out_trade_no, email, channel, total_fee_fen, status, code_url, created_at
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?)
    `
    )
    .run(
      input.outTradeNo,
      input.email.trim().toLowerCase(),
      input.channel,
      input.totalFeeFen,
      input.codeUrl ?? null,
      createdAt
    );
  return getCnOrder(input.outTradeNo)!;
}

export function getCnOrder(outTradeNo: string): CnOrder | null {
  const row = getDb()
    .prepare("SELECT * FROM cn_orders WHERE out_trade_no = ?")
    .get(outTradeNo) as Row | undefined;
  return row ? rowToOrder(row) : null;
}

export function setCnOrderCodeUrl(outTradeNo: string, codeUrl: string): void {
  getDb()
    .prepare("UPDATE cn_orders SET code_url = ? WHERE out_trade_no = ?")
    .run(codeUrl, outTradeNo);
}

export function markCnOrderPaid(
  outTradeNo: string,
  transactionId?: string
): CnOrder | null {
  const existing = getCnOrder(outTradeNo);
  if (!existing) return null;
  if (existing.status === "paid") return existing;
  const paidAt = new Date().toISOString();
  getDb()
    .prepare(
      `
      UPDATE cn_orders
      SET status = 'paid', paid_at = ?, transaction_id = COALESCE(?, transaction_id)
      WHERE out_trade_no = ?
    `
    )
    .run(paidAt, transactionId ?? null, outTradeNo);
  return getCnOrder(outTradeNo);
}
