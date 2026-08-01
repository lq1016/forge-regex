import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { clearProCookie } from "@/lib/pro";

/** POST /api/auth/logout */
export async function POST() {
  await clearSession();
  await clearProCookie();
  return NextResponse.json({ ok: true });
}
