import { NextRequest, NextResponse } from "next/server";
import {
  consumeAuthCode,
  finishLogin,
  getUserByEmail,
  hashPassword,
  isValidEmail,
  isValidPassword,
  updateUserPassword,
} from "@/lib/auth-api";

/** POST /api/auth/reset — confirm reset code and set new password. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const locale: "en" | "zh" = body?.locale === "zh" ? "zh" : "en";

    if (!isValidEmail(email) || !code) {
      return NextResponse.json({ error: "Email and code required" }, { status: 400 });
    }
    if (!isValidPassword(password)) {
      return NextResponse.json(
        {
          error:
            locale === "zh"
              ? "密码至少 8 位。"
              : "Password must be at least 8 characters.",
        },
        { status: 400 }
      );
    }
    if (!getUserByEmail(email)) {
      return NextResponse.json(
        {
          error:
            locale === "zh" ? "验证码不正确。" : "Invalid verification code.",
        },
        { status: 400 }
      );
    }

    const result = consumeAuthCode({ email, purpose: "reset", code });
    if (!result.ok) {
      const msg =
        result.reason === "expired"
          ? locale === "zh"
            ? "验证码已过期，请重新获取。"
            : "Code expired. Request a new one."
          : result.reason === "locked"
            ? locale === "zh"
              ? "尝试次数过多，请重新获取验证码。"
              : "Too many attempts. Request a new code."
            : locale === "zh"
              ? "验证码不正确。"
              : "Invalid verification code.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    updateUserPassword(email, hashPassword(password));
    const session = await finishLogin(email);
    return NextResponse.json({ ok: true, ...session });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Reset failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
