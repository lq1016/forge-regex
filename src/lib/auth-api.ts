import {
  createAuthCode,
  createUser,
  deleteAuthCodes,
  getUserByEmail,
  hashPassword,
  isValidEmail,
  isValidPassword,
  setSession,
  shouldExposeDevCode,
  verifyPassword,
  updateUserPassword,
  consumeAuthCode,
} from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import {
  clearProCookie,
  getActiveSubscriptionForEdition,
  setProCookie,
} from "@/lib/pro";

export async function finishLogin(email: string) {
  await setSession({ email });
  // Only sync forge-pro cookie from global (Paddle) entitlements.
  // CN Pro is session + edition-scoped and must not unlock the English site.
  const globalSub = getActiveSubscriptionForEdition(email, "global");
  if (globalSub) {
    await setProCookie({
      cid: globalSub.customerId,
      status: "active",
      email,
    });
  } else {
    await clearProCookie();
  }
  return {
    email,
    isPro: Boolean(globalSub),
    isProCn: Boolean(getActiveSubscriptionForEdition(email, "cn")),
  };
}

export function codeEmail(
  locale: "en" | "zh",
  purpose: "register" | "reset",
  code: string
): { subject: string; text: string; html: string } {
  if (locale === "zh") {
    const subject =
      purpose === "register"
        ? "Forge Regex 注册验证码"
        : "Forge Regex 重置密码验证码";
    const text = `您的验证码是 ${code}，10 分钟内有效。如非本人操作请忽略。`;
    return {
      subject,
      text,
      html: `<p>您的验证码是 <strong style="font-size:20px;letter-spacing:4px">${code}</strong></p><p>10 分钟内有效。如非本人操作请忽略。</p>`,
    };
  }
  const subject =
    purpose === "register"
      ? "Forge Regex verification code"
      : "Forge Regex password reset code";
  const text = `Your code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`;
  return {
    subject,
    text,
    html: `<p>Your code is <strong style="font-size:20px;letter-spacing:4px">${code}</strong></p><p>Expires in 10 minutes.</p>`,
  };
}

export {
  consumeAuthCode,
  createAuthCode,
  createUser,
  deleteAuthCodes,
  getUserByEmail,
  hashPassword,
  isValidEmail,
  isValidPassword,
  shouldExposeDevCode,
  verifyPassword,
  updateUserPassword,
  sendEmail,
};
