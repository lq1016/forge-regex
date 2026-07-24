"use client";

import { useState, useCallback, useRef, useEffect } from "react";

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

const EXAMPLES = [
  "match email addresses",
  "Chinese phone numbers",
  "YYYY-MM-DD dates",
  "strong passwords",
  "IP addresses",
];

const DEMO_TEST_TEXT =
  "Visit https://example.com for docs. Our blog at https://forge-regex.dev/blog has tutorials. Also check http://localhost:3000 for local dev.";

/* ─── Component ─────────────────────────────────────── */

export default function Home() {
  const [prompt, setPrompt] = useState("extract all URLs from a block of text");
  const [result, setResult] = useState<RegexResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [testText, setTestText] = useState(DEMO_TEST_TEXT);
  const [copied, setCopied] = useState(false);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const testRef = useRef<HTMLTextAreaElement>(null);

  /* Load quota on mount */
  useEffect(() => {
    fetch("/api/quota")
      .then((r) => r.json())
      .then((data) => setUsage(data))
      .catch(() => {});
  }, []);

  /* Generate regex */
  const generateRegex = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("[generate]", data.error);
        return;
      }
      setResult(data);
      if (data.remaining !== undefined) {
        setUsage((prev) => prev ? { ...prev, remaining: data.remaining, used: prev.limit - data.remaining } : null);
      }
    } catch (err) {
      console.error("[generate]", err);
    } finally {
      setLoading(false);
    }
  }, [prompt]);

  /* Fill example prompt */
  const fillExample = useCallback(
    async (ex: string) => {
      setPrompt(ex);
      setLoading(true);
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: ex }),
        });
        const data = await res.json();
        if (res.ok) setResult(data);
      } catch (err) {
        console.error("[generate]", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /* Copy regex */
  const copyRegex = useCallback(async () => {
    if (!result) return;
    const text = `/${result.pattern}/${result.flags}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  /* PayPal checkout */
  const handleUpgrade = useCallback(async () => {
    window.open("https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-0T636305KS9268527NJRVKHY", "_blank");
  }, []);

  /* Build highlighted test output */
  const highlightedTest = (() => {
    if (!result) return null;
    try {
      const re = new RegExp(result.pattern, result.flags);
      const parts: { text: string; match: boolean }[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      const regex = new RegExp(result.pattern, result.flags === "gi" ? "gi" : result.flags);

      while ((match = regex.exec(testText)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ text: testText.slice(lastIndex, match.index), match: false });
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

  return (
    <>
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">/</span>
          </div>
          <span className="font-semibold text-lg tracking-tight text-foreground">
            Forge Regex
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="#"
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            Pricing
          </a>
          <button className="text-sm px-4 py-2 bg-accent text-white rounded-lg font-medium hover:opacity-90 active:scale-[0.98] transition-all">
            Sign In
          </button>
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 pt-12 pb-24">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-3">
            Describe your pattern.
            <br />
            Get the regex.
          </h1>
          <p className="text-muted text-lg max-w-xl mx-auto">
            Stop debugging regex. Tell Forge what you want to match and we&apos;ll
            write it for you.
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-border p-6 mb-6">
          <label className="block text-sm font-medium text-foreground mb-2">
            What do you want to match?
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && generateRegex()}
              className="flex-1 px-4 py-3 border border-border rounded-xl text-base outline-none focus:ring-2 focus:ring-accent/60 focus:border-accent transition-shadow"
              placeholder="e.g. match valid email addresses"
            />
            <button
              onClick={generateRegex}
              disabled={loading}
              className="px-6 py-3 bg-accent text-white font-medium rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Generating
                </span>
              ) : (
                "Generate"
              )}
            </button>
          </div>

          {/* Quick Examples */}
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="text-xs text-muted mr-1 self-center">Try:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => fillExample(ex)}
                className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Result Section */}
        {result && (
          <div className="animate-[fadeIn_0.3s_ease-out]">
            {/* Regex Output */}
            <div className="bg-white rounded-2xl shadow-sm border border-border p-6 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-foreground">
                  Generated Regex
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted bg-gray-100 px-2 py-1 rounded">
                    PCRE
                  </span>
                  <button
                    onClick={copyRegex}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
                  >
                    {copied ? (
                      <>
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="font-mono bg-gray-50 rounded-xl p-4 text-sm text-gray-800 overflow-x-auto border border-gray-100">
                <span className="text-accent font-semibold">/</span>
                <span>{result.pattern}</span>
                <span className="text-accent font-semibold">/{result.flags}</span>
              </div>

              {/* Explanation */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
                  Explanation
                </h3>
                <div className="space-y-2 text-sm text-gray-600">
                  {result.explanation.map((item, i) => (
                    <p key={i} className="flex items-start gap-2">
                      <code className="text-accent text-xs bg-accent-light px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                        {item.token}
                      </code>
                      <span>{item.description}</span>
                    </p>
                  ))}
                </div>
              </div>
            </div>

            {/* Test Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-border p-6 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-foreground">
                  Test your regex
                </h2>
                {highlightedTest && (
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full font-medium">
                    {highlightedTest.filter((p) => p.match).length} match
                    {highlightedTest.filter((p) => p.match).length !== 1
                      ? "es"
                      : ""}{" "}
                    found
                  </span>
                )}
              </div>
              <textarea
                ref={testRef}
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                className="w-full h-28 px-4 py-3 border border-border rounded-xl text-sm text-gray-700 outline-none focus:ring-2 focus:ring-accent/60 resize-none"
                placeholder="Paste test text here..."
              />

              {/* Highlighted output */}
              {highlightedTest && (
                <div className="mt-3 p-3 bg-gray-50 rounded-xl text-sm leading-relaxed text-gray-600 font-mono border border-gray-100">
                  {highlightedTest.map((part, i) =>
                    part.match ? (
                      <span
                        key={i}
                        className="bg-match rounded-sm px-0.5"
                      >
                        {part.text}
                      </span>
                    ) : (
                      <span key={i}>{part.text}</span>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Usage footer */}
            <div className="flex items-center justify-between text-sm text-muted">
              <div className="flex items-center gap-1">
                <span className={`inline-block w-2 h-2 rounded-full ${usage && usage.remaining > 0 ? 'bg-green-400' : 'bg-red-400'}`} />
                <span>
                  Daily free usage:{" "}
                  <span className="font-medium text-foreground">
                    {usage ? `${usage.limit - usage.remaining} of ${usage.limit}` : "..."}
                  </span>
                </span>
              </div>
              <button
                onClick={handleUpgrade}
                disabled={checkoutLoading}
                className="text-accent hover:text-accent/80 font-medium transition-colors disabled:opacity-50"
              >
                {checkoutLoading ? "Loading..." : "Upgrade for unlimited →"}
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && (
          <div className="text-center py-20 text-muted">
            <p className="text-lg">Describe a pattern above to get started.</p>
          </div>
        )}
      </main>
    </>
  );
}
