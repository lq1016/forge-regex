import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(
  process.env.QUOTA_SECRET || "forge-regex-default-secret-change-in-prod"
);

const COOKIE_NAME = "forge-usage";
const FREE_LIMIT = 5;

type UsagePayload = {
  /** date string YYYY-MM-DD */
  d: string;
  /** usage count */
  c: number;
};

/**
 * Read usage from the signed cookie (or return fresh for today).
 */
async function readUsage(): Promise<UsagePayload> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  const today = new Date().toISOString().slice(0, 10);

  if (raw) {
    try {
      const { payload } = await jwtVerify<UsagePayload>(raw, SECRET);
      if (payload.d === today) return payload;
    } catch {
      // invalid / tampered token — treat as fresh
    }
  }
  return { d: today, c: 0 };
}

/**
 * Write usage to a signed cookie.
 */
async function writeUsage(payload: UsagePayload): Promise<void> {
  const cookieStore = await cookies();
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(SECRET);

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 86_400, // 24h
    path: "/",
  });
}

/** Get current usage info (no side effects). */
export async function getUsage(): Promise<{
  used: number;
  remaining: number;
  limit: number;
}> {
  const p = await readUsage();
  return { used: p.c, remaining: Math.max(0, FREE_LIMIT - p.c), limit: FREE_LIMIT };
}

/** Check quota and increment if allowed. */
export async function checkAndIncrement(): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
}> {
  const p = await readUsage();

  if (p.c >= FREE_LIMIT) {
    return { allowed: false, remaining: 0, limit: FREE_LIMIT };
  }

  const next: UsagePayload = { ...p, c: p.c + 1 };
  await writeUsage(next);

  return {
    allowed: true,
    remaining: FREE_LIMIT - next.c,
    limit: FREE_LIMIT,
  };
}
