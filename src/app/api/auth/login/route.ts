import { NextRequest, NextResponse } from "next/server";
import {
  finishLogin,
  getUserByEmail,
  isValidEmail,
  verifyPassword,
} from "@/lib/auth-api";

/** POST /api/auth/login */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const locale: "en" | "zh" = body?.locale === "zh" ? "zh" : "en";

    const generic =
      locale === "zh" ? "邮箱或密码不正确。" : "Incorrect email or password.";

    if (!isValidEmail(email) || !password) {
      return NextResponse.json({ error: generic }, { status: 400 });
    }

    const user = getUserByEmail(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: generic }, { status: 401 });
    }

    const session = await finishLogin(user.email);
    return NextResponse.json({ ok: true, ...session });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
