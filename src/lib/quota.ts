import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureDbReady, getDb } from "@/lib/db";
import { isPro, type ProEdition } from "@/lib/pro";

/** Anonymous: per browser fingerprint, UTC day. */
export const GUEST_DAILY_LIMIT = 2;

/**
 * Soft IP cap for guests — limits rotating forged fingerprints on one network.
 * Higher than GUEST_DAILY so normal NATs still get a few devices.
 */
export const GUEST_IP_DAILY_LIMIT = Math.max(
  GUEST_DAILY_LIMIT,
  Number(process.env.GUEST_IP_DAILY_LIMIT || "6") || 6
);

/** Signed-in free account: per email, UTC day. */
export const FREE_DAILY_LIMIT = 8;

/**
 * Soft IP backstop for signed-in free users.
 * Stops one network from farming many throwaway inboxes in a day.
 */
const FREE_IP_LIMIT = Math.max(
  FREE_DAILY_LIMIT,
  Number(process.env.FREE_IP_DAILY_LIMIT || "40") || 40
);

export type QuotaResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
  isPro: boolean;
  email: string | null;
  /** True when guest trials are used up — client should open sign-in */
  needsAuth: boolean;
  /** Anonymous trial (not signed in) */
  isGuest: boolean;
};

/** Identity injected by ststudio Flask proxy (CN embed). */
export type CnProxyIdentity = {
  userId: string | null;
  isPro: boolean;
};

export function clientIp(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  return "unknown";
}

/** Normalize client fingerprint from header or body. */
export function normalizeFingerprint(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const fp = raw.trim().slice(0, 128);
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(fp)) return null;
  return fp;
}

export function fingerprintFromRequest(
  req: NextRequest,
  bodyFp?: unknown
): string | null {
  return (
    normalizeFingerprint(bodyFp) ||
    normalizeFingerprint(req.headers.get("x-forge-fp"))
  );
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Validate shared secret from ststudio proxy. */
export function parseCnProxyIdentity(req: NextRequest): CnProxyIdentity | null {
  const expected = process.env.FORGE_CN_PROXY_SECRET || "";
  if (!expected) return null;
  const got = req.headers.get("x-forge-proxy-secret") || "";
  if (!got || got !== expected) return null;
  const rawId = (req.headers.get("x-forge-cn-user-id") || "").trim();
  const userId = rawId && /^[0-9]{1,12}$/.test(rawId) ? rawId : null;
  const isProHeader = (req.headers.get("x-forge-cn-pro") || "").trim();
  return {
    userId,
    isPro: isProHeader === "1" || isProHeader.toLowerCase() === "true",
  };
}

function readEmailCount(email: string, day: string): number {
  ensureDbReady();
  const row = getDb()
    .prepare("SELECT count FROM free_email_usage WHERE email = ? AND day = ?")
    .get(email, day) as { count: number } | undefined;
  return row?.count ?? 0;
}

function incrementEmailCount(email: string, day: string): number {
  ensureDbReady();
  getDb()
    .prepare(
      `
      INSERT INTO free_email_usage (email, day, count) VALUES (?, ?, 1)
      ON CONFLICT(email, day) DO UPDATE SET count = count + 1
    `
    )
    .run(email, day);
  return readEmailCount(email, day);
}

function cnUserKey(userId: string): string {
  return `stu:${userId}`;
}

function readCnUserCount(userKey: string, day: string): number {
  ensureDbReady();
  const row = getDb()
    .prepare("SELECT count FROM cn_user_usage WHERE user_key = ? AND day = ?")
    .get(userKey, day) as { count: number } | undefined;
  return row?.count ?? 0;
}

function incrementCnUserCount(userKey: string, day: string): number {
  ensureDbReady();
  getDb()
    .prepare(
      `
      INSERT INTO cn_user_usage (user_key, day, count) VALUES (?, ?, 1)
      ON CONFLICT(user_key, day) DO UPDATE SET count = count + 1
    `
    )
    .run(userKey, day);
  return readCnUserCount(userKey, day);
}

function readIpCount(ip: string, day: string): number {
  ensureDbReady();
  const row = getDb()
    .prepare("SELECT count FROM free_ip_usage WHERE ip = ? AND day = ?")
    .get(ip, day) as { count: number } | undefined;
  return row?.count ?? 0;
}

function incrementIpCount(ip: string, day: string): number {
  ensureDbReady();
  getDb()
    .prepare(
      `
      INSERT INTO free_ip_usage (ip, day, count) VALUES (?, ?, 1)
      ON CONFLICT(ip, day) DO UPDATE SET count = count + 1
    `
    )
    .run(ip, day);
  return readIpCount(ip, day);
}

function readFpCount(fp: string, day: string): number {
  ensureDbReady();
  const row = getDb()
    .prepare("SELECT count FROM free_fp_usage WHERE fp = ? AND day = ?")
    .get(fp, day) as { count: number } | undefined;
  return row?.count ?? 0;
}

function incrementFpCount(fp: string, day: string): number {
  ensureDbReady();
  getDb()
    .prepare(
      `
      INSERT INTO free_fp_usage (fp, day, count) VALUES (?, ?, 1)
      ON CONFLICT(fp, day) DO UPDATE SET count = count + 1
    `
    )
    .run(fp, day);
  return readFpCount(fp, day);
}

function guestRemaining(ip: string, fp: string | null, day: string): {
  used: number;
  remaining: number;
} {
  const ipUsed = readIpCount(ip, day);
  const ipLeft = Math.max(0, GUEST_IP_DAILY_LIMIT - ipUsed);

  if (!fp) {
    const remaining = Math.min(
      Math.max(0, GUEST_DAILY_LIMIT - ipUsed),
      ipLeft
    );
    return { used: ipUsed, remaining };
  }

  const fpUsed = readFpCount(fp, day);
  const remaining = Math.min(
    Math.max(0, GUEST_DAILY_LIMIT - fpUsed),
    ipLeft
  );
  return { used: fpUsed, remaining };
}

/** CN embed quota (ststudio user id / guest fp), no Forge email session. */
export function getCnProxyUsage(
  cn: CnProxyIdentity,
  ip = "unknown",
  fp: string | null = null
): {
  used: number;
  remaining: number;
  limit: number;
  isPro: boolean;
  email: string | null;
  needsAuth: boolean;
  isGuest: boolean;
} {
  ensureDbReady();
  const day = todayUtc();

  if (cn.isPro) {
    return {
      used: 0,
      remaining: -1,
      limit: -1,
      isPro: true,
      email: null,
      needsAuth: false,
      isGuest: false,
    };
  }

  if (!cn.userId) {
    const { used, remaining } = guestRemaining(ip, fp, day);
    return {
      used,
      remaining,
      limit: GUEST_DAILY_LIMIT,
      isPro: false,
      email: null,
      needsAuth: remaining === 0,
      isGuest: true,
    };
  }

  const key = cnUserKey(cn.userId);
  const used = readCnUserCount(key, day);
  const ipUsed = readIpCount(ip, day);
  const remaining = Math.max(
    0,
    Math.min(FREE_DAILY_LIMIT - used, FREE_IP_LIMIT - ipUsed)
  );

  return {
    used,
    remaining,
    limit: FREE_DAILY_LIMIT,
    isPro: false,
    email: null,
    needsAuth: false,
    isGuest: false,
  };
}

export function checkCnProxyQuota(
  cn: CnProxyIdentity,
  ip = "unknown",
  fp: string | null = null
): QuotaResult {
  const usage = getCnProxyUsage(cn, ip, fp);
  if (usage.isPro) {
    return {
      allowed: true,
      remaining: -1,
      limit: -1,
      isPro: true,
      email: null,
      needsAuth: false,
      isGuest: false,
    };
  }
  if (usage.isGuest) {
    return {
      allowed: usage.remaining > 0,
      remaining: usage.remaining,
      limit: GUEST_DAILY_LIMIT,
      isPro: false,
      email: null,
      needsAuth: usage.remaining === 0,
      isGuest: true,
    };
  }
  return {
    allowed: usage.remaining > 0,
    remaining: usage.remaining,
    limit: FREE_DAILY_LIMIT,
    isPro: false,
    email: null,
    needsAuth: false,
    isGuest: false,
  };
}

export function incrementCnProxyQuota(
  cn: CnProxyIdentity,
  ip = "unknown",
  fp: string | null = null
): QuotaResult {
  const before = checkCnProxyQuota(cn, ip, fp);
  if (!before.allowed || before.isPro) return before;

  const day = todayUtc();

  if (before.isGuest) {
    const nextIp = incrementIpCount(ip, day);
    const nextFp = fp ? incrementFpCount(fp, day) : nextIp;
    const remaining = Math.min(
      fp
        ? Math.max(0, GUEST_DAILY_LIMIT - nextFp)
        : Math.max(0, GUEST_DAILY_LIMIT - nextIp),
      Math.max(0, GUEST_IP_DAILY_LIMIT - nextIp)
    );
    return {
      allowed: true,
      remaining,
      limit: GUEST_DAILY_LIMIT,
      isPro: false,
      email: null,
      needsAuth: remaining === 0,
      isGuest: true,
    };
  }

  if (!cn.userId) return before;

  const nextUser = incrementCnUserCount(cnUserKey(cn.userId), day);
  const nextIp = incrementIpCount(ip, day);
  const remaining = Math.max(
    0,
    Math.min(FREE_DAILY_LIMIT - nextUser, FREE_IP_LIMIT - nextIp)
  );

  return {
    allowed: true,
    remaining,
    limit: FREE_DAILY_LIMIT,
    isPro: false,
    email: null,
    needsAuth: false,
    isGuest: false,
  };
}

/** Get current usage info (no side effects). */
export async function getUsage(
  ip = "unknown",
  fp: string | null = null,
  edition: ProEdition = "global"
): Promise<{
  used: number;
  remaining: number;
  limit: number;
  isPro: boolean;
  email: string | null;
  needsAuth: boolean;
  isGuest: boolean;
}> {
  ensureDbReady();
  const session = await getSession();
  const email = session?.email ? normalizeEmail(session.email) : null;
  const day = todayUtc();

  if (!email) {
    const { used, remaining } = guestRemaining(ip, fp, day);
    return {
      used,
      remaining,
      limit: GUEST_DAILY_LIMIT,
      isPro: false,
      email: null,
      needsAuth: remaining === 0,
      isGuest: true,
    };
  }

  if (await isPro(edition)) {
    return {
      used: 0,
      remaining: -1,
      limit: -1,
      isPro: true,
      email,
      needsAuth: false,
      isGuest: false,
    };
  }

  const used = readEmailCount(email, day);
  const ipUsed = readIpCount(ip, day);
  const remaining = Math.max(
    0,
    Math.min(FREE_DAILY_LIMIT - used, FREE_IP_LIMIT - ipUsed)
  );

  return {
    used,
    remaining,
    limit: FREE_DAILY_LIMIT,
    isPro: false,
    email,
    needsAuth: false,
    isGuest: false,
  };
}

export async function checkQuota(
  ip = "unknown",
  fp: string | null = null,
  edition: ProEdition = "global"
): Promise<QuotaResult> {
  const usage = await getUsage(ip, fp, edition);
  if (usage.isPro) {
    return {
      allowed: true,
      remaining: -1,
      limit: -1,
      isPro: true,
      email: usage.email,
      needsAuth: false,
      isGuest: false,
    };
  }
  if (usage.isGuest) {
    return {
      allowed: usage.remaining > 0,
      remaining: usage.remaining,
      limit: GUEST_DAILY_LIMIT,
      isPro: false,
      email: null,
      needsAuth: usage.remaining === 0,
      isGuest: true,
    };
  }
  return {
    allowed: usage.remaining > 0,
    remaining: usage.remaining,
    limit: FREE_DAILY_LIMIT,
    isPro: false,
    email: usage.email,
    needsAuth: false,
    isGuest: false,
  };
}

/** Increment usage after a successful free (guest or signed-in) generation. */
export async function checkAndIncrement(
  ip = "unknown",
  fp: string | null = null,
  edition: ProEdition = "global"
): Promise<QuotaResult> {
  const before = await checkQuota(ip, fp, edition);
  if (!before.allowed) {
    return before;
  }
  if (before.isPro) {
    return before;
  }

  const day = todayUtc();

  if (before.isGuest) {
    const nextIp = incrementIpCount(ip, day);
    const nextFp = fp ? incrementFpCount(fp, day) : nextIp;
    const remaining = Math.min(
      fp
        ? Math.max(0, GUEST_DAILY_LIMIT - nextFp)
        : Math.max(0, GUEST_DAILY_LIMIT - nextIp),
      Math.max(0, GUEST_IP_DAILY_LIMIT - nextIp)
    );
    return {
      allowed: true,
      remaining,
      limit: GUEST_DAILY_LIMIT,
      isPro: false,
      email: null,
      needsAuth: remaining === 0,
      isGuest: true,
    };
  }

  if (!before.email) {
    return before;
  }

  const nextEmail = incrementEmailCount(before.email, day);
  const nextIp = incrementIpCount(ip, day);
  const remaining = Math.max(
    0,
    Math.min(FREE_DAILY_LIMIT - nextEmail, FREE_IP_LIMIT - nextIp)
  );

  return {
    allowed: true,
    remaining,
    limit: FREE_DAILY_LIMIT,
    isPro: false,
    email: before.email,
    needsAuth: false,
    isGuest: false,
  };
}
