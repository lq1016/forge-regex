import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Refund Policy — Forge Regex",
  description: "Refund and cancellation policy for Forge Regex subscriptions.",
};

export default function RefundPage() {
  return (
    <div className="min-h-full flex flex-col">
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
          Refund Policy
        </h1>
        <p className="text-sm text-subtle mb-10">Last updated: July 25, 2026</p>

        <div className="space-y-8 text-[15px] text-muted leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-ink mb-2">Overview</h2>
            <p>
              Forge Regex Pro is a digital subscription. Purchases are processed
              by our Merchant of Record,{" "}
              <span className="text-ink font-medium">Paddle.com</span>. This
              policy explains how cancellations and refunds work.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              Cancellations
            </h2>
            <p>
              You may cancel a Pro subscription at any time through the billing
              portal provided by Paddle. Cancellation stops future renewals. You
              keep access until the end of the current paid period.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">Refunds</h2>
            <p className="mb-3">
              Because Pro is a digital service delivered immediately, refunds
              are handled case by case. We generally consider refund requests
              made within <span className="text-ink font-medium">14 days</span>{" "}
              of the initial purchase if you have not made substantial use of
              Pro features.
            </p>
            <p>
              Renewal charges may be refunded when there is a billing error or
              unauthorized charge. Contact us as soon as you notice an issue.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              How to request a refund
            </h2>
            <p>
              Email{" "}
              <a
                className="text-accent hover:underline"
                href="mailto:support@forge-regex.dev"
              >
                support@forge-regex.dev
              </a>{" "}
              with your order email and Paddle receipt/order ID. You may also
              contact Paddle customer support for payment-related requests, as
              Paddle is the Merchant of Record.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              Free tier
            </h2>
            <p>
              The free plan does not involve payment and is not eligible for
              refunds.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
