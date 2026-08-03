"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";
import { localizeApiError } from "@/lib/api-errors";

type Props = {
  isPro: boolean;
  signedIn: boolean;
  prompt: string;
  pattern: string;
  flags: string;
  explanation: { token: string; description: string }[];
  testText: string;
};

export function ShareButton({
  isPro,
  signedIn,
  prompt,
  pattern,
  flags,
  explanation,
  testText,
}: Props) {
  const { t, href, locale, editionHeaders } = useLocale();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function createShare() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...editionHeaders(),
        },
        body: JSON.stringify({
          prompt,
          pattern,
          flags,
          explanation,
          testText,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(localizeApiError(locale, data, "shareFailed"));
        setOpen(true);
        return;
      }
      setUrl(data.url as string);
      setOpen(true);
    } catch {
      setError(t("networkError"));
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  async function onClick() {
    if (!isPro || !signedIn) {
      setOpen(true);
      setUrl(null);
      setError(null);
      return;
    }
    if (url) {
      setOpen((o) => !o);
      return;
    }
    await createShare();
  }

  async function copyLink() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={busy}
        className="btn-press inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-60"
      >
        {busy ? "…" : t("share")}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-20 w-[min(20rem,calc(100vw-2.5rem))] rounded-xl border border-border bg-surface shadow-lg p-3 space-y-2 animate-[enter-fade_0.25s_var(--ease-out)]">
          {isPro && signedIn && url ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
                {t("shareLink")}
              </p>
              <input
                readOnly
                value={url}
                className="w-full text-xs font-mono px-2.5 py-2 rounded-lg border border-border bg-surface-raised"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="btn-press flex-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-accent-soft text-accent"
                >
                  {copied ? t("copied") : t("shareCopyLink")}
                </button>
                <Link
                  href={href("/shares")}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border text-muted hover:text-ink"
                >
                  {t("myShares")}
                </Link>
              </div>
            </>
          ) : (
            <div className="text-xs text-muted leading-relaxed space-y-2">
              <p>{t("shareProOnly")}</p>
              <div className="flex gap-2">
                {!signedIn && (
                  <span className="text-accent font-semibold">{t("navSignIn")}</span>
                )}
                <Link href={href("/pricing")} className="text-accent font-semibold hover:underline">
                  {t("navUpgrade")}
                </Link>
              </div>
            </div>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
