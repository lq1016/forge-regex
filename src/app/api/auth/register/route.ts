import { NextRequest, NextResponse } from "next/server";
import {
  codeEmail,
  createAuthCode,
  deleteAuthCodes,
  getUserByEmail,
  hashPassword,
  isValidEmail,
  isValidPassword,
  sendEmail,
  shouldExposeDevCode,
} from "@/lib/auth-api";

/** POST /api/auth/register — start registration, email a code. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const locale: "en" | "zh" = body?.locale === "zh" ? "zh" : "en";

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
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

    const passwordHash = hashPassword(password);
    let code: string;
    try {
      code = createAuthCode({
        email,
        purpose: "register",
        meta: { passwordHash },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Register failed";
      const status = message.includes("Too many") ? 429 : 500;
      return NextResponse.json({ error: message }, { status });
    }

    const mail = codeEmail(locale, "register", code);
    const sent = await sendEmail({
      to: email.trim().toLowerCase(),
      ...mail,
    });
    if (!sent.ok) {
      deleteAuthCodes(email, "register");
      return NextResponse.json(
        {
          error:
            locale === "zh"
              ? "验证码邮件发送失败，请稍后重试。"
              : "Failed to send verification email. Try again later.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      ...(shouldExposeDevCode() ? { devCode: code } : {}),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Register failed";
    const status = message.includes("Too many") ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
