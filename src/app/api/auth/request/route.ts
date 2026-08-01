import { NextResponse } from "next/server";

/** Magic-link request removed — use /api/auth/login or /api/auth/register. */
export async function POST() {
  return NextResponse.json(
    {
      error: "Magic link sign-in is disabled. Use email and password.",
      code: "auth_method_changed",
    },
    { status: 410 }
  );
}
