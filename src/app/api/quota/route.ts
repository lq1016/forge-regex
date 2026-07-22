import { NextRequest, NextResponse } from "next/server";
import { getUsage, checkAndIncrement } from "@/lib/quota";
import { createHash } from "crypto";

/**
 * Simple IP hash from the request (X-Forwarded-For or remote address).
 */
function getIpHash(req: NextRequest): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

/**
 * GET /api/quota — check remaining usage.
 */
export async function GET(req: NextRequest) {
  const ipHash = getIpHash(req);
  const usage = await getUsage(ipHash);
  return NextResponse.json(usage);
}

/**
 * POST /api/quota — check and increment usage (called before generate).
 */
export async function POST(req: NextRequest) {
  const ipHash = getIpHash(req);
  const result = await checkAndIncrement(ipHash);

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: "Daily free limit reached. Upgrade to unlimited.",
        remaining: 0,
        limit: result.limit,
      },
      { status: 429 }
    );
  }

  return NextResponse.json({
    allowed: true,
    remaining: result.remaining,
    limit: result.limit,
  });
}
