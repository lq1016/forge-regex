import { NextResponse } from "next/server";
import { getUsage } from "@/lib/quota";

/**
 * GET /api/quota — check remaining usage from cookie.
 */
export async function GET() {
  const usage = await getUsage();
  return NextResponse.json(usage);
}
