import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface/50">
      <div className="max-w-3xl mx-auto w-full px-5 sm:px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-muted">
        <p className="text-subtle">
          © {new Date().getFullYear()} Forge Regex
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/pricing" className="hover:text-foreground transition-colors">
            Pricing
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <Link href="/refund" className="hover:text-foreground transition-colors">
            Refunds
          </Link>
          <a
            href="mailto:support@forge-regex.dev"
            className="hover:text-foreground transition-colors"
          >
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
