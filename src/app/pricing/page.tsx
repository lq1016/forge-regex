import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Pricing — Forge Regex",
  description:
    "Free and Pro plans for Forge Regex, the AI-powered regex builder.",
};

export default function PricingPage() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="px-5 sm:px-6 py-4 max-w-3xl mx-auto w-full flex items-center justify-between">
        <Link
          href="/"
          className="font-semibold text-ink tracking-tight hover:opacity-80"
        >
          Forge Regex
        </Link>
        <Link
          href="/"
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          Open app
        </Link>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-5 sm:px-6 pt-8 pb-16">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink tracking-tight mb-3">
            Simple pricing
          </h1>
          <p className="text-muted text-lg max-w-md mx-auto">
            Start free. Upgrade when you need unlimited generations.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <div className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold text-ink mb-1">Free</h2>
            <p className="text-3xl font-semibold text-ink mb-4">
              $0
              <span className="text-sm font-normal text-muted"> / forever</span>
            </p>
            <ul className="text-sm text-muted space-y-2 mb-6">
              <li>5 AI generations per day</li>
              <li>Live match testing</li>
              <li>Token-by-token explanations</li>
            </ul>
            <Link
              href="/"
              className="btn-press inline-flex w-full justify-center px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-ink hover:bg-surface-raised"
            >
              Start generating
            </Link>
          </div>

          <div className="rounded-2xl border border-accent/30 bg-accent-soft/50 p-6">
            <h2 className="text-lg font-semibold text-ink mb-1">Pro</h2>
            <p className="text-3xl font-semibold text-ink mb-4">
              $9
              <span className="text-sm font-normal text-muted"> / month</span>
            </p>
            <ul className="text-sm text-muted space-y-2 mb-6">
              <li>Unlimited generations</li>
              <li>Saved history &amp; favorites</li>
              <li>Priority model access</li>
              <li>Email support</li>
            </ul>
            <button
              type="button"
              disabled
              className="w-full px-4 py-2.5 rounded-xl bg-ink/15 text-ink/45 text-sm font-semibold cursor-not-allowed"
            >
              Coming soon via Paddle
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface px-5 py-4 text-sm text-muted space-y-2">
          <p>
            <span className="font-medium text-ink">Billing:</span> When
            checkout launches, orders will be processed by{" "}
            <span className="text-ink">Paddle.com</span> as Merchant of Record.
            Paddle handles taxes, invoices, and payment support.
          </p>
          <p>
            Questions?{" "}
            <a
              className="text-accent hover:underline"
              href="mailto:support@forge-regex.dev"
            >
              support@forge-regex.dev
            </a>
            {" · "}
            <Link href="/terms" className="text-accent hover:underline">
              Terms
            </Link>
            {" · "}
            <Link href="/privacy" className="text-accent hover:underline">
              Privacy
            </Link>
            {" · "}
            <Link href="/refund" className="text-accent hover:underline">
              Refunds
            </Link>
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
