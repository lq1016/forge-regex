"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { AuthButton } from "@/components/AuthButton";
import { ReplacePanel } from "@/components/ReplacePanel";
import { ExportPanel } from "@/components/ExportPanel";
import { ShareButton } from "@/components/ShareButton";
import { FlagEditor } from "@/components/FlagEditor";
import { PatternEditor } from "@/components/PatternEditor";
import { CaptureGroupsTable } from "@/components/CaptureGroupsTable";
import { RedosWarning } from "@/components/RedosWarning";
import { LocaleProvider, useLocale } from "@/components/LocaleProvider";
import type { Locale } from "@/lib/i18n";
import { buildHighlightParts } from "@/lib/regex-highlight";
import { analyzeRedosRisk } from "@/lib/regex-redos";
import { normalizeFlags } from "@/lib/regex-flags";
import { getDeviceFingerprint } from "@/lib/device-fp";

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
  isPro?: boolean;
  email?: string | null;
  needsAuth?: boolean;
  isGuest?: boolean;
};

/* ─── Demo data ─────────────────────────────────────── */

type Example = {
  label: string;
  sample: string;
  result: RegexResult;
};

const EXAMPLES: Example[] = [
  {
    label: "match email addresses",
    sample:
      "Contact alice@example.com or bob.smith+dev@acme.co.uk today. Skip not-an-email and the bare @domain.com.",
    result: {
      pattern:
        "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
      flags: "g",
      explanation: [
        {
          token: "[a-zA-Z0-9._%+-]+",
          description: "Local part: letters, digits, and common email symbols",
        },
        { token: "@", description: "Required @ separator" },
        {
          token: "[a-zA-Z0-9.-]+",
          description: "Domain name labels",
        },
        {
          token: "\\.[a-zA-Z]{2,}",
          description: "TLD such as .com or .uk (2+ letters)",
        },
      ],
    },
  },
  {
    label: "US phone numbers",
    sample:
      "Call (415) 555-0132, or 415-555-0198, or +1 212 555 0100. Not a phone: 12345.",
    result: {
      pattern:
        "(?:\\+1[-.\\s]?)?(?:\\(?\\d{3}\\)?[-.\\s]?)\\d{3}[-.\\s]?\\d{4}",
      flags: "g",
      explanation: [
        {
          token: "(?:\\+1[-.\\s]?)?",
          description: "Optional +1 country code with separator",
        },
        {
          token: "(?:\\(?\\d{3}\\)?[-.\\s]?)",
          description: "Area code, optionally in parentheses",
        },
        {
          token: "\\d{3}[-.\\s]?\\d{4}",
          description: "Exchange + subscriber number",
        },
      ],
    },
  },
  {
    label: "ISO dates (YYYY-MM-DD)",
    sample:
      "Shipped on 2024-03-15, due 2025-12-01. Ignore 03/15/2024 and 2024-13-40.",
    result: {
      pattern:
        "\\b(?:19|20)\\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])\\b",
      flags: "g",
      explanation: [
        {
          token: "\\b(?:19|20)\\d{2}",
          description: "Year 1900–2099 at a word boundary",
        },
        {
          token: "-(?:0[1-9]|1[0-2])",
          description: "Month 01–12",
        },
        {
          token: "-(?:0[1-9]|[12]\\d|3[01])\\b",
          description: "Day 01–31",
        },
      ],
    },
  },
  {
    label: "strong passwords",
    sample:
      "Good: Tr0ub4dor! and S3cure#Pass — weak: password, abc123, NoSpecial1",
    result: {
      pattern:
        "(?=\\S*[A-Z])(?=\\S*[a-z])(?=\\S*\\d)(?=\\S*[!@#$%^&*(),.?\":{}|<>])\\S{8,}",
      flags: "g",
      explanation: [
        {
          token: "(?=\\S*[A-Z])",
          description: "Must contain an uppercase letter",
        },
        {
          token: "(?=\\S*[a-z])",
          description: "Must contain a lowercase letter",
        },
        {
          token: "(?=\\S*\\d)",
          description: "Must contain a digit",
        },
        {
          token: "(?=\\S*[!@#$%^&*(),.?\":{}|<>])",
          description: "Must contain a common symbol",
        },
        {
          token: "\\S{8,}",
          description: "At least 8 non-space characters",
        },
      ],
    },
  },
  {
    label: "IPv4 addresses",
    sample:
      "Servers at 192.168.1.1, 10.0.0.42, and 8.8.8.8. Invalid: 999.1.1.1 and 1.2.3.",
    result: {
      pattern:
        "\\b(?:(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)\\b",
      flags: "g",
      explanation: [
        {
          token: "(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)",
          description: "One octet 0–255",
        },
        {
          token: "(?:...\\.){3}(?:...)",
          description: "Four octets separated by dots",
        },
        {
          token: "\\b",
          description: "Word boundaries so partial numbers are skipped",
        },
      ],
    },
  },
];

const DEFAULT_TEST_TEXT =
  "Paste sample text here to see live matches…\n\nTips: include both valid hits and near-misses so you can trust the pattern.";

const DEFAULT_TEST_TEXT_ZH =
  "在此粘贴样例文本，查看实时匹配…\n\n提示：同时放入能匹配和差一点就能匹配的例子，更容易信任这条正则。";

/** China-common patterns for /cn */
const EXAMPLES_ZH: Example[] = [
  {
    label: "中国手机号",
    sample:
      "联系 13812345678、+86 15900001111。无效：12345、12800001111。",
    result: {
      pattern: "(?:\\+?86[-\\s]?)?1[3-9]\\d{9}",
      flags: "g",
      explanation: [
        {
          token: "(?:\\+?86[-\\s]?)?",
          description: "可选的 +86 / 86 国家码",
        },
        {
          token: "1[3-9]",
          description: "号段以 1 开头，第二位 3–9",
        },
        {
          token: "\\d{9}",
          description: "其后 9 位数字，共 11 位",
        },
      ],
    },
  },
  {
    label: "身份证号",
    sample:
      "证件：11010119900307891X、44030119851212001X。无效：123456、1101011990030789123。",
    result: {
      pattern:
        "(?<!\\d)[1-9]\\d{5}(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx](?!\\d)",
      flags: "g",
      explanation: [
        {
          token: "[1-9]\\d{5}",
          description: "地区码 6 位（首位非 0）",
        },
        {
          token: "(?:19|20)\\d{2}",
          description: "出生年 1900–2099",
        },
        {
          token: "(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])",
          description: "出生月日",
        },
        {
          token: "\\d{3}[\\dXx]",
          description: "顺序码 3 位 + 校验位（数字或 X）",
        },
      ],
    },
  },
  {
    label: "中文姓名",
    sample: "【张三】【欧阳娜娜】【皇甫清】｜skip【李】【John】",
    result: {
      pattern: "[\\u4e00-\\u9fa5]{2,4}",
      flags: "g",
      explanation: [
        {
          token: "[\\u4e00-\\u9fa5]",
          description: "常用汉字 Unicode 范围",
        },
        {
          token: "{2,4}",
          description: "通常 2–4 个字（含复姓）",
        },
      ],
    },
  },
  {
    label: "邮箱地址",
    sample:
      "发到 zhang@qq.com 或 hello.dev@company.cn。跳过 not-an-email 和 @domain。",
    result: {
      pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
      flags: "g",
      explanation: [
        {
          token: "[a-zA-Z0-9._%+-]+",
          description: "邮箱本地部分",
        },
        { token: "@", description: "必需的 @ 分隔符" },
        {
          token: "[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
          description: "域名与后缀（如 .com / .cn）",
        },
      ],
    },
  },
  {
    label: "车牌号",
    sample: "车辆：京A12345、沪C88888、浙A1B2C3。无效：京12345、京A12。",
    result: {
      pattern: "[\\u4e00-\\u9fa5][A-HJ-NP-Z][A-HJ-NP-Z0-9]{5}",
      flags: "gi",
      explanation: [
        {
          token: "[\\u4e00-\\u9fa5]",
          description: "省份简称汉字",
        },
        {
          token: "[A-HJ-NP-Z]",
          description: "发牌机关字母（不含 I/O）",
        },
        {
          token: "[A-HJ-NP-Z0-9]{5}",
          description: "号牌序号 5 位（普通蓝牌简化示例）",
        },
      ],
    },
  },
];

/* ─── Component ─────────────────────────────────────── */

function ForgeHomeInner() {
  const { t, href, locale, editionHeaders } = useLocale();
  const examples = locale === "zh" ? EXAMPLES_ZH : EXAMPLES;
  const defaultTest =
    locale === "zh" ? DEFAULT_TEST_TEXT_ZH : DEFAULT_TEST_TEXT;
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<RegexResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testText, setTestText] = useState(defaultTest);
  const [copied, setCopied] = useState(false);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [explainOpen, setExplainOpen] = useState(false);
  const [patternDirty, setPatternDirty] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl");
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      // After Paddle checkout redirect, activate Pro from transaction id in URL
      const params = new URLSearchParams(window.location.search);
      const q = params.get("q")?.trim();
      if (q) setPrompt(q);
      const txn =
        params.get("_ptxn") ||
        params.get("txn") ||
        params.get("transaction_id");
      if (txn?.startsWith("txn_")) {
        try {
          const res = await fetch("/api/paddle/activate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactionId: txn }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            console.error("[activate]", data.error || res.status);
          }
        } catch (err) {
          console.error("[activate]", err);
        }
        // Clean query params without full reload
        params.delete("_ptxn");
        params.delete("txn");
        params.delete("transaction_id");
        params.delete("upgraded");
        const clean = `${window.location.pathname}${
          params.toString() ? `?${params}` : ""
        }`;
        window.history.replaceState({}, "", clean);
      }

      const shareId = params.get("s");
      if (shareId) {
        try {
          const sr = await fetch(`/api/shares/${encodeURIComponent(shareId)}`);
          const sd = await sr.json();
          if (!cancelled && sr.ok && typeof sd.pattern === "string") {
            setPrompt(typeof sd.prompt === "string" ? sd.prompt : "");
            setResult({
              pattern: sd.pattern,
              flags: normalizeFlags(
                typeof sd.flags === "string" ? sd.flags : ""
              ),
              explanation: Array.isArray(sd.explanation) ? sd.explanation : [],
            });
            setPatternDirty(false);
            setTestText(
              typeof sd.testText === "string" && sd.testText
                ? sd.testText
                : defaultTest
            );
            setHasGenerated(true);
            setExplainOpen(false);
          }
        } catch {
          // ignore
        }
        params.delete("s");
        const cleanShare = `${window.location.pathname}${
          params.toString() ? `?${params}` : ""
        }`;
        window.history.replaceState({}, "", cleanShare);
      }

      try {
        const fp = await getDeviceFingerprint();
        const r = await fetch(
          `/api/quota${fp ? `?fp=${encodeURIComponent(fp)}` : ""}`,
          {
            headers: {
              ...editionHeaders(),
              ...(fp ? { "X-Forge-Fp": fp } : {}),
            },
          }
        );
        const data = await r.json();
        if (!cancelled) {
          setUsage(data);
          if (data.needsAuth) {
            setError(t("errSignInToGenerate"));
          }
        }
      } catch {
        // ignore
      }
    }

    void bootstrap();
    inputRef.current?.focus();
    if (/Mac|iPhone|iPad/.test(navigator.platform)) {
      setShortcutLabel("⌘");
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const generateRegex = useCallback(
    async (overridePrompt?: string) => {
      const text = (overridePrompt ?? prompt).trim();
      if (!text) return;
      if (overridePrompt === undefined) setActiveLabel(null);

      if (usage?.needsAuth) {
        window.dispatchEvent(new Event("forge:open-auth"));
        setError(t("errSignInToGenerate"));
        return;
      }

      setLoading(true);
      setError(null);
      setExplainOpen(false);
      try {
        const fp = await getDeviceFingerprint();
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...editionHeaders(),
            ...(fp ? { "X-Forge-Fp": fp } : {}),
          },
          body: JSON.stringify({ prompt: text, locale, fp: fp || undefined }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401 || data.code === "sign_in_required") {
            window.dispatchEvent(new Event("forge:open-auth"));
            setError(data.error || t("errSignInToGenerate"));
            return;
          }
          setError(data.error || t("somethingWentWrong"));
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
        setResult({
          ...data,
          flags: normalizeFlags(data.flags || ""),
        });
        setPatternDirty(false);
        setHasGenerated(true);
        if (typeof data.sample === "string" && data.sample.trim()) {
          setTestText(data.sample.trim());
        } else {
          setTestText(defaultTest);
        }
        if (data.remaining !== undefined) {
          setUsage((prev) =>
            prev
              ? {
                  ...prev,
                  remaining: data.remaining,
                  used: Math.max(0, prev.limit - data.remaining),
                  needsAuth: false,
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
        setError(t("networkError"));
      } finally {
        setLoading(false);
      }
    },
    [prompt, locale, defaultTest, usage, t]
  );

  const fillExample = useCallback((ex: Example) => {
    /* Instant demo — no API / spinner / quota */
    setPrompt("");
    setLoading(false);
    setError(null);
    setExplainOpen(false);
    setTestText(ex.sample);
    setResult({
      ...ex.result,
      flags: normalizeFlags(ex.result.flags || ""),
    });
    setPatternDirty(false);
    setHasGenerated(true);
    setActiveLabel(ex.label);
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }, []);

  const copyRegex = useCallback(async () => {
    if (!result) return;
    const text = `/${result.pattern}/${result.flags}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [result]);

  const matchParts = (() => {
    if (!result) return null;
    return buildHighlightParts(testText, result.pattern, result.flags);
  })();

  const redos = result ? analyzeRedosRisk(result.pattern) : null;

  const matchCount = matchParts?.filter((p) => p.match).length ?? 0;
  const isPro = Boolean(usage?.isPro);
  const quotaLow =
    usage !== null && !isPro && usage.remaining <= 1;

  return (
    <div className="min-h-dvh flex flex-col">
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
            {t("brand")}
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {usage && !usage.needsAuth && (
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 text-xs tabular-nums ${
                isPro
                  ? "text-accent"
                  : quotaLow
                    ? "text-danger"
                    : "text-subtle"
              }`}
              title={isPro ? t("proUnlimited") : t("freeResetDaily")}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isPro
                    ? "bg-accent"
                    : quotaLow
                      ? "bg-danger"
                      : "bg-accent"
                }`}
              />
              {isPro
                ? t("proBadge")
                : usage.isGuest
                  ? t("guestLeft", { n: usage.remaining })
                  : t("freeLeft", { n: usage.remaining })}
            </span>
          )}
          <AuthButton />
          <Link
            href={href("/pricing")}
            className="text-sm text-muted hover:text-foreground transition-colors duration-150"
          >
            {t("navPricing")}
          </Link>
          {!isPro && (
            <Link
              href={href("/pricing")}
              className="btn-press text-sm px-3.5 py-2 bg-ink text-white rounded-lg font-medium"
            >
              {t("navUpgrade")}
            </Link>
          )}
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
              t("heroReady")
            ) : (
              <>
                {t("heroTitle")
                  .split("\n")
                  .map((line, i) => (
                    <span key={line}>
                      {i > 0 && <br />}
                      {line}
                    </span>
                  ))}
              </>
            )}
          </h1>
          {!hasGenerated && (
            <p className="text-muted text-lg max-w-md mx-auto text-pretty leading-relaxed">
              {t("heroSub")}
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
            {t("promptLabel")}
          </label>
          <div className="relative group/prompt rounded-xl bg-surface border border-border shadow-[0_1px_2px_rgba(17,19,24,0.04)] focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--color-accent-ring)] transition-[box-shadow,border-color] duration-200">
            <textarea
              ref={inputRef}
              id="pattern-prompt"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void generateRegex();
                }
              }}
              className="w-full min-h-[7rem] max-h-64 resize-y px-4 pt-3.5 pb-14 bg-transparent text-base text-ink leading-relaxed outline-none placeholder:text-subtle"
              placeholder={t("promptPlaceholder")}
              autoComplete="off"
              spellCheck={false}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-3 pb-2.5 pt-6 bg-gradient-to-t from-surface via-surface/95 to-transparent rounded-b-xl">
              <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-medium text-subtle bg-surface-raised border border-border px-1.5 py-0.5 rounded">
                {shortcutLabel}
                <span className="opacity-60">↵</span>
              </kbd>
              <span className="sm:hidden" />
              <button
                type="button"
                onClick={() => void generateRegex()}
                disabled={loading || !prompt.trim()}
                className="pointer-events-auto btn-press shrink-0 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-[0_1px_0_rgba(255,255,255,0.2)_inset]"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Spinner />
                    {t("forging")}
                  </span>
                ) : (
                  t("generate")
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Examples — click to show instantly */}
        <div className="animate-enter-delay-3 mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle mb-2">
            {t("examples")}
          </p>
          <div className="flex flex-wrap gap-2">
            {examples.map((ex) => {
              const active = activeLabel === ex.label;
              return (
                <button
                  key={ex.label}
                  type="button"
                  onClick={() => fillExample(ex)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors duration-150 ${
                    active
                      ? "bg-accent text-white border-accent"
                      : "text-muted bg-surface/80 border-border hover:border-border-strong hover:text-foreground"
                  }`}
                >
                  {ex.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Inline error / guest trial exhausted — show on load when needsAuth */}
        {(error || usage?.needsAuth) && (
          <div
            role="alert"
            className="animate-enter mb-6 px-4 py-3 rounded-xl bg-danger-soft border border-red-100 text-sm text-danger flex items-start justify-between gap-3"
          >
            <p>{error || t("errSignInToGenerate")}</p>
            {(quotaLow || usage?.needsAuth) && (
              <Link
                href={href("/pricing")}
                className="shrink-0 font-medium underline underline-offset-2"
              >
                {t("navUpgrade")}
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
              {t("forgingHint")}
            </p>
          </div>
        )}

        {/* Empty state — designed first impression */}
        {!result && !loading && !(error || usage?.needsAuth) && (
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
              {t("emptyHint")}
            </p>
            <p className="inline-flex items-center gap-1.5 text-sm text-accent font-medium">
              <span className="animate-nudge" aria-hidden>
                ↑
              </span>
              {t("startWithGenerate")}
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
                    {t("generatedRegex")}
                  </h2>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-subtle bg-surface-raised border border-border px-1.5 py-0.5 rounded">
                    PCRE
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copyRegex}
                    className="btn-press inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent-soft text-accent hover:bg-accent hover:text-white transition-colors duration-150"
                  >
                    {copied ? (
                      <>
                        <CheckIcon />
                        {t("copied")}
                      </>
                    ) : (
                      <>
                        <CopyIcon />
                        {t("copy")}
                      </>
                    )}
                  </button>
                  <ShareButton
                    isPro={!!isPro}
                    signedIn={!!usage?.email}
                    prompt={prompt}
                    pattern={result.pattern}
                    flags={result.flags}
                    explanation={result.explanation}
                    testText={testText}
                  />
                </div>
              </div>

              <PatternEditor
                pattern={result.pattern}
                flags={result.flags}
                onChange={(next) => {
                  setPatternDirty(true);
                  setResult((prev) =>
                    prev ? { ...prev, pattern: next } : prev
                  );
                }}
              />
              {patternDirty ? (
                <p className="mx-5 mb-3 text-xs text-subtle">
                  {t("explanationStale")}
                </p>
              ) : null}

              {redos?.risk && redos.code ? (
                <RedosWarning code={redos.code} />
              ) : null}
              <FlagEditor
                flags={result.flags}
                onChange={(next) =>
                  setResult((prev) =>
                    prev ? { ...prev, flags: next } : prev
                  )
                }
              />

              {/* Explanation — collapsed by default (gradual revelation) */}
              <div className="border-t border-border">
                <button
                  type="button"
                  onClick={() => setExplainOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-surface-raised/80 transition-colors duration-150"
                  aria-expanded={explainOpen}
                >
                  <span className="text-sm font-medium text-ink">
                    {t("howItWorks")}
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
                  {t("testTitle")}
                </h2>
                <MatchBadge count={matchCount} ready={!!matchParts} t={t} />
              </div>

              <textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                className="w-full h-28 px-3.5 py-3 border border-border rounded-xl text-sm text-ink bg-surface-raised outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-ring)] resize-y min-h-[7rem] transition-[box-shadow,border-color] duration-200"
                placeholder={t("promptPlaceholder")}
                spellCheck={false}
              />

              {matchParts && (
                <div className="mt-3 p-3.5 bg-surface-raised rounded-xl text-sm leading-relaxed text-muted font-mono border border-border overflow-x-auto">
                  {matchParts.length === 0 ||
                  (matchParts.length === 1 && !matchParts[0].match) ? (
                    <span className="text-subtle italic font-sans">
                      {t("noMatchesHint")}
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

              <CaptureGroupsTable
                pattern={result.pattern}
                flags={result.flags}
                testText={testText}
              />
            </section>

            <ReplacePanel
              pattern={result.pattern}
              flags={result.flags}
              testText={testText}
            />
            <ExportPanel pattern={result.pattern} flags={result.flags} />

            {/* Soft upgrade nudge when quota is low */}
            {usage && !isPro && (
              <footer className="animate-enter-delay-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-sm text-muted">
                <p>
                  {t("freeGensToday", {
                    used: usage.used,
                    limit: usage.limit,
                  })}
                </p>
                <Link
                  href={href("/pricing")}
                  className="inline-flex items-center gap-1 text-accent font-medium hover:text-accent-hover transition-colors group"
                >
                  {t("unlimitedPro")}
                  <span
                    className="inline-block transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden
                  >
                    →
                  </span>
                </Link>
              </footer>
            )}
            {usage && isPro && (
              <footer className="animate-enter-delay-2 pt-1 text-sm text-muted">
                <p>{t("proUnlimitedFooter")}</p>
              </footer>
            )}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
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

function MatchBadge({
  count,
  ready,
  t,
}: {
  count: number;
  ready: boolean;
  t: (key: "matchZero" | "matchOne" | "matches", vars?: { n: number }) => string;
}) {
  if (!ready) return null;
  const label =
    count === 0
      ? t("matchZero")
      : count === 1
        ? t("matchOne")
        : t("matches", { n: count });
  return (
    <span
      className={`text-xs font-semibold tabular-nums px-2 py-1 rounded-md transition-colors duration-200 ${
        count > 0
          ? "text-accent bg-accent-soft"
          : "text-subtle bg-surface-raised border border-border"
      }`}
    >
      {label}
    </span>
  );
}

export function ForgeHome({
  locale,
  basePath,
}: {
  locale: Locale;
  basePath: string;
}) {
  return (
    <LocaleProvider locale={locale} basePath={basePath}>
      <ForgeHomeInner />
    </LocaleProvider>
  );
}
