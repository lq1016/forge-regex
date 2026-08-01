import { createPrivateKey, createSign, createHash, createDecipheriv } from "crypto";
import { readFileSync, existsSync } from "fs";

const API_HOST = "https://api.mch.weixin.qq.com";

export function isWechatPayMock(): boolean {
  return process.env.WECHAT_PAY_MOCK === "1" || process.env.WECHAT_PAY_MOCK === "true";
}

function readPrivateKeyPem(): string | null {
  const inline = process.env.WECHAT_MCH_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (inline?.includes("PRIVATE KEY")) return inline;
  const path = process.env.WECHAT_MCH_PRIVATE_KEY_PATH;
  if (path && existsSync(path)) return readFileSync(path, "utf8");
  return null;
}

export function isWechatPayConfigured(): boolean {
  if (isWechatPayMock()) return true;
  return Boolean(
    process.env.WECHAT_APPID &&
      process.env.WECHAT_MCHID &&
      process.env.WECHAT_API_V3_KEY &&
      process.env.WECHAT_MCH_SERIAL_NO &&
      readPrivateKeyPem()
  );
}

function buildAuthorization(
  method: string,
  urlPath: string,
  body: string
): string {
  const mchid = process.env.WECHAT_MCHID!;
  const serial = process.env.WECHAT_MCH_SERIAL_NO!;
  const pem = readPrivateKeyPem()!;
  const nonce = cryptoRandom(16);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
  const key = createPrivateKey(pem);
  const signer = createSign("RSA-SHA256");
  signer.update(message);
  const signature = signer.sign(key, "base64");
  return `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${serial}"`;
}

function cryptoRandom(bytes: number): string {
  return createHash("sha256")
    .update(`${Date.now()}-${Math.random()}`)
    .digest("hex")
    .slice(0, bytes * 2);
}

export async function createNativePrepay(input: {
  outTradeNo: string;
  description: string;
  totalFen: number;
  notifyUrl: string;
  attach?: string;
}): Promise<{ codeUrl: string }> {
  if (isWechatPayMock()) {
    return { codeUrl: `weixin://wxpay/bizpayurl?mock=1&out=${input.outTradeNo}` };
  }

  const path = "/v3/pay/transactions/native";
  const bodyObj = {
    appid: process.env.WECHAT_APPID,
    mchid: process.env.WECHAT_MCHID,
    description: input.description,
    out_trade_no: input.outTradeNo,
    notify_url: input.notifyUrl,
    attach: input.attach,
    amount: { total: input.totalFen, currency: "CNY" },
  };
  const body = JSON.stringify(bodyObj);
  const res = await fetch(`${API_HOST}${path}`, {
    method: "POST",
    headers: {
      Authorization: buildAuthorization("POST", path, body),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`WeChat native prepay failed: ${res.status} ${text.slice(0, 300)}`);
  }
  const data = JSON.parse(text) as { code_url?: string };
  if (!data.code_url) throw new Error("WeChat prepay missing code_url");
  return { codeUrl: data.code_url };
}

export async function queryByOutTradeNo(
  outTradeNo: string
): Promise<{ tradeState?: string; transactionId?: string }> {
  if (isWechatPayMock()) return {};
  const mchid = process.env.WECHAT_MCHID!;
  const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(mchid)}`;
  const res = await fetch(`${API_HOST}${path}`, {
    method: "GET",
    headers: {
      Authorization: buildAuthorization("GET", path, ""),
      Accept: "application/json",
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`WeChat query failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = JSON.parse(text) as {
    trade_state?: string;
    transaction_id?: string;
  };
  return { tradeState: data.trade_state, transactionId: data.transaction_id };
}

/** Decrypt notify resource (AEAD_AES_256_GCM). Full signature verify needs platform cert — mock skips. */
export function decryptNotifyResource(resource: {
  ciphertext: string;
  associated_data?: string;
  nonce: string;
}): Record<string, unknown> {
  const apiKey = process.env.WECHAT_API_V3_KEY;
  if (!apiKey || apiKey.length !== 32) {
    throw new Error("WECHAT_API_V3_KEY must be 32 chars");
  }
  const ciphertext = Buffer.from(resource.ciphertext, "base64");
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const data = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(apiKey),
    Buffer.from(resource.nonce)
  );
  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(resource.associated_data));
  }
  decipher.setAuthTag(authTag);
  const decoded = Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8"
  );
  return JSON.parse(decoded) as Record<string, unknown>;
}

export function parseNotifyBody(raw: string): {
  resource?: {
    ciphertext: string;
    associated_data?: string;
    nonce: string;
  };
} {
  return JSON.parse(raw) as {
    resource?: {
      ciphertext: string;
      associated_data?: string;
      nonce: string;
    };
  };
}
