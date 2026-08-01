import crypto from "crypto";

const PADDLE_API = "https://api.paddle.com";

export type PaddleTransaction = {
  id: string;
  status: string;
  customer_id: string | null;
  subscription_id: string | null;
  details?: {
    totals?: { total?: string };
  };
};

type PaddleListResponse<T> = {
  data: T;
  error?: { detail?: string };
};

function apiKey(): string {
  const key = process.env.PADDLE_API_KEY;
  if (!key) throw new Error("PADDLE_API_KEY is not configured");
  return key;
}

export async function fetchTransaction(
  transactionId: string
): Promise<PaddleTransaction> {
  const res = await fetch(`${PADDLE_API}/transactions/${transactionId}`, {
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const body = (await res.json()) as PaddleListResponse<PaddleTransaction>;
  if (!res.ok || !body.data) {
    throw new Error(body.error?.detail || `Paddle transaction fetch failed (${res.status})`);
  }
  return body.data;
}

export async function fetchCustomerEmail(
  customerId: string
): Promise<string | undefined> {
  const res = await fetch(`${PADDLE_API}/customers/${customerId}`, {
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) return undefined;
  const body = (await res.json()) as { data?: { email?: string } };
  return body.data?.email;
}

/**
 * Verify Paddle Billing webhook signature (Paddle-Signature header).
 * Signed payload is `${ts}:${rawBody}` with HMAC-SHA256.
 */
export function verifyPaddleWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;

  let ts = "";
  const h1s: string[] = [];
  for (const part of signatureHeader.split(";")) {
    const [key, value] = part.split("=");
    if (key === "ts") ts = value ?? "";
    if (key === "h1" && value) h1s.push(value);
  }
  if (!ts || h1s.length === 0) return false;

  const age = Math.floor(Date.now() / 1000) - Number(ts);
  if (!Number.isFinite(age) || age > 300 || age < -30) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${ts}:${rawBody}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  return h1s.some((h1) => {
    const got = Buffer.from(h1, "utf8");
    return (
      got.length === expectedBuf.length &&
      crypto.timingSafeEqual(got, expectedBuf)
    );
  });
}
