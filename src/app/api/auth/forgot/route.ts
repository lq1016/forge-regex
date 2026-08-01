import { NextRequest, NextResponse } from "next/server";
import {
  codeEmail,
  createAuthCode,
  deleteAuthCodes,
  getUserByEmail,
  isValidEmail,
  sendEmail,
  shouldExposeDevCode,
} from "@/lib/auth-api";

/** POST /api/auth/forgot — send reset code (always ok to avoid enumeration). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const locale: "en" | "zh" = body?.locale === "zh" ? "zh" : "en";

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const user = getUserByEmail(email);
    let devCode: string | undefined;
    if (user) {
      const code = createAuthCode({ email, purpose: "reset" });
      const mail = codeEmail(locale, "reset", code);
      const sent = await sendEmail({
        to: email.trim().toLowerCase(),
        ...mail,
      });
      if (!sent.ok) {
        deleteAuthCodes(email, "reset");
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
      if (shouldExposeDevCode()) devCode = code;
    }

    return NextResponse.json({
      ok: true,
      ...(devCode ? { devCode } : {}),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Forgot failed";
    const status = message.includes("Too many") ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
