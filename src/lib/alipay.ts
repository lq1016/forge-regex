/**
 * Alipay OpenAPI — computer website pay (alipay.trade.page.pay) with RSA2.
 * Also keeps order-code precreate helpers for optional QR product.
 */
import {
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  type KeyObject,
} from "crypto";
import { existsSync, readFileSync } from "fs";

const GATEWAY =
  process.env.ALIPAY_GATEWAY || "https://openapi.alipay.com/gateway.do";

export function isAlipayMock(): boolean {
  return (
    process.env.ALIPAY_PAY_MOCK === "1" || process.env.ALIPAY_PAY_MOCK === "true"
  );
}

function readKeyMaterial(
  inlineEnv: string | undefined,
  pathEnv: string | undefined
): string | null {
  const inline = inlineEnv?.replace(/\\n/g, "\n").trim();
  if (inline && inline.length > 32) return inline;
  const path = pathEnv?.trim();
  if (path && existsSync(path)) return readFileSync(path, "utf8").trim();
  return null;
}

function wrapPem(raw: string, kind: "private" | "public"): string {
  if (raw.includes("BEGIN")) return raw;
  const body = raw.replace(/\s+/g, "");
  const lines = body.match(/.{1,64}/g)?.join("\n") ?? body;
  if (kind === "private") {
    // Alipay keygen usually outputs PKCS#8
    return `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----`;
  }
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`;
}

function privateKeyObject(): KeyObject {
  const raw = readKeyMaterial(
    process.env.ALIPAY_PRIVATE_KEY,
    process.env.ALIPAY_PRIVATE_KEY_PATH
  );
  if (!raw) throw new Error("Alipay private key missing");
  const pem = wrapPem(raw, "private");
  try {
    return createPrivateKey(pem);
  } catch {
    // Some tools emit PKCS#1
    const pkcs1 = pem
      .replace("BEGIN PRIVATE KEY", "BEGIN RSA PRIVATE KEY")
      .replace("END PRIVATE KEY", "END RSA PRIVATE KEY");
    return createPrivateKey(pkcs1);
  }
}

function alipayPublicKeyObject(): KeyObject {
  const raw = readKeyMaterial(
    process.env.ALIPAY_PUBLIC_KEY,
    process.env.ALIPAY_PUBLIC_KEY_PATH
  );
  if (!raw) throw new Error("Alipay public key missing");
  return createPublicKey(wrapPem(raw, "public"));
}

export function isAlipayConfigured(): boolean {
  if (isAlipayMock()) return false;
  return Boolean(
    process.env.ALIPAY_APP_ID &&
      readKeyMaterial(
        process.env.ALIPAY_PRIVATE_KEY,
        process.env.ALIPAY_PRIVATE_KEY_PATH
      ) &&
      readKeyMaterial(
        process.env.ALIPAY_PUBLIC_KEY,
        process.env.ALIPAY_PUBLIC_KEY_PATH
      )
  );
}

/** Content to sign for merchant→Alipay requests (includes sign_type). */
function signContent(params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .filter((k) => k !== "sign" && params[k] !== undefined && params[k] !== "")
    .sort();
  return sorted.map((k) => `${k}=${params[k]}`).join("&");
}

/**
 * Content for verifying Alipay→merchant notifies/responses.
 * Official rule: exclude both `sign` and `sign_type`.
 */
function verifyContent(params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .filter(
      (k) =>
        k !== "sign" &&
        k !== "sign_type" &&
        params[k] !== undefined &&
        params[k] !== ""
    )
    .sort();
  return sorted.map((k) => `${k}=${params[k]}`).join("&");
}

export function signAlipayParams(params: Record<string, string>): string {
  const content = signContent(params);
  const signer = createSign("RSA-SHA256");
  signer.update(content, "utf8");
  return signer.sign(privateKeyObject(), "base64");
}

export function verifyAlipayParams(params: Record<string, string>): boolean {
  const sign = params.sign;
  if (!sign) return false;
  const content = verifyContent(params);
  const verifier = createVerify("RSA-SHA256");
  verifier.update(content, "utf8");
  try {
    return verifier.verify(alipayPublicKeyObject(), sign, "base64");
  } catch {
    return false;
  }
}

function formatTimestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  // Alipay expects Asia/Shanghai wall time; server is CN so local is fine,
  // but format explicitly as YYYY-MM-DD HH:mm:ss
  const offset = 8 * 60;
  const utc = d.getTime() + d.getTimezoneOffset() * 60_000;
  const cn = new Date(utc + offset * 60_000);
  return (
    `${cn.getUTCFullYear()}-${pad(cn.getUTCMonth() + 1)}-${pad(cn.getUTCDate())} ` +
    `${pad(cn.getUTCHours())}:${pad(cn.getUTCMinutes())}:${pad(cn.getUTCSeconds())}`
  );
}

function buildGatewayParams(input: {
  method: string;
  biz: Record<string, string>;
  notifyUrl: string;
  returnUrl?: string;
}): Record<string, string> {
  const params: Record<string, string> = {
    app_id: process.env.ALIPAY_APP_ID!,
    method: input.method,
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: formatTimestamp(),
    version: "1.0",
    notify_url: input.notifyUrl,
    biz_content: JSON.stringify(input.biz),
  };
  if (input.returnUrl) params.return_url = input.returnUrl;
  params.sign = signAlipayParams(params);
  return params;
}

/** Escape for HTML attribute values in Alipay auto-submit form. */
function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Official page.pay flow: browser POSTs a form to the gateway
 * (avoids GET query encoding issues that often show as SYSTEM_ERROR).
 */
export function createAlipayPagePay(input: {
  outTradeNo: string;
  subject: string;
  totalYuan: string;
  notifyUrl: string;
  returnUrl: string;
}): { payUrl: string; payFormHtml: string; params: Record<string, string> } {
  if (isAlipayMock()) {
    const payUrl = `${input.returnUrl}${input.returnUrl.includes("?") ? "&" : "?"}orderId=${encodeURIComponent(input.outTradeNo)}&alipay_mock=1`;
    return {
      payUrl,
      payFormHtml: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>mock</title></head><body><script>location.href=${JSON.stringify(payUrl)}</script></body></html>`,
      params: {},
    };
  }
  if (!isAlipayConfigured()) {
    throw new Error("Alipay not configured");
  }

  const params = buildGatewayParams({
    method: "alipay.trade.page.pay",
    notifyUrl: input.notifyUrl,
    returnUrl: input.returnUrl,
    biz: {
      out_trade_no: input.outTradeNo,
      product_code: "FAST_INSTANT_TRADE_PAY",
      total_amount: input.totalYuan,
      subject: input.subject,
    },
  });

  const inputs = Object.keys(params)
    .map(
      (k) =>
        `<input type="hidden" name="${escapeHtmlAttr(k)}" value="${escapeHtmlAttr(params[k])}" />`
    )
    .join("");

  const payFormHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>正在跳转支付宝…</title></head>
<body>
<form id="alipaysubmit" name="alipaysubmit" action="${GATEWAY}?charset=utf-8" method="POST">
${inputs}
</form>
<script>document.forms.alipaysubmit.submit();</script>
</body>
</html>`;

  // Keep GET URL for debugging; cashier should prefer POST form.
  const qs = Object.keys(params)
    .map(
      (k) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(params[k]).replace(/%20/g, "+")}`
    )
    .join("&");
  return {
    payUrl: `${GATEWAY}?${qs}`,
    payFormHtml,
    params,
  };
}

/** Order-code / face-to-face QR (alipay.trade.precreate). */
export async function createAlipayQrPrepay(input: {
  outTradeNo: string;
  subject: string;
  totalYuan: string;
  notifyUrl: string;
}): Promise<{ qrCode: string }> {
  if (isAlipayMock()) {
    return {
      qrCode: `https://regex.ststudio.top/cn/pricing?mock_alipay=${encodeURIComponent(input.outTradeNo)}`,
    };
  }
  if (!isAlipayConfigured()) {
    throw new Error("Alipay not configured");
  }

  const params = buildGatewayParams({
    method: "alipay.trade.precreate",
    notifyUrl: input.notifyUrl,
    biz: {
      out_trade_no: input.outTradeNo,
      total_amount: input.totalYuan,
      subject: input.subject,
      product_code: "FACE_TO_FACE_PAYMENT",
    },
  });

  const body = new URLSearchParams(params);
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body,
  });
  const text = await res.text();
  let json: {
    alipay_trade_precreate_response?: {
      code?: string;
      msg?: string;
      sub_code?: string;
      sub_msg?: string;
      qr_code?: string;
    };
  };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error(`Alipay bad response: ${text.slice(0, 200)}`);
  }

  const resp = json.alipay_trade_precreate_response;
  if (!resp || resp.code !== "10000" || !resp.qr_code) {
    const detail = [
      resp?.sub_code,
      resp?.sub_msg || resp?.msg,
      resp?.code ? `code=${resp.code}` : null,
    ]
      .filter(Boolean)
      .join(" — ");
    throw new Error(
      `Alipay precreate failed: ${detail || text.slice(0, 200)}`
    );
  }
  return { qrCode: resp.qr_code };
}

/** @deprecated use createAlipayPagePay */
export function createAlipayPrepay(input: {
  outTradeNo: string;
  subject: string;
  totalYuan: string;
  notifyUrl: string;
  returnUrl?: string;
}): { payUrl: string } {
  return createAlipayPagePay({
    ...input,
    returnUrl:
      input.returnUrl ||
      "https://regex.ststudio.top/cn/pricing",
  });
}

export function parseAlipayNotify(raw: string): Record<string, string> {
  const params = new URLSearchParams(raw);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

export type AlipayTradeQueryResult = {
  tradeStatus: string;
  tradeNo?: string;
  outTradeNo: string;
  raw: Record<string, unknown>;
};

/** Query trade status (fallback when async notify fails). */
export async function queryAlipayTrade(
  outTradeNo: string
): Promise<AlipayTradeQueryResult | null> {
  if (isAlipayMock() || !isAlipayConfigured()) return null;

  const params = buildGatewayParams({
    method: "alipay.trade.query",
    notifyUrl: process.env.ALIPAY_NOTIFY_URL || "https://regex.ststudio.top/api/pay/alipay/notify",
    biz: { out_trade_no: outTradeNo },
  });
  // trade.query does not need notify_url
  delete params.notify_url;
  params.sign = signAlipayParams(params);

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams(params),
  });
  const text = await res.text();
  let json: {
    sign?: string;
    alipay_trade_query_response?: {
      code?: string;
      msg?: string;
      sub_code?: string;
      sub_msg?: string;
      trade_status?: string;
      trade_no?: string;
      out_trade_no?: string;
    };
  };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    console.error("[alipay/query] bad json", text.slice(0, 200));
    return null;
  }

  const resp = json.alipay_trade_query_response;
  if (!resp || resp.code !== "10000") {
    console.error(
      "[alipay/query]",
      resp?.sub_code || resp?.code,
      resp?.sub_msg || resp?.msg || text.slice(0, 200)
    );
    return null;
  }

  return {
    tradeStatus: resp.trade_status || "",
    tradeNo: resp.trade_no,
    outTradeNo: resp.out_trade_no || outTradeNo,
    raw: resp as Record<string, unknown>,
  };
}
