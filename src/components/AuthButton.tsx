"use client";

import {
  FormEvent,
  useEffect,
  useId,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/components/LocaleProvider";

type Me = {
  email: string | null;
  isPro: boolean;
};

type Mode = "login" | "register" | "forgot";
type Step = "form" | "code";

export function AuthButton() {
  const { t, locale, editionHeaders } = useLocale();
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function refresh() {
    try {
      const r = await fetch("/api/auth/me", {
        headers: editionHeaders(),
      });
      const data = (await r.json()) as Me;
      setMe(data);
    } catch {
      setMe({ email: null, isPro: false });
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const onOpen = () => {
      resetDialog("login");
      setOpen(true);
      setClosing(false);
    };
    window.addEventListener("forge:open-auth", onOpen);
    return () => window.removeEventListener("forge:open-auth", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  function resetDialog(next: Mode) {
    setMode(next);
    setStep("form");
    setErr(null);
    setBusy(false);
    setDevCode(null);
    setCode("");
    setPassword("");
    setPassword2("");
    setResendIn(0);
  }

  function close() {
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
      resetDialog("login");
    }, 180);
  }

  async function afterAuthOk() {
    await refresh();
    close();
    window.location.reload();
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, locale }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || t("networkError"));
        return;
      }
      await afterAuthOk();
    } catch {
      setErr(t("networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function onRegisterStart(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password.length < 8) {
      setErr(t("authPasswordShort"));
      return;
    }
    if (password !== password2) {
      setErr(t("authPasswordMismatch"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, locale }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || t("networkError"));
        return;
      }
      if (data.devCode) setDevCode(String(data.devCode));
      setStep("code");
      setResendIn(60);
    } catch {
      setErr(t("networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyRegister(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/auth/verify-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, locale }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || t("networkError"));
        return;
      }
      await afterAuthOk();
    } catch {
      setErr(t("networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function onForgotStart(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || t("networkError"));
        return;
      }
      if (data.devCode) setDevCode(String(data.devCode));
      setStep("code");
      setResendIn(60);
      setPassword("");
      setPassword2("");
    } catch {
      setErr(t("networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password.length < 8) {
      setErr(t("authPasswordShort"));
      return;
    }
    if (password !== password2) {
      setErr(t("authPasswordMismatch"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password, locale }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || t("networkError"));
        return;
      }
      await afterAuthOk();
    } catch {
      setErr(t("networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    if (resendIn > 0 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      if (mode === "register") {
        if (password.length < 8) {
          setErr(t("authPasswordShort"));
          return;
        }
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, locale }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErr(data.error || t("networkError"));
          return;
        }
        if (data.devCode) setDevCode(String(data.devCode));
      } else {
        const res = await fetch("/api/auth/forgot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, locale }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErr(data.error || t("networkError"));
          return;
        }
        if (data.devCode) setDevCode(String(data.devCode));
      }
      setResendIn(60);
    } catch {
      setErr(t("networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setMe({ email: null, isPro: false });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  const title =
    step === "code"
      ? t("authCodeTitle")
      : mode === "register"
        ? t("authRegisterTitle")
        : mode === "forgot"
          ? t("authForgotTitle")
          : t("authWelcome");

  const dialog =
    open && mounted
      ? createPortal(
          <div
            className={`auth-root ${closing ? "auth-root--closing" : ""}`}
            role="presentation"
          >
            <button
              type="button"
              aria-label={t("authClose")}
              className="auth-backdrop"
              onClick={close}
            />

            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="auth-dialog"
            >
              <div className="auth-dialog__inner">
                <header className="auth-dialog__header">
                  <div>
                    <p className="auth-dialog__eyebrow">{t("brand")}</p>
                    <h2 id={titleId} className="auth-dialog__title">
                      {title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    className="auth-dialog__close"
                    aria-label={t("authClose")}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M1 1l12 12M13 1L1 13"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </header>

                <div className="auth-dialog__body">
                  {step === "form" && mode === "login" && (
                    <>
                      <p className="auth-dialog__copy">{t("authCopy")}</p>
                      <form onSubmit={onLogin} className="auth-dialog__form space-y-3">
                        <label className="auth-dialog__field block text-left text-sm text-muted">
                          {t("authEmail")}
                          <input
                            type="email"
                            required
                            autoFocus
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="auth-dialog__input mt-1"
                            autoComplete="email"
                          />
                        </label>
                        <label className="auth-dialog__field block text-left text-sm text-muted">
                          {t("authPassword")}
                          <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="auth-dialog__input mt-1"
                            autoComplete="current-password"
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={busy}
                          className="btn-press auth-dialog__submit"
                        >
                          {busy ? t("authWorking") : t("authLogin")}
                        </button>
                      </form>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          className="auth-dialog__alt"
                          onClick={() => resetDialog("forgot")}
                        >
                          {t("authForgot")}
                        </button>
                        <button
                          type="button"
                          className="auth-dialog__alt"
                          onClick={() => resetDialog("register")}
                        >
                          {t("authRegister")}
                        </button>
                      </div>
                    </>
                  )}

                  {step === "form" && mode === "register" && (
                    <>
                      <p className="auth-dialog__copy">{t("authRegisterCopy")}</p>
                      <form
                        onSubmit={onRegisterStart}
                        className="auth-dialog__form space-y-3"
                      >
                        <label className="auth-dialog__field block text-left text-sm text-muted">
                          {t("authEmail")}
                          <input
                            type="email"
                            required
                            autoFocus
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="auth-dialog__input mt-1"
                            autoComplete="email"
                          />
                        </label>
                        <label className="auth-dialog__field block text-left text-sm text-muted">
                          {t("authPassword")}
                          <input
                            type="password"
                            required
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="auth-dialog__input mt-1"
                            autoComplete="new-password"
                          />
                        </label>
                        <label className="auth-dialog__field block text-left text-sm text-muted">
                          {t("authConfirmPassword")}
                          <input
                            type="password"
                            required
                            minLength={8}
                            value={password2}
                            onChange={(e) => setPassword2(e.target.value)}
                            className="auth-dialog__input mt-1"
                            autoComplete="new-password"
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={busy}
                          className="btn-press auth-dialog__submit"
                        >
                          {busy ? t("authSending") : t("authSendCode")}
                        </button>
                      </form>
                      <button
                        type="button"
                        className="auth-dialog__alt"
                        onClick={() => resetDialog("login")}
                      >
                        {t("authBackLogin")}
                      </button>
                    </>
                  )}

                  {step === "form" && mode === "forgot" && (
                    <>
                      <p className="auth-dialog__copy">{t("authForgotCopy")}</p>
                      <form
                        onSubmit={onForgotStart}
                        className="auth-dialog__form space-y-3"
                      >
                        <label className="auth-dialog__field block text-left text-sm text-muted">
                          {t("authEmail")}
                          <input
                            type="email"
                            required
                            autoFocus
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="auth-dialog__input mt-1"
                            autoComplete="email"
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={busy}
                          className="btn-press auth-dialog__submit"
                        >
                          {busy ? t("authSending") : t("authSendCode")}
                        </button>
                      </form>
                      <button
                        type="button"
                        className="auth-dialog__alt"
                        onClick={() => resetDialog("login")}
                      >
                        {t("authBackLogin")}
                      </button>
                    </>
                  )}

                  {step === "code" && mode === "register" && (
                    <>
                      <p className="auth-dialog__copy">{t("authCodeCopy")}</p>
                      <p className="auth-dialog__email text-center text-sm font-medium">
                        {email}
                      </p>
                      {devCode && (
                        <p className="text-xs text-center text-muted">
                          {t("authDevCode")}{" "}
                          <span className="font-mono text-accent">{devCode}</span>
                        </p>
                      )}
                      <form
                        onSubmit={onVerifyRegister}
                        className="auth-dialog__form space-y-3"
                      >
                        <label className="auth-dialog__field block text-left text-sm text-muted">
                          {t("authCode")}
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="\d{6}"
                            required
                            autoFocus
                            maxLength={6}
                            value={code}
                            onChange={(e) =>
                              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                            }
                            className="auth-dialog__input mt-1 tracking-[0.3em] text-center"
                            autoComplete="one-time-code"
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={busy || code.length !== 6}
                          className="btn-press auth-dialog__submit"
                        >
                          {busy ? t("authWorking") : t("authVerify")}
                        </button>
                      </form>
                      <button
                        type="button"
                        className="auth-dialog__alt"
                        disabled={resendIn > 0 || busy}
                        onClick={() => void resendCode()}
                      >
                        {resendIn > 0
                          ? t("authResendIn", { n: resendIn })
                          : t("authResend")}
                      </button>
                    </>
                  )}

                  {step === "code" && mode === "forgot" && (
                    <>
                      <p className="auth-dialog__copy">{t("authCodeCopy")}</p>
                      <p className="auth-dialog__email text-center text-sm font-medium">
                        {email}
                      </p>
                      {devCode && (
                        <p className="text-xs text-center text-muted">
                          {t("authDevCode")}{" "}
                          <span className="font-mono text-accent">{devCode}</span>
                        </p>
                      )}
                      <form onSubmit={onReset} className="auth-dialog__form space-y-3">
                        <label className="auth-dialog__field block text-left text-sm text-muted">
                          {t("authCode")}
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="\d{6}"
                            required
                            autoFocus
                            maxLength={6}
                            value={code}
                            onChange={(e) =>
                              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                            }
                            className="auth-dialog__input mt-1 tracking-[0.3em] text-center"
                            autoComplete="one-time-code"
                          />
                        </label>
                        <label className="auth-dialog__field block text-left text-sm text-muted">
                          {t("authPassword")}
                          <input
                            type="password"
                            required
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="auth-dialog__input mt-1"
                            autoComplete="new-password"
                          />
                        </label>
                        <label className="auth-dialog__field block text-left text-sm text-muted">
                          {t("authConfirmPassword")}
                          <input
                            type="password"
                            required
                            minLength={8}
                            value={password2}
                            onChange={(e) => setPassword2(e.target.value)}
                            className="auth-dialog__input mt-1"
                            autoComplete="new-password"
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={busy || code.length !== 6}
                          className="btn-press auth-dialog__submit"
                        >
                          {busy ? t("authWorking") : t("authReset")}
                        </button>
                      </form>
                      <button
                        type="button"
                        className="auth-dialog__alt"
                        disabled={resendIn > 0 || busy}
                        onClick={() => void resendCode()}
                      >
                        {resendIn > 0
                          ? t("authResendIn", { n: resendIn })
                          : t("authResend")}
                      </button>
                    </>
                  )}

                  {err && <p className="auth-dialog__error">{err}</p>}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  if (me?.email) {
    return (
      <div className="flex items-center gap-2.5">
        <span
          className="hidden sm:inline text-[13px] text-subtle max-w-[132px] truncate"
          title={me.email}
        >
          {me.email}
        </span>
        <button
          type="button"
          onClick={onLogout}
          disabled={busy}
          className="text-sm text-muted hover:text-ink transition-colors duration-150"
        >
          {t("navSignOut")}
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          resetDialog("login");
          setOpen(true);
          setClosing(false);
        }}
        className="text-sm text-muted hover:text-ink transition-colors duration-150"
      >
        {t("navSignIn")}
      </button>
      {dialog}
    </>
  );
}
