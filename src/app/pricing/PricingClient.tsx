"use client";

import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { AuthButton } from "@/components/AuthButton";
import { SubscribeButton } from "@/components/SubscribeButton";
import { LocaleProvider, useLocale } from "@/components/LocaleProvider";

function PricingInner() {
  const { t, href } = useLocale();
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-5 sm:px-6 py-4 max-w-3xl mx-auto w-full flex items-center justify-between gap-3">
        <Link
          href={href("/")}
          className="font-semibold text-ink tracking-tight hover:opacity-80"
        >
          {t("brand")}
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          <AuthButton />
          <Link
            href={href("/")}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            {t("navOpenApp")}
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-5 sm:px-6 pt-8 pb-16">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink tracking-tight mb-3">
            {t("pricingTitle")}
          </h1>
          <p className="text-muted text-lg max-w-md mx-auto">{t("pricingSub")}</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <div className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold text-ink mb-1">{t("planFree")}</h2>
            <p className="text-3xl font-semibold text-ink mb-4">
              $0
              <span className="text-sm font-normal text-muted">
                {" "}
                {t("perForever")}
              </span>
            </p>
            <ul className="text-sm text-muted space-y-2 mb-6">
              <li>{t("freeFeat1")}</li>
              <li>{t("freeFeat2")}</li>
              <li>{t("freeFeat3")}</li>
            </ul>
            <Link
              href={href("/")}
              className="btn-press inline-flex w-full justify-center px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-ink hover:bg-surface-raised"
            >
              {t("startGenerating")}
            </Link>
          </div>

          <div className="rounded-2xl border border-accent/30 bg-accent-soft/50 p-6">
            <h2 className="text-lg font-semibold text-ink mb-1">{t("planPro")}</h2>
            <p className="text-3xl font-semibold text-ink mb-4">
              $9
              <span className="text-sm font-normal text-muted">
                {" "}
                {t("perMonth")}
              </span>
            </p>
            <ul className="text-sm text-muted space-y-2 mb-6">
              <li>{t("proFeat1")}</li>
              <li>{t("proFeat2")}</li>
              <li>{t("proFeat3")}</li>
              <li>{t("proFeat4")}</li>
            </ul>
            <SubscribeButton label={t("payGo")} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface px-5 py-4 text-sm text-muted space-y-2">
          <p>
            <span className="font-medium text-ink">Billing · </span>
            {t("billingNote")}
          </p>
          <p>
            <a
              className="text-accent hover:underline"
              href="mailto:coderlau@live.com"
            >
              coderlau@live.com
            </a>
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

export function PricingClient() {
  return (
    <LocaleProvider locale="en" basePath="">
      <PricingInner />
    </LocaleProvider>
  );
}
