import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProExpiresAt, isPro, resolveProEdition } from "@/lib/pro";
import type { NextRequest } from "next/server";

/** GET /api/auth/me */
export async function GET(req: NextRequest) {
  const edition = resolveProEdition(req);
  const session = await getSession();
  if (!session) {
    return NextResponse.json({
      email: null,
      isPro: false,
      proExpiresAt: null,
      edition,
    });
  }
  const pro = await isPro(edition);
  return NextResponse.json({
    email: session.email,
    isPro: pro,
    proExpiresAt: pro ? getProExpiresAt(session.email, edition) : null,
    edition,
  });
}
