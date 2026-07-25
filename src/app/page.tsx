"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";

/* ─── Types ─────────────────────────────────────────── */

type RegexResult = {
  pattern: string;
  flags: string;
  explanation: { token: string; description: string }[];
  remaining?: number;
  limit?: number;
};

type UsageInfo = {
  used: number;
  remaining: number;
  limit: number;
};

/* ─── Demo data ─────────────────────────────────────── */

type Example = {
  label: string;
  prompt: string;
  sample: string;
};

const EXAMPLES: Example[] = [
  {
    label: "match email addresses",
    prompt: "match email addresses",
    sample:
      "Contact alice@example.com or bob.smith+dev@acme.co.uk today. Skip not-an-email and the bare @domain.com.",
  },
  {
    label: "US phone numbers",
    prompt: "US phone numbers",
    sample:
      "Call (415) 555-0132, or 415-555-0198, or +1 212 555 0100. Not a phone: 12345.",
  },
  {
    label: "ISO dates (YYYY-MM-DD)",
    prompt: "ISO dates (YYYY-MM-DD)",
    sample:
      "Shipped on 2024-03-15, due 2025-12-01. Ignore 03/15/2024 and 2024-13-40.",
  },
  {
    label: "strong passwords",
    prompt: "strong passwords (8+ chars, upper, lower, digit, symbol)",
    sample:
      "Good: Tr0ub4dor! and S3cure#Pass. Weak: password, abc123, NoSpecial1.",
  },
  {
    label: "IPv4 addresses",
    prompt: "IPv4 addresses",
    sample:
      "Servers at 192.168.1.1, 10.0.0.42, and 8.8.8.8. Invalid: 999.1.1.1 and 1.2.3.",
  },
];

const DEFAULT_TEST_TEXT =
  "Paste sample text here to see live matches…\n\nTips: include both valid hits and near-misses so you can trust the pattern.";

/* ─── Component ─────────────────────────────────────── */

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<RegexResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testText, setTestText] = useState(DEFAULT_TEST_TEXT);
  const [copied, setCopied] = useState(false);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [explainOpen, setExplainOpen] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/quota")
      .then((r) => r.json())
      .then((data) => setUsage(data))
      .catch(() => {});
    inputRef.current?.focus();
    if (/Mac|iPhone|iPad/.test(navigator.platform)) {
      setShortcutLabel("⌘");
    }
  }, []);

  const generateRegex = useCallback(
    async (overridePrompt?: string) => {
      const text = (overridePrompt ?? prompt).trim();
      if (!text) return;
      if (overridePrompt === undefined) setActiveLabel(null);
      setLoading(true);
      setError(null);
      setExplainOpen(false);
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Something went wrong. Please try again.");
          if (data.remaining !== undefined) {
            setUsage((prev) =>
              prev
                ? {
                    ...prev,
                    remaining: data.remaining,
                    used: prev.limit - data.remaining,
                  }
                : null
            );
          }
          return;
        }
        setResult(data);
        setHasGenerated(true);
        if (data.remaining !== undefined) {
          setUsage((prev) =>
            prev
              ? {
                  ...prev,
                  remaining: data.remaining,
                  used: prev.limit - data.remaining,
                }
              : null
          );
        }
        requestAnimationFrame(() => {
          resultRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        });
      } catch {
        setError("Network error. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    },
    [prompt]
  );

  const fillExample = useCallback(
    (ex: Example) => {
      /* Keep the input empty so the hint stays a placeholder */
      setPrompt("");
      setTestText(ex.sample);
      setActiveLabel(ex.label);
      setSelectedLabels((prev) =>
        prev.includes(ex.label) ? prev : [...prev, ex.label]
      );
      void generateRegex(ex.prompt);
    },
    [generateRegex]
  );

  const selectedExamples = EXAMPLES.filter((ex) =>
    selectedLabels.includes(ex.label)
  );
  const unselectedExamples = EXAMPLES.filter(
    (ex) => !selectedLabels.includes(ex.label)
  );

  const copyRegex = useCallback(async () => {
    if (!result) return;
    const text = `/${result.pattern}/${result.flags}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [result]);

  const matchParts = (() => {
    if (!result) return null;
    try {
      const flags = result.flags.includes("g")
        ? result.flags
        : `${result.flags}g`;
      const regex = new RegExp(result.pattern, flags);
      const parts: { text: string; match: boolean }[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      let guard = 0;

      while ((match = regex.exec(testText)) !== null && guard++ < 500) {
        if (match[0] === "") {
          regex.lastIndex++;
          continue;
        }
        if (match.index > lastIndex) {
          parts.push({
            text: testText.slice(lastIndex, match.index),
            match: false,
          });
        }
        parts.push({ text: match[0], match: true });
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < testText.length) {
        parts.push({ text: testText.slice(lastIndex), match: false });
      }
      return parts;
    } catch {
      return null;
    }
  })();

  const matchCount = matchParts?.filter((p) => p.match).length ?? 0;
  const quotaLow = usage !== null && usage.remaining <= 1;

  return (
    <>
      <nav className="animate-enter flex items-center justify-between px-5 sm:px-6 py-4 max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-[0_1px_0_rgba(255,255,255,0.25)_inset]"
            aria-hidden
          >
            <span className="text-white text-sm font-bold font-mono leading-none">
              /
            </span>
          </div>
          <span className="font-semibold text-[17px] tracking-tight text-ink">
            Forge Regex
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {usage && (
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 text-xs tabular-nums ${
                quotaLow ? "text-danger" : "text-subtle"
              }`}
              title="Free generations reset daily"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  quotaLow ? "bg-danger" : "bg-accent"
                }`}
              />
              {usage.remaining} free left
            </span>
          )}
          <Link
            href="/pricing"
            className="text-sm text-muted hover:text-foreground transition-colors duration-150"
          >
            Pricing
          </Link>
          <Link
            href="/pricing"
            className="btn-press text-sm px-3.5 py-2 bg-ink text-white rounded-lg font-medium"
          >
            Upgrade
          </Link>
        </div>
      </nav>

      <main className="flex-1 max-w-3xl mx-auto w-full px-5 sm:px-6 pt-10 sm:pt-14 pb-28">
        {/* Hero — collapses mentally once you've generated */}
        <header
          className={`animate-enter-delay-1 text-center transition-all duration-500 ${
            hasGenerated ? "mb-8" : "mb-12"
          }`}
        >
          <h1
            className={`font-display font-semibold tracking-tight text-ink text-balance ${
              hasGenerated
                ? "text-2xl sm:text-3xl mb-2"
                : "text-[2.15rem] sm:text-5xl leading-[1.15] mb-4"
            }`}
          >
            {hasGenerated ? (
              "Your regex is ready"
            ) : (
              <>
                Describe your pattern.
                <br />
                Get the regex.
              </>
            )}
          </h1>
          {!hasGenerated && (
            <p className="text-muted text-lg max-w-md mx-auto text-pretty leading-relaxed">
              Stop wrestling with regex syntax. Say what you want to match —
              we&apos;ll forge a working expression.
            </p>
          )}
        </header>

        {/* Primary action — the only heavyweight CTA */}
        <section
          className={`animate-enter-delay-2 ${
            result || loading ? "mb-6" : "mb-3"
          }`}
        >
          <label htmlFor="pattern-prompt" className="sr-only">
            Describe what you want to match
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                id="pattern-prompt"
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
                    e.preventDefault();
                    void generateRegex();
                  }
                }}
                className="w-full px-4 py-3.5 bg-surface border border-border rounded-xl text-base text-ink outline-none placeholder:text-subtle shadow-[0_1px_2px_rgba(17,19,24,0.04)] focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-ring)] transition-[box-shadow,border-color] duration-200"
                placeholder="match email addresses"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 text-[10px] font-medium text-subtle bg-surface-raised border border-border px-1.5 py-0.5 rounded">
                {shortcutLabel}
                <span className="opacity-60">↵</span>
              </kbd>
            </div>
            <button
              type="button"
              onClick={() => void generateRegex()}
              disabled={loading || !prompt.trim()}
              className="btn-press shrink-0 px-6 py-3.5 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-[0_1px_0_rgba(255,255,255,0.2)_inset]"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  Forging…
                </span>
              ) : (
                "Generate"
              )}
            </button>
          </div>
        </section>

        {/* Examples — selected vs remaining */}
        <div className="animate-enter-delay-3 space-y-3 mb-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle mb-2">
              Selected
            </p>
            {selectedExamples.length === 0 ? (
              <p className="text-xs text-subtle">
                None yet — pick an example below to try Forge.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedExamples.map((ex) => {
                  const active = activeLabel === ex.label;
                  return (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={() => fillExample(ex)}
                      disabled={loading}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors duration-150 disabled:opacity-50 ${
                        active
                          ? "bg-accent text-white border-accent"
                          : "bg-accent-soft text-accent border-accent/20 hover:border-accent/40"
                      }`}
                    >
                      {ex.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {unselectedExamples.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle mb-2">
                More examples
              </p>
              <div className="flex flex-wrap gap-2">
                {unselectedExamples.map((ex) => (
                  <button
                    key={ex.label}
                    type="button"
                    onClick={() => fillExample(ex)}
                    disabled={loading}
                    className="text-xs px-2.5 py-1.5 rounded-lg text-muted bg-surface/80 border border-border hover:border-border-strong hover:text-foreground transition-colors duration-150 disabled:opacity-50"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Inline error — not a toast */}
        {error && (
          <div
            role="alert"
            className="animate-enter mb-6 px-4 py-3 rounded-xl bg-danger-soft border border-red-100 text-sm text-danger flex items-start justify-between gap-3"
          >
            <p>{error}</p>
            {quotaLow && (
              <Link
                href="/pricing"
                className="shrink-0 font-medium underline underline-offset-2"
              >
                Upgrade
              </Link>
            )}
          </div>
        )}

        {/* Loading skeleton where results land */}
        {loading && !result && (
          <div className="animate-enter space-y-3" aria-busy aria-live="polite">
            <div className="h-28 rounded-2xl bg-surface border border-border overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent-soft/60 to-transparent animate-[pulse-soft_1.2s_ease-in-out_infinite]" />
            </div>
            <p className="text-center text-sm text-muted">
              Writing a production-ready pattern…
            </p>
          </div>
        )}

        {/* Empty state — designed first impression */}
        {!result && !loading && !error && (
          <div className="animate-enter pt-6 pb-4 text-center">
            <div
              className="animate-float mx-auto mb-5 w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center shadow-sm"
              aria-hidden
            >
              <span className="font-mono text-2xl text-accent font-semibold">
                .*
              </span>
            </div>
            <p className="text-muted text-[15px] mb-3 max-w-xs mx-auto">
              Type a description above, or pick an example to see Forge in
              action.
            </p>
            <p className="inline-flex items-center gap-1.5 text-sm text-accent font-medium">
              <span className="animate-nudge" aria-hidden>
                ↑
              </span>
              Start with Generate
            </p>
          </div>
        )}

        {/* Results — progressive rooms */}
        {result && (
          <div ref={resultRef} className="space-y-4">
            {/* Room 1: the regex + copy */}
            <section className="animate-enter bg-surface rounded-2xl border border-border shadow-[0_1px_2px_rgba(17,19,24,0.04)] overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-ink">
                    Generated regex
                  </h2>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-subtle bg-surface-raised border border-border px-1.5 py-0.5 rounded">
                    PCRE
                  </span>
                </div>
                <button
                  type="button"
                  onClick={copyRegex}
                  className="btn-press inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent-soft text-accent hover:bg-accent hover:text-white transition-colors duration-150"
                >
                  {copied ? (
                    <>
                      <CheckIcon />
                      Copied
                    </>
                  ) : (
                    <>
                      <CopyIcon />
                      Copy
                    </>
                  )}
                </button>
              </div>

              <div className="mx-5 mb-4 font-mono text-[13px] sm:text-sm leading-relaxed bg-ink text-[#e8eaed] rounded-xl px-4 py-3.5 overflow-x-auto selection:bg-accent/40">
                <span className="text-teal-300">/</span>
                <span className="text-[#f4f5f7]">{result.pattern}</span>
                <span className="text-teal-300">/{result.flags}</span>
              </div>

              {/* Explanation — collapsed by default (gradual revelation) */}
              <div className="border-t border-border">
                <button
                  type="button"
                  onClick={() => setExplainOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-surface-raised/80 transition-colors duration-150"
                  aria-expanded={explainOpen}
                >
                  <span className="text-sm font-medium text-ink">
                    How it works
                  </span>
                  <Chevron
                    open={explainOpen}
                    className="text-subtle transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  />
                </button>
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    explainOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <ul className="px-5 pb-5 space-y-2.5">
                      {result.explanation.map((item, i) => (
                        <li
                          key={`${item.token}-${i}`}
                          className="flex items-start gap-2.5 text-sm text-muted"
                          style={{
                            animation: explainOpen
                              ? `enter-up 0.35s var(--ease-out) ${i * 40}ms both`
                              : undefined,
                          }}
                        >
                          <code className="font-mono text-[11px] text-accent bg-accent-soft px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                            {item.token}
                          </code>
                          <span className="leading-snug">{item.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* Room 2: live test */}
            <section className="animate-enter-delay-1 bg-surface rounded-2xl border border-border shadow-[0_1px_2px_rgba(17,19,24,0.04)] p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-ink">
                  Test against your text
                </h2>
                <MatchBadge count={matchCount} ready={!!matchParts} />
              </div>

              <textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                className="w-full h-28 px-3.5 py-3 border border-border rounded-xl text-sm text-ink bg-surface-raised outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-ring)] resize-y min-h-[7rem] transition-[box-shadow,border-color] duration-200"
                placeholder="Paste sample text here…"
                spellCheck={false}
              />

              {matchParts && (
                <div className="mt-3 p-3.5 bg-surface-raised rounded-xl text-sm leading-relaxed text-muted font-mono border border-border overflow-x-auto">
                  {matchParts.length === 0 ||
                  (matchParts.length === 1 && !matchParts[0].match) ? (
                    <span className="text-subtle italic font-sans">
                      No matches in this text yet — try editing the sample.
                    </span>
                  ) : (
                    matchParts.map((part, i) =>
                      part.match ? (
                        <mark key={i} className="match-mark text-ink">
                          {part.text}
                        </mark>
                      ) : (
                        <span key={i}>{part.text}</span>
                      )
                    )
                  )}
                </div>
              )}
            </section>

            {/* Soft upgrade nudge when quota is low */}
            {usage && (
              <footer className="animate-enter-delay-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-sm text-muted">
                <p>
                  <span className="tabular-nums font-medium text-ink">
                    {usage.used}/{usage.limit}
                  </span>{" "}
                  free generations today
                </p>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-1 text-accent font-medium hover:text-accent-hover transition-colors group"
                >
                  Unlimited with Pro
                  <span
                    className="inline-block transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden
                  >
                    →
                  </span>
                </Link>
              </footer>
            )}
          </div>
        )}
      </main>

      <SiteFooter />
    </>
  );
}

/* ─── Small bits ────────────────────────────────────── */

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function Chevron({
  open,
  className = "",
}: {
  open: boolean;
  className?: string;
}) {
  return (
    <svg
      className={`w-4 h-4 ${open ? "rotate-180" : ""} ${className}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

function MatchBadge({ count, ready }: { count: number; ready: boolean }) {
  if (!ready) return null;
  return (
    <span
      className={`text-xs font-semibold tabular-nums px-2 py-1 rounded-md transition-colors duration-200 ${
        count > 0
          ? "text-accent bg-accent-soft"
          : "text-subtle bg-surface-raised border border-border"
      }`}
    >
      {count} match{count === 1 ? "" : "es"}
    </span>
  );
}
