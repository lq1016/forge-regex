"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function Inner() {
  const params = useSearchParams();
  const lang = params.get("lang") === "zh" ? "zh" : "en";
  const home = lang === "zh" ? "/cn" : "/";

  return (
    <main className="min-h-dvh flex items-center justify-center px-5">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-xl font-semibold text-ink">
          {lang === "zh" ? "请使用邮箱密码登录" : "Sign in with email & password"}
        </h1>
        <p className="text-sm text-muted">
          {lang === "zh"
            ? "邮件登录链接已停用。请返回应用，使用邮箱和密码注册或登录。"
            : "Magic email links are disabled. Return to the app and sign in with email and password."}
        </p>
        <Link
          href={home}
          className="inline-flex px-4 py-2.5 rounded-xl bg-ink text-white text-sm font-semibold"
        >
          {lang === "zh" ? "返回应用" : "Back to app"}
        </Link>
      </div>
    </main>
  );
}

export default function AuthVerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <Inner />
    </Suspense>
  );
}
