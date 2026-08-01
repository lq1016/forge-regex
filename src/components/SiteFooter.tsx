"use client";

import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";

export function SiteFooter() {
  const { t, href } = useLocale();
  return (
    <footer className="mt-auto border-t border-border bg-surface/50">
      <div className="max-w-3xl mx-auto w-full px-5 sm:px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-muted">
        <p className="text-subtle">
          © {new Date().getFullYear()} {t("brand")}
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href={href("/pricing")} className="hover:text-foreground transition-colors">
            {t("footerPricing")}
          </Link>
          <Link href={href("/patterns")} className="hover:text-foreground transition-colors">
            {t("footerPatterns")}
          </Link>
          <Link href={href("/shares")} className="hover:text-foreground transition-colors">
            {t("myShares")}
          </Link>
          <Link href={href("/privacy")} className="hover:text-foreground transition-colors">
            {t("footerPrivacy")}
          </Link>
          <Link href={href("/terms")} className="hover:text-foreground transition-colors">
            {t("footerTerms")}
          </Link>
          <Link href={href("/refund")} className="hover:text-foreground transition-colors">
            {t("footerRefunds")}
          </Link>
          <a
            href="mailto:coderlau@live.com"
            className="hover:text-foreground transition-colors"
          >
            {t("footerContact")}
          </a>
        </nav>
      </div>
    </footer>
  );
}
