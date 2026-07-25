import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Privacy Policy — Forge Regex",
  description: "How Forge Regex collects, uses, and protects your data.",
};

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="text-sm text-subtle mb-10">Last updated: July 25, 2026</p>

        <div className="prose-legal space-y-8 text-[15px] text-muted leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-ink mb-2">Overview</h2>
            <p>
              Forge Regex (&quot;we&quot;, &quot;us&quot;) provides an AI-assisted
              regular-expression builder at this website. This policy explains
              what information we collect and how we use it.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              Information we collect
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <span className="text-ink">Usage prompts</span> — natural-language
                descriptions you submit to generate regex patterns.
              </li>
              <li>
                <span className="text-ink">Usage limits</span> — a signed cookie
                that tracks free daily generation counts.
              </li>
              <li>
                <span className="text-ink">Technical data</span> — standard server
                logs (IP address, user agent, timestamps) for security and
                reliability.
              </li>
              <li>
                <span className="text-ink">Payment data</span> — when paid plans
                are available, payments are processed by our payment partner
                (e.g. Paddle). We do not store full card numbers on our servers.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              How we use information
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>To generate and return regex patterns you request</li>
              <li>To enforce free-tier rate limits and prevent abuse</li>
              <li>To operate, secure, and improve the service</li>
              <li>To process subscriptions and provide customer support</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              Third-party processors
            </h2>
            <p>
              We use infrastructure and AI providers to run the product. Prompts
              you submit may be sent to our AI model provider solely to fulfill
              your request. Payment partners process checkout and tax as
              Merchant of Record when billing is enabled.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">Cookies</h2>
            <p>
              We use an essential cookie to remember free daily usage. We do not
              use third-party advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">Retention</h2>
            <p>
              Usage cookies expire within about 24 hours. Server logs are kept
              only as long as needed for security and operations. You may
              contact us to request deletion of account-related data once
              accounts are available.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">Contact</h2>
            <p>
              Questions about privacy:{" "}
              <a
                className="text-accent hover:underline"
                href="mailto:support@forge-regex.dev"
              >
                support@forge-regex.dev
              </a>
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
