import {
  createHash,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { ensureDbReady, getDb } from "@/lib/db";

const SECRET = new TextEncoder().encode(
  process.env.QUOTA_SECRET || "forge-regex-default-secret-change-in-prod"
);

const SESSION_COOKIE = "forge-session";

export type SessionUser = {
  email: string;
};

export type AuthCodePurpose = "register" | "reset";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashSha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidPassword(password: string): boolean {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

/** scrypt hash: saltHex:hashHex */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const next = scryptSync(password, salt, 64);
    const prev = Buffer.from(hash, "hex");
    if (prev.length !== next.length) return false;
    return timingSafeEqual(prev, next);
  } catch {
    return false;
  }
}

export async function setSession(user: SessionUser): Promise<void> {
  const email = normalizeEmail(user.email);
  const cookieStore = await cookies();
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("180d")
    .sign(SECRET);

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15_552_000,
    path: "/",
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify<{ email?: string }>(raw, SECRET);
    if (!payload.email || !isValidEmail(payload.email)) return null;
    return { email: normalizeEmail(payload.email) };
  } catch {
    return null;
  }
}

export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function getUserByEmail(email: string): {
  email: string;
  password_hash: string;
} | null {
  ensureDbReady();
  const row = getDb()
    .prepare("SELECT email, password_hash FROM users WHERE email = ?")
    .get(normalizeEmail(email)) as
    | { email: string; password_hash: string }
    | undefined;
  return row ?? null;
}

export function createUser(email: string, passwordHash: string): void {
  ensureDbReady();
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `
      INSERT INTO users (email, password_hash, email_verified_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `
    )
    .run(normalizeEmail(email), passwordHash, now, now, now);
}

export function updateUserPassword(email: string, passwordHash: string): void {
  ensureDbReady();
  getDb()
    .prepare(
      `
      UPDATE users SET password_hash = ?, updated_at = ?
      WHERE email = ?
    `
    )
    .run(passwordHash, new Date().toISOString(), normalizeEmail(email));
}

function purgeExpiredCodes(): void {
  ensureDbReady();
  getDb()
    .prepare("DELETE FROM auth_codes WHERE expires_at < ?")
    .run(new Date().toISOString());
}

/** Create 6-digit code. Returns plaintext code for emailing. */
export function createAuthCode(input: {
  email: string;
  purpose: AuthCodePurpose;
  meta?: { passwordHash?: string };
}): string {
  ensureDbReady();
  purgeExpiredCodes();
  const email = normalizeEmail(input.email);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = getDb()
    .prepare(
      `
      SELECT COUNT(*) AS c FROM auth_codes
      WHERE email = ? AND purpose = ? AND created_at > ?
    `
    )
    .get(email, input.purpose, hourAgo) as { c: number };
  if (recent.c >= 5) {
    throw new Error("Too many codes sent. Try again later.");
  }

  // Invalidate previous codes for same purpose
  getDb()
    .prepare("DELETE FROM auth_codes WHERE email = ? AND purpose = ?")
    .run(email, input.purpose);

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = new Date();
  const expires = new Date(now.getTime() + 10 * 60 * 1000);
  getDb()
    .prepare(
      `
      INSERT INTO auth_codes (
        id, email, purpose, code_hash, expires_at, created_at, attempts, meta
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `
    )
    .run(
      randomBytes(12).toString("hex"),
      email,
      input.purpose,
      hashSha256(code),
      expires.toISOString(),
      now.toISOString(),
      input.meta ? JSON.stringify(input.meta) : null
    );
  return code;
}

export type ConsumeCodeResult =
  | { ok: true; email: string; meta: { passwordHash?: string } | null }
  | { ok: false; reason: "invalid" | "expired" | "locked" };

export function consumeAuthCode(input: {
  email: string;
  purpose: AuthCodePurpose;
  code: string;
}): ConsumeCodeResult {
  ensureDbReady();
  purgeExpiredCodes();
  const email = normalizeEmail(input.email);
  const code = input.code.trim();
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: "invalid" };

  const row = getDb()
    .prepare(
      `
      SELECT id, code_hash, expires_at, attempts, meta
      FROM auth_codes
      WHERE email = ? AND purpose = ?
      ORDER BY created_at DESC
      LIMIT 1
    `
    )
    .get(email, input.purpose) as
    | {
        id: string;
        code_hash: string;
        expires_at: string;
        attempts: number;
        meta: string | null;
      }
    | undefined;

  if (!row) return { ok: false, reason: "invalid" };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    getDb().prepare("DELETE FROM auth_codes WHERE id = ?").run(row.id);
    return { ok: false, reason: "expired" };
  }
  if (row.attempts >= 5) return { ok: false, reason: "locked" };

  const match = (() => {
    try {
      const a = Buffer.from(hashSha256(code), "hex");
      const b = Buffer.from(row.code_hash, "hex");
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  })();
  if (!match) {
    getDb()
      .prepare("UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ?")
      .run(row.id);
    return { ok: false, reason: "invalid" };
  }

  getDb().prepare("DELETE FROM auth_codes WHERE id = ?").run(row.id);
  let meta: { passwordHash?: string } | null = null;
  if (row.meta) {
    try {
      meta = JSON.parse(row.meta) as { passwordHash?: string };
    } catch {
      meta = null;
    }
  }
  return { ok: true, email, meta };
}

export function deleteAuthCodes(email: string, purpose: AuthCodePurpose): void {
  ensureDbReady();
  getDb()
    .prepare("DELETE FROM auth_codes WHERE email = ? AND purpose = ?")
    .run(normalizeEmail(email), purpose);
}

/** Expose code in API only outside production (or AUTH_DEV_CODE=1). */
export function shouldExposeDevCode(): boolean {
  if (process.env.AUTH_DEV_CODE === "1") return true;
  return process.env.NODE_ENV !== "production";
}
