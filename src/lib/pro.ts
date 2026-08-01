import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

const SECRET = new TextEncoder().encode(
  process.env.QUOTA_SECRET || "forge-regex-default-secret-change-in-prod"
);

const COOKIE_NAME = "forge-pro";

export type ProStatus = "active" | "canceled" | "past_due" | "paused" | "none";

/** Site edition: CN WeChat/Alipay vs global Paddle — entitlements do not cross. */
export type ProEdition = "cn" | "global";

export type SubscriptionRecord = {
  customerId: string;
  subscriptionId?: string;
  email?: string;
  status: ProStatus;
  currentPeriodEnd?: string;
  updatedAt: string;
};

type ProCookiePayload = {
  cid: string;
  status: ProStatus;
  email?: string;
};

type SubscriptionRow = {
  customer_id: string;
  subscription_id: string | null;
  email: string | null;
  status: string;
  current_period_end: string | null;
  updated_at: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function rowToRecord(row: SubscriptionRow): SubscriptionRecord {
  return {
    customerId: row.customer_id,
    subscriptionId: row.subscription_id ?? undefined,
    email: row.email ?? undefined,
    status: row.status as ProStatus,
    currentPeriodEnd: row.current_period_end ?? undefined,
    updatedAt: row.updated_at,
  };
}


export function isCnCustomerId(customerId: string): boolean {
  return customerId.startsWith("cn:");
}

export function subscriptionMatchesEdition(
  customerId: string,
  edition: ProEdition
): boolean {
  const cn = isCnCustomerId(customerId);
  return edition === "cn" ? cn : !cn;
}

export function parseProEdition(raw: string | null | undefined): ProEdition {
  return raw === "cn" ? "cn" : "global";
}

/** Resolve edition from header, query, or Referer path (/cn…). */
/**
 * Resolve site edition for Pro checks.
 * Prefer Referer path so clients cannot unlock CN Pro from the English site
 * by spoofing X-Forge-Edition.
 */
export function resolveProEdition(req: {
  url: string;
  headers: { get(name: string): string | null };
}): ProEdition {
  const ref = req.headers.get("referer") || req.headers.get("referrer") || "";
  try {
    const path = new URL(ref).pathname;
    if (path === "/cn" || path.startsWith("/cn/")) return "cn";
    // Same-site non-/cn page → always global (ignore spoofed cn header)
    if (path) return "global";
  } catch {
    // ignore
  }

  // No referer (curl / some clients): only honor explicit global; default global.
  // Never grant cn without a /cn referer.
  return "global";
}

export function isRecordProActive(record: SubscriptionRecord): boolean {
  if (record.status !== "active") return false;
  if (!record.currentPeriodEnd) return true;
  return Date.parse(record.currentPeriodEnd) > Date.now();
}

export async function upsertSubscription(
  record: Omit<SubscriptionRecord, "updatedAt"> & { updatedAt?: string }
): Promise<SubscriptionRecord> {
  const next: SubscriptionRecord = {
    ...record,
    email: record.email ? normalizeEmail(record.email) : undefined,
    updatedAt: record.updatedAt ?? new Date().toISOString(),
  };

  const database = getDb();
  database
    .prepare(
      `
      INSERT INTO subscriptions (
        customer_id, subscription_id, email, status, current_period_end, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(customer_id) DO UPDATE SET
        subscription_id = COALESCE(excluded.subscription_id, subscriptions.subscription_id),
        email = COALESCE(excluded.email, subscriptions.email),
        status = excluded.status,
        current_period_end = COALESCE(excluded.current_period_end, subscriptions.current_period_end),
        updated_at = excluded.updated_at
    `
    )
    .run(
      next.customerId,
      next.subscriptionId ?? null,
      next.email ?? null,
      next.status,
      next.currentPeriodEnd ?? null,
      next.updatedAt
    );

  return next;
}

/**
 * CN Pro billing unit: one purchase ≈ one calendar month.
 * Use a fixed 31 days so short months still get a full "month" of access.
 */
export const CN_PRO_MONTH_DAYS = 31;

/** Grant or stack one CN Pro month (+31 days) for a WeChat/Alipay payer email. */
export async function extendProByMonth(
  email: string
): Promise<SubscriptionRecord> {
  return extendProByDays(email, CN_PRO_MONTH_DAYS);
}

/** Grant or stack +N days of Pro for a CN (WeChat/Alipay) payer email. */
export async function extendProByDays(
  email: string,
  days: number
): Promise<SubscriptionRecord> {
  const normalized = normalizeEmail(email);
  const customerId = `cn:${normalized}`;
  const existing = await getSubscriptionByCustomer(customerId);
  const now = Date.now();
  let base = now;
  if (
    existing &&
    existing.status === "active" &&
    existing.currentPeriodEnd &&
    Date.parse(existing.currentPeriodEnd) > now
  ) {
    base = Date.parse(existing.currentPeriodEnd);
  }
  const end = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
  return upsertSubscription({
    customerId,
    email: normalized,
    status: "active",
    currentPeriodEnd: end,
    subscriptionId: existing?.subscriptionId,
  });
}

export async function getSubscriptionByCustomer(
  customerId: string
): Promise<SubscriptionRecord | null> {
  const row = getDb()
    .prepare("SELECT * FROM subscriptions WHERE customer_id = ?")
    .get(customerId) as SubscriptionRow | undefined;
  return row ? rowToRecord(row) : null;
}

export async function getSubscriptionById(
  subscriptionId: string
): Promise<SubscriptionRecord | null> {
  const row = getDb()
    .prepare("SELECT * FROM subscriptions WHERE subscription_id = ?")
    .get(subscriptionId) as SubscriptionRow | undefined;
  return row ? rowToRecord(row) : null;
}

export async function getSubscriptionByEmail(
  email: string
): Promise<SubscriptionRecord | null> {
  const normalized = normalizeEmail(email);
  const row = getDb()
    .prepare(
      `
      SELECT * FROM subscriptions
      WHERE email = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `
    )
    .get(normalized) as SubscriptionRow | undefined;
  return row ? rowToRecord(row) : null;
}

function subscriptionsForEmail(email: string): SubscriptionRecord[] {
  const normalized = normalizeEmail(email);
  const rows = getDb()
    .prepare("SELECT * FROM subscriptions WHERE email = ?")
    .all(normalized) as SubscriptionRow[];
  return rows.map(rowToRecord);
}

export function getActiveSubscriptionForEdition(
  email: string,
  edition: ProEdition
): SubscriptionRecord | null {
  const matches = subscriptionsForEmail(email).filter(
    (r) =>
      subscriptionMatchesEdition(r.customerId, edition) && isRecordProActive(r)
  );
  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    const ae = a.currentPeriodEnd ? Date.parse(a.currentPeriodEnd) : Infinity;
    const be = b.currentPeriodEnd ? Date.parse(b.currentPeriodEnd) : Infinity;
    return be - ae;
  });
  return matches[0];
}

function emailHasActivePro(email: string, edition: ProEdition): boolean {
  return getActiveSubscriptionForEdition(email, edition) !== null;
}

/** Latest Pro expiry for this email on a given edition. */
export function getProExpiresAt(
  email: string,
  edition: ProEdition = "global"
): string | null {
  const active = getActiveSubscriptionForEdition(email, edition);
  if (!active) return null;
  return active.currentPeriodEnd ?? null;
}

export async function setProCookie(
  payload: ProCookiePayload
): Promise<void> {
  const cookieStore = await cookies();
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("400d")
    .sign(SECRET);

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 34_560_000,
    path: "/",
  });
}

export async function clearProCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function readProCookie(): Promise<ProCookiePayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify<ProCookiePayload>(raw, SECRET);
    if (!payload.cid || !payload.status) return null;
    return {
      cid: payload.cid,
      status: payload.status,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

/**
 * Pro for a site edition only:
 * - cn: WeChat/Alipay rows (`cn:email`)
 * - global: Paddle / other non-cn rows
 */
export async function isPro(edition: ProEdition = "global"): Promise<boolean> {
  const session = await getSession();
  if (session?.email) {
    if (emailHasActivePro(session.email, edition)) return true;
  }

  const cookie = await readProCookie();
  if (!cookie) return false;
  if (cookie.status !== "active") return false;
  if (!subscriptionMatchesEdition(cookie.cid, edition)) return false;

  const record = await getSubscriptionByCustomer(cookie.cid);
  if (!record) return true;
  return isRecordProActive(record);
}

export function cnPriceYuan(): number {
  const n = Number(process.env.CN_PRICE_CNY || process.env.NEXT_PUBLIC_CN_PRICE_CNY || "9.9");
  return Number.isFinite(n) && n > 0 ? n : 9.9;
}

export function cnPriceFen(): number {
  return Math.round(cnPriceYuan() * 100);
}
