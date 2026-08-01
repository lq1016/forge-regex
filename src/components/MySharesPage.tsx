"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { AuthButton } from "@/components/AuthButton";
import { LocaleProvider, useLocale } from "@/components/LocaleProvider";
import type { Locale } from "@/lib/i18n";
import { localizeApiError } from "@/lib/api-errors";

type ShareRow = {
  id: string;
  prompt: string;
  pattern: string;
  flags: string;
  createdAt: string;
  url: string;
};

function MySharesInner() {
  const { t, href, locale, editionHeaders } = useLocale();
  const [shares, setShares] = useState<ShareRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/shares", {
        headers: editionHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(localizeApiError(locale, data, "shareFailed"));
        setShares([]);
        return;
      }
      setShares(data.shares ?? []);
    } catch {
      setError(t("networkError"));
      setShares([]);
    }
  }, [t, locale, editionHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    const res = await fetch(`/api/shares/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setShares((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
    }
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-5 sm:px-6 py-4 max-w-3xl mx-auto w-full flex items-center justify-between gap-3">
        <Link
          href={href("/")}
          className="font-semibold text-ink tracking-tight hover:opacity-80"
        >
          {t("brand")}
        </Link>
        <div className="flex items-center gap-3">
          <AuthButton />
          <Link href={href("/")} className="text-sm text-muted hover:text-ink">
            {t("navOpenApp")}
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-5 sm:px-6 pt-6 pb-16">
        <h1 className="font-display text-3xl font-semibold text-ink mb-6">
          {t("sharesTitle")}
        </h1>
        {error && (
          <p className="text-sm text-danger mb-4">
            {error}{" "}
            <Link href={href("/pricing")} className="underline text-accent">
              {t("navUpgrade")}
            </Link>
          </p>
        )}
        {shares && shares.length === 0 && !error && (
          <p className="text-muted text-sm">{t("sharesEmpty")}</p>
        )}
        <ul className="space-y-3">
          {shares?.map((s) => (
            <li
              key={s.id}
              className="bg-surface border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">
                  {s.prompt || `/${s.pattern}/${s.flags}`}
                </p>
                <p className="text-xs text-subtle font-mono truncate mt-1">
                  /{s.pattern}/{s.flags}
                </p>
                <p className="text-[11px] text-subtle mt-1">
                  {new Date(s.createdAt).toLocaleString(
                    locale === "zh" ? "zh-CN" : "en-US"
                  )}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link
                  href={`/r/${s.id}`}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent-soft text-accent"
                >
                  {t("shareOpenInForge")}
                </Link>
                <button
                  type="button"
                  onClick={() => void remove(s.id)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border text-muted hover:text-danger"
                >
                  {t("sharesDelete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}

export function MySharesPage({
  locale,
  basePath,
}: {
  locale: Locale;
  basePath: string;
}) {
  return (
    <LocaleProvider locale={locale} basePath={basePath}>
      <MySharesInner />
    </LocaleProvider>
  );
}
