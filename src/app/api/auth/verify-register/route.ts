import { NextRequest, NextResponse } from "next/server";
import {
  consumeAuthCode,
  createUser,
  finishLogin,
  getUserByEmail,
  isValidEmail,
} from "@/lib/auth-api";

/** POST /api/auth/verify-register — confirm code and create account. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    const locale: "en" | "zh" = body?.locale === "zh" ? "zh" : "en";

    if (!isValidEmail(email) || !code) {
      return NextResponse.json({ error: "Email and code required" }, { status: 400 });
    }
    if (getUserByEmail(email)) {
      return NextResponse.json(
        {
          error:
            locale === "zh"
              ? "该邮箱已注册，请直接登录。"
              : "This email is already registered. Please sign in.",
        },
        { status: 409 }
      );
    }

    const result = consumeAuthCode({
      email,
      purpose: "register",
      code,
    });
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

    const passwordHash = result.meta?.passwordHash;
    if (!passwordHash) {
      return NextResponse.json(
        {
          error:
            locale === "zh"
              ? "注册会话无效，请重新注册。"
              : "Registration session invalid. Please start again.",
        },
        { status: 400 }
      );
    }

    createUser(email, passwordHash);
    const session = await finishLogin(email);
    return NextResponse.json({ ok: true, ...session });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Verify failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
