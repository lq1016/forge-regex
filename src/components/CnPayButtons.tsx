"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Methods = {
  wechat: boolean;
  alipay: boolean;
  wechatMock?: boolean;
  alipayMock?: boolean;
  cnPriceYuan: number;
};

type PendingOrder = {
  orderId: string;
  codeUrl?: string;
  channel: "wechat" | "alipay";
  mode: "qr" | "page";
};

function formatExpiry(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleDateString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function CnPayButtons() {
  const [methods, setMethods] = useState<Methods | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [proExpiresAt, setProExpiresAt] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [renewing, setRenewing] = useState(false);
  const [busy, setBusy] = useState<"wechat" | "alipay" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingOrder | null>(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    void fetch("/api/pay/methods")
      .then((r) => r.json())
      .then((d) => setMethods(d as Methods))
      .catch(() =>
        setMethods({ wechat: false, alipay: false, cnPriceYuan: 9.9 })
      );

    void fetch("/api/auth/me", { headers: { "X-Forge-Edition": "cn" } })
      .then((r) => r.json())
      .then(
        (d: {
          email?: string | null;
          isPro?: boolean;
          proExpiresAt?: string | null;
        }) => {
          setEmail(d.email ?? null);
          setIsPro(Boolean(d.isPro));
          setProExpiresAt(d.proExpiresAt ?? null);
        }
      )
      .catch(() => {
        setEmail(null);
        setIsPro(false);
        setProExpiresAt(null);
      })
      .finally(() => setAuthLoading(false));

    try {
      const params = new URLSearchParams(window.location.search);
      const orderId = params.get("orderId") || params.get("out_trade_no");
      if (orderId) {
        setPending({ orderId, channel: "alipay", mode: "page" });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!pending || paid) return;
    const path =
      pending.channel === "wechat"
        ? `/api/pay/wechat/status?orderId=${encodeURIComponent(pending.orderId)}`
        : `/api/pay/alipay/status?orderId=${encodeURIComponent(pending.orderId)}`;
    const id = window.setInterval(async () => {
      try {
        const r = await fetch(path);
        const d = await r.json();
        if (d.status === "paid") {
          setPaid(true);
          setIsPro(true);
          window.clearInterval(id);
          // Refresh expiry from session
          void fetch("/api/auth/me", { headers: { "X-Forge-Edition": "cn" } })
            .then((res) => res.json())
            .then((me: { proExpiresAt?: string | null }) => {
              setProExpiresAt(me.proExpiresAt ?? null);
            })
            .catch(() => undefined);
        }
      } catch {
        // ignore
      }
    }, 2000);
    return () => window.clearInterval(id);
  }, [pending, paid]);

  function requireLogin(): boolean {
    if (email) return true;
    setError("请先登录，Pro 将开通到当前账号邮箱。");
    window.dispatchEvent(new Event("forge:open-auth"));
    return false;
  }

  async function startPay(channel: "wechat" | "alipay") {
    setError(null);
    if (!requireLogin() || !email) return;

    setBusy(channel);
    setPaid(false);
    setPending(null);
    try {
      const r = await fetch(`/api/pay/${channel}/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const d = await r.json();
      if (!r.ok) {
        if (r.status === 401 || d.code === "sign_in_required") {
          setError(d.error || "请先登录");
          window.dispatchEvent(new Event("forge:open-auth"));
          return;
        }
        setError(d.error || "创建订单失败");
        return;
      }

      if (channel === "alipay") {
        const cashierPath = d.cashierPath as string | undefined;
        if (!cashierPath) {
          setError("未返回支付宝收银台链接");
          return;
        }
        setPending({
          orderId: d.orderId,
          channel: "alipay",
          mode: "page",
        });
        window.location.href = cashierPath;
        return;
      }

      const codeUrl = d.codeUrl as string | undefined;
      if (!codeUrl) {
        setError("未返回支付二维码");
        return;
      }
      setPending({
        orderId: d.orderId,
        codeUrl,
        channel: "wechat",
        mode: "qr",
      });
    } catch {
      setError("网络错误");
    } finally {
      setBusy(null);
    }
  }

  async function mockPay() {
    if (!pending) return;
    await fetch(`/api/pay/${pending.channel}/mock-pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: pending.orderId }),
    });
  }

  const price = methods?.cnPriceYuan ?? 9.9;
  const wechatReady = Boolean(methods?.wechat);
  const alipayReady = Boolean(methods?.alipay);
  const showMock =
    (pending?.channel === "wechat" && methods?.wechatMock) ||
    (pending?.channel === "alipay" && methods?.alipayMock);
  const showWechatQr =
    pending?.channel === "wechat" && pending.mode === "qr" && pending.codeUrl;
  const showAlipayWait =
    pending?.channel === "alipay" && pending.mode === "page" && !paid;
  const expiryLabel = formatExpiry(proExpiresAt);

  if (paid) {
    return (
      <div className="rounded-xl border border-accent/30 bg-accent-soft/60 p-4 text-sm text-ink space-y-3">
        <p className="font-semibold text-accent">支付成功</p>
        <p>已为当前登录账号开通 / 续期一个月 Pro（按 31 天计）。</p>
        {expiryLabel && (
          <p className="text-muted">当前有效期至 {expiryLabel}</p>
        )}
        <Link
          href="/cn"
          className="btn-press inline-flex w-full justify-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-ink hover:opacity-90"
        >
          开始使用 Pro
        </Link>
      </div>
    );
  }

  if (!methods || authLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-10 rounded-xl bg-surface border border-border" />
        <div className="h-10 rounded-xl bg-surface border border-border" />
        <div className="h-10 rounded-xl bg-surface border border-border" />
      </div>
    );
  }

  if (!email) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          请先登录。Pro 将开通到你的登录邮箱。
        </p>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("forge:open-auth"))}
          className="btn-press w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-ink hover:opacity-90"
        >
          登录后升级
        </button>
      </div>
    );
  }

  if (isPro && !renewing && !showWechatQr && !showAlipayWait) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-accent/30 bg-accent-soft/60 p-4 text-sm text-ink space-y-1">
          <p className="font-semibold text-accent">你已是 Pro</p>
          <p className="text-muted break-all">{email}</p>
          {expiryLabel ? (
            <p className="text-muted">有效期至 {expiryLabel}</p>
          ) : (
            <p className="text-muted">订阅有效</p>
          )}
        </div>
        <Link
          href="/cn"
          className="btn-press inline-flex w-full justify-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-ink hover:opacity-90"
        >
          开始使用 Pro
        </Link>
        <button
          type="button"
          onClick={() => setRenewing(true)}
          className="w-full text-sm text-muted hover:text-ink underline underline-offset-2"
        >
          续费叠加一个月（¥{price}）
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form
        className="space-y-3"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void startPay("wechat");
        }}
      >
        {isPro && renewing ? (
          <p className="text-sm text-muted">
            为{" "}
            <span className="font-medium text-ink break-all">{email}</span>{" "}
            续费叠加一个月
            {expiryLabel ? `（当前至 ${expiryLabel}）` : ""}
          </p>
        ) : (
          <p className="text-sm text-muted">
            开通邮箱：
            <span className="ml-1 font-medium text-ink break-all">{email}</span>
          </p>
        )}

        <button
          type="submit"
          disabled={!wechatReady || busy !== null}
          className="btn-press w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#07C160] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!wechatReady
            ? "微信支付 · 即将开通"
            : busy === "wechat"
              ? "正在创建订单…"
              : `微信支付 · ¥${price} / 月`}
        </button>

        <button
          type="button"
          onClick={() => void startPay("alipay")}
          disabled={!alipayReady || busy !== null}
          className="btn-press w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#1677FF] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!alipayReady
            ? "支付宝 · 即将开通"
            : busy === "alipay"
              ? "正在跳转支付宝…"
              : `支付宝 · ¥${price} / 月`}
        </button>

        {isPro && renewing && (
          <button
            type="button"
            onClick={() => {
              setRenewing(false);
              setError(null);
              setPending(null);
            }}
            className="w-full text-sm text-muted hover:text-ink"
          >
            取消
          </button>
        )}
      </form>

      {error && <p className="text-sm text-danger">{error}</p>}

      {showWechatQr && (
        <div className="rounded-xl border border-border bg-surface p-4 text-center space-y-3">
          <p className="text-sm text-muted">请使用微信扫码支付</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="微信支付二维码"
            className="mx-auto w-48 h-48 bg-white rounded-lg"
            src={`https://api.qrserver.com/v1/create-qr-code/?size=192x192&data=${encodeURIComponent(pending.codeUrl!)}`}
          />
          <p className="text-xs text-subtle break-all">{pending.orderId}</p>
          {showMock && (
            <button
              type="button"
              onClick={() => void mockPay()}
              className="text-xs text-muted underline"
            >
              开发模拟支付成功
            </button>
          )}
        </div>
      )}

      {showAlipayWait && (
        <div className="rounded-xl border border-border bg-surface p-4 text-center space-y-2">
          <p className="text-sm text-muted">
            已打开支付宝收银台。付款完成后会自动回到本页并开通 Pro。
          </p>
          <p className="text-xs text-subtle break-all">{pending.orderId}</p>
          {showMock && (
            <button
              type="button"
              onClick={() => void mockPay()}
              className="text-xs text-muted underline"
            >
              开发模拟支付成功
            </button>
          )}
        </div>
      )}
    </div>
  );
}
