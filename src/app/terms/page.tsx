import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { localeAlternates } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Terms of Service — Forge Regex",
  description: "Terms governing use of the Forge Regex service.",
  alternates: localeAlternates("/terms", "/cn/terms"),
};

export default function TermsPage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-5 sm:px-6 py-4 max-w-3xl mx-auto w-full">
        <Link
          href="/"
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          ← Forge Regex
        </Link>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-5 sm:px-6 pb-16">
        <h1 className="font-display text-3xl font-semibold text-ink tracking-tight mb-2">
          Terms of Service
        </h1>
        <p className="text-sm text-subtle mb-10">Last updated: July 25, 2026</p>

        <div className="space-y-8 text-[15px] text-muted leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              1. The service
            </h2>
            <p>
              Forge Regex is a software-as-a-service tool that helps you
              generate and test regular expressions from natural-language
              descriptions. By using the site, you agree to these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              2. Accounts &amp; free usage
            </h2>
            <p>
              You may use a limited free tier without creating an account. Free
              usage is subject to daily limits and fair-use controls. We may
              change limits to protect the service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              3. Paid subscriptions &amp; Merchant of Record
            </h2>
            <p className="mb-3">
              Our order process is conducted by our online reseller{" "}
              <span className="text-ink font-medium">Paddle.com</span>. Paddle
              is the Merchant of Record for all our orders. Paddle provides all
              customer service inquiries and handles returns.
            </p>
            <p>
              Prices are shown before purchase. Taxes may be calculated at
              checkout based on your location. Subscription renewals continue
              until cancelled through the billing portal provided by Paddle (or
              as otherwise instructed on our Pricing page).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              4. Acceptable use
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Do not abuse, scrape, or attempt to bypass rate limits</li>
              <li>Do not use the service for unlawful purposes</li>
              <li>
                Do not submit content you do not have rights to process
              </li>
              <li>
                Generated regex patterns are provided as-is; you are responsible
                for validating them in your own systems
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              5. Intellectual property
            </h2>
            <p>
              The Forge Regex name, branding, and site software are owned by us.
              Subject to these Terms, you may use regex patterns generated for
              you in your own projects.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              6. Disclaimer
            </h2>
            <p>
              The service is provided &quot;as is&quot; without warranties of
              any kind. AI-generated patterns may be incomplete or incorrect. We
              are not liable for damages arising from reliance on generated
              output, to the maximum extent permitted by law.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              7. Changes
            </h2>
            <p>
              We may update these Terms from time to time. Continued use after
              changes means you accept the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">8. Contact</h2>
            <p>
              Support:{" "}
              <a
                className="text-accent hover:underline"
                href="mailto:coderlau@live.com"
              >
                coderlau@live.com
              </a>
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
