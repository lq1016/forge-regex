"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { t } from "@/lib/copy";

type SharePayload = {
  id: string;
  prompt: string;
  pattern: string;
  flags: string;
  explanation: { token: string; description: string }[];
  testText: string;
};

export function ShareView({ id }: { id: string }) {
  const [share, setShare] = useState<SharePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/shares/${encodeURIComponent(id)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || t("shareNotFound"));
          return;
        }
        setShare(data);
      } catch {
        if (!cancelled) setError(t("networkError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-5 sm:px-6 py-4 max-w-3xl mx-auto w-full flex items-center justify-between">
        <Link href="/" className="font-semibold text-ink tracking-tight hover:opacity-80">
          {t("brand")}
        </Link>
        <Link href="/pricing" className="text-sm text-muted hover:text-ink">
          {t("navPricing")}
        </Link>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-5 sm:px-6 pt-6 pb-16 space-y-4">
        {loading && <p className="text-sm text-muted">Loading…</p>}
        {error && (
          <p className="text-sm text-danger bg-danger-soft border border-danger/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}
        {share && (
          <>
            {share.prompt && (
              <section className="bg-surface rounded-2xl border border-border p-5">
                <h1 className="text-sm font-semibold text-ink mb-2">Prompt</h1>
                <p className="text-muted text-sm leading-relaxed">{share.prompt}</p>
              </section>
            )}
            <section className="bg-surface rounded-2xl border border-border p-5">
              <h2 className="text-sm font-semibold text-ink mb-3">{t("generatedRegex")}</h2>
              <div className="font-mono text-sm bg-ink text-[#e8eaed] rounded-xl px-4 py-3.5 overflow-x-auto">
                <span className="text-teal-300">/</span>
                {share.pattern}
                <span className="text-teal-300">/{share.flags}</span>
              </div>
              {share.explanation?.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {share.explanation.map((item, i) => (
                    <li key={`${item.token}-${i}`} className="flex gap-2 text-sm text-muted">
                      <code className="font-mono text-[11px] text-accent bg-accent-soft px-1.5 py-0.5 rounded shrink-0 h-fit">
                        {item.token}
                      </code>
                      <span>{item.description}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {share.testText && (
              <section className="bg-surface rounded-2xl border border-border p-5">
                <h2 className="text-sm font-semibold text-ink mb-3">{t("testTitle")}</h2>
                <pre className="text-sm text-muted font-mono whitespace-pre-wrap bg-surface-raised border border-border rounded-xl p-3.5">
                  {share.testText}
                </pre>
              </section>
            )}
            <Link
              href={`/?s=${encodeURIComponent(share.id)}`}
              className="btn-press inline-flex px-4 py-2.5 rounded-xl bg-ink text-white text-sm font-semibold"
            >
              {t("shareOpenInForge")}
            </Link>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
