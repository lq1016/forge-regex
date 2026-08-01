import { NextResponse } from "next/server";

/** Magic-link verify removed — use password login / verify-register. */
export async function POST() {
  return NextResponse.json(
    {
      error: "Magic link sign-in is disabled. Use email and password.",
      code: "auth_method_changed",
    },
    { status: 410 }
  );
}
