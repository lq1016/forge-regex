import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { LocaleProvider } from "@/components/LocaleProvider";
import {
  buildHighlightParts,
  countHighlightMatches,
} from "@/lib/regex-highlight";
import {
  PATTERNS,
  patternPath,
  type PatternLocale,
  type PatternPage,
} from "@/lib/patterns";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlightSafe(text: string, pattern: string, flags: string): string {
  const parts = buildHighlightParts(text, pattern, flags);
  if (!parts) return escapeHtml(text);
  return parts
    .map((p) =>
      p.match
        ? `<mark class="bg-accent/25 text-ink rounded-sm px-0.5">${escapeHtml(p.text)}</mark>`
        : escapeHtml(p.text)
    )
    .join("");
}

export function PatternArticle({
  pattern: p,
  locale,
}: {
  pattern: PatternPage;
  locale: PatternLocale;
}) {
  const copy = locale === "zh" ? p.zh : p.en;
  const forgeHref =
    locale === "zh"
      ? `/cn?q=${encodeURIComponent(copy.prompt)}`
      : `/?q=${encodeURIComponent(copy.prompt)}`;
  const html = highlightSafe(copy.sample, p.pattern, p.flags);
  const count = countHighlightMatches(copy.sample, p.pattern, p.flags);
  const indexHref = locale === "zh" ? "/cn/patterns" : "/patterns";
  const homeHref = locale === "zh" ? "/cn" : "/";

  return (
    <LocaleProvider locale={locale} basePath={locale === "zh" ? "/cn" : ""}>
      <div className="min-h-dvh flex flex-col bg-canvas text-ink">
        <header className="border-b border-border bg-surface/80 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between gap-4">
            <Link href={homeHref} className="font-semibold tracking-tight">
              Forge Regex
            </Link>
            <nav className="flex items-center gap-3 text-sm text-muted">
              <Link href={indexHref} className="hover:text-ink">
                {locale === "zh" ? "正则库" : "Patterns"}
              </Link>
              <Link
                href={locale === "zh" ? "/cn/pricing" : "/pricing"}
                className="hover:text-ink"
              >
                {locale === "zh" ? "定价" : "Pricing"}
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1 max-w-3xl mx-auto w-full px-5 sm:px-6 py-10 sm:py-14">
          <p className="text-sm text-muted mb-3">
            <Link href={indexHref} className="hover:text-ink">
              {locale === "zh" ? "正则库" : "Pattern library"}
            </Link>
            <span className="mx-2 text-subtle">/</span>
            <span>{copy.h1}</span>
          </p>

          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink mb-4">
            {copy.h1}
          </h1>

          <div className="space-y-3 text-base text-muted leading-relaxed mb-8">
            {copy.body.map((para) => (
              <p key={para.slice(0, 32)}>{para}</p>
            ))}
          </div>

          <section className="mb-8">
            <h2 className="text-sm font-semibold text-ink mb-2">
              {locale === "zh" ? "正则" : "Expression"}
            </h2>
            <pre className="overflow-x-auto rounded-xl border border-border bg-ink text-[#e8eaed] px-4 py-3 text-sm font-mono leading-relaxed">
              /{p.pattern}/{p.flags}
            </pre>
          </section>

          <section className="mb-8">
            <h2 className="text-sm font-semibold text-ink mb-2">
              {locale === "zh" ? "如何理解" : "How to read it"}
            </h2>
            <ul className="space-y-2 text-sm text-muted">
              {p.explanation.map((row) => (
                <li
                  key={row.token}
                  className="flex flex-col sm:flex-row sm:gap-3"
                >
                  <code className="font-mono text-accent shrink-0">
                    {row.token}
                  </code>
                  <span>
                    {locale === "zh" ? row.descriptionZh : row.descriptionEn}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-10">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <h2 className="text-sm font-semibold text-ink">
                {locale === "zh" ? "样例测试" : "Sample test"}
              </h2>
              <span className="text-xs text-muted">
                {locale === "zh" ? `${count} 处匹配` : `${count} match(es)`}
              </span>
            </div>
            <pre
              className="rounded-xl border border-border bg-surface px-4 py-3 text-sm whitespace-pre-wrap break-words font-mono text-ink"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </section>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={forgeHref}
              className="inline-flex justify-center items-center px-5 py-3 rounded-xl bg-accent text-white text-sm font-semibold hover:opacity-90"
            >
              {locale === "zh"
                ? "在 Forge 里用中文改写 / 生成"
                : "Tweak this in Forge"}
            </Link>
            <Link
              href={indexHref}
              className="inline-flex justify-center items-center px-5 py-3 rounded-xl border border-border text-sm font-medium hover:bg-surface"
            >
              {locale === "zh" ? "更多正则" : "More patterns"}
            </Link>
          </div>

          <p className="mt-8 text-sm text-subtle">
            {locale === "zh" ? "提示词：" : "Starter prompt: "}
            <span className="text-muted">{copy.prompt}</span>
          </p>
        </main>

        <SiteFooter />
      </div>
    </LocaleProvider>
  );
}

export function PatternIndex({ locale }: { locale: PatternLocale }) {
  const title = locale === "zh" ? "常用正则库" : "Regex pattern library";
  const sub =
    locale === "zh"
      ? "高频场景的可测正则。打开任意一页查看解释与样例，或在 Forge 用中文重新生成。"
      : "Tested starting points for common tasks. Open a page for explanations and samples, or regenerate in Forge from plain language.";
  const homeHref = locale === "zh" ? "/cn" : "/";

  return (
    <LocaleProvider locale={locale} basePath={locale === "zh" ? "/cn" : ""}>
      <div className="min-h-dvh flex flex-col bg-canvas text-ink">
        <header className="border-b border-border bg-surface/80">
          <div className="max-w-3xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between gap-4">
            <Link href={homeHref} className="font-semibold tracking-tight">
              Forge Regex
            </Link>
            <nav className="flex items-center gap-3 text-sm text-muted">
              <Link href={homeHref} className="hover:text-ink">
                {locale === "zh" ? "返回主页" : "Home"}
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-3xl mx-auto w-full px-5 sm:px-6 py-10 sm:py-14">
          <p className="text-sm text-muted mb-3">
            <Link href={homeHref} className="hover:text-ink">
              {locale === "zh" ? "← 返回主页" : "← Home"}
            </Link>
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3">
            {title}
          </h1>
          <p className="text-muted mb-8 leading-relaxed">{sub}</p>
          <ul className="divide-y divide-border border border-border rounded-2xl overflow-hidden bg-surface">
            {PATTERNS.map((p) => {
              const copy = locale === "zh" ? p.zh : p.en;
              return (
                <li key={p.slug}>
                  <Link
                    href={patternPath(p, locale)}
                    className="block px-5 py-4 hover:bg-accent-soft/40 transition-colors"
                  >
                    <span className="font-medium text-ink">{copy.h1}</span>
                    <span className="block text-sm text-muted mt-1 line-clamp-2">
                      {copy.description}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-8">
            <Link
              href={homeHref}
              className="inline-flex justify-center items-center px-5 py-3 rounded-xl border border-border text-sm font-medium hover:bg-surface"
            >
              {locale === "zh" ? "返回主页生成正则" : "Back to Forge home"}
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    </LocaleProvider>
  );
}
