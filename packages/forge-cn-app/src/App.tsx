import { useCallback, useEffect, useMemo, useState } from "react";
import {
  analyzeRedosRisk,
  buildHighlightParts,
  hasFlag,
  isValidRegExp,
  loadLocalHistory,
  normalizeFlags,
  pushLocalHistory,
  toggleFlag,
  type HistoryItem,
  type RefineMode,
  FLAG_CHIPS,
  type FlagChip,
} from "@forge-regex/core";
import { fetchMe } from "./auth";
import { getBoot } from "./boot";
import { getCnFingerprint } from "./fp";

type ExplanationItem = { token: string; description: string };
type RegexResult = {
  pattern: string;
  flags: string;
  explanation: ExplanationItem[];
};
type UsageInfo = {
  remaining: number;
  limit: number;
  isPro?: boolean;
  needsAuth?: boolean;
  isGuest?: boolean;
};

const DEFAULT_TEST =
  "在此粘贴样例文本，查看实时匹配…\n\n提示：同时放入能匹配和差一点就能匹配的例子，更容易信任这条正则。";

const EXAMPLES: { label: string; sample: string; result: RegexResult }[] = [
  {
    label: "中国手机号",
    sample: "联系 13812345678、+86 15900001111。无效：12345、12800001111。",
    result: {
      pattern: "(?:\\+?86[-\\s]?)?1[3-9]\\d{9}",
      flags: "g",
      explanation: [
        { token: "(?:\\+?86[-\\s]?)?", description: "可选的 +86 / 86 国家码" },
        { token: "1[3-9]", description: "号段以 1 开头，第二位 3–9" },
        { token: "\\d{9}", description: "其后 9 位数字，共 11 位" },
      ],
    },
  },
  {
    label: "邮箱地址",
    sample: "发到 zhang@qq.com 或 hello.dev@company.cn。跳过 not-an-email。",
    result: {
      pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
      flags: "g",
      explanation: [
        { token: "[a-zA-Z0-9._%+-]+", description: "邮箱本地部分" },
        { token: "@", description: "必需的 @ 分隔符" },
        {
          token: "[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
          description: "域名与后缀",
        },
      ],
    },
  },
  {
    label: "提取 href",
    sample:
      '<a href="https://example.com/a">A</a> <a href=\'/rel\'>B</a> <span>href=notquoted</span>',
    result: {
      pattern: "(?<=href\\s*=\\s*['\"])[^'\"]+",
      flags: "gi",
      explanation: [
        {
          token: "(?<=href\\s*=\\s*['\"])",
          description: "紧跟在 href= 引号后（不占匹配）",
        },
        { token: "[^'\"]+", description: "整段匹配即为 URL 值" },
      ],
    },
  },
];

const REFINE_PRESETS: { mode: RefineMode; label: string }[] = [
  { mode: "tighten", label: "收紧" },
  { mode: "loosen", label: "放宽" },
  { mode: "captureValue", label: "只要值" },
];

export function App() {
  const boot = getBoot();
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<RegexResult | null>(null);
  const [testText, setTestText] = useState(DEFAULT_TEST);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [hasPro, setHasPro] = useState(boot.hasPro);
  const [authenticated, setAuthenticated] = useState(boot.authenticated);
  const [patternDirty, setPatternDirty] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setHistory(loadLocalHistory());
    void (async () => {
      try {
        const me = await fetchMe();
        setAuthenticated(me.authenticated);
        setHasPro(Boolean(me.products?.forgeRegexPro));
      } catch {
        // ignore
      }
      try {
        const fp = getCnFingerprint();
        const res = await fetch(
          `${boot.apiBase}/quota?fp=${encodeURIComponent(fp)}`,
          { credentials: "same-origin", headers: { "X-Forge-Fp": fp } }
        );
        if (res.ok) setUsage(await res.json());
      } catch {
        // ignore
      }
    })();
  }, [boot.apiBase]);

  const flags = result ? normalizeFlags(result.flags) : "g";
  const patternValid = result ? isValidRegExp(result.pattern, flags) : true;
  const highlight = useMemo(() => {
    if (!result || !patternValid) return [];
    return buildHighlightParts(testText, result.pattern, flags) || [];
  }, [result, testText, flags, patternValid]);
  const redos = useMemo(() => {
    if (!result) return null;
    return analyzeRedosRisk(result.pattern);
  }, [result]);

  const remember = useCallback(
    (next: RegexResult, nextPrompt: string, nextTest: string) => {
      const items = pushLocalHistory({
        prompt: nextPrompt,
        pattern: next.pattern,
        flags: next.flags,
        testText: nextTest,
        explanation: next.explanation,
      });
      setHistory(items);
    },
    []
  );

  const generate = useCallback(
    async (overridePrompt?: string, refine?: RefineMode) => {
      const text = (overridePrompt ?? prompt).trim();
      if (!refine && !text) {
        setError("请先描述你想匹配的内容。");
        return;
      }
      if (refine && !result) return;

      setLoading(true);
      setError(null);
      try {
        const fp = getCnFingerprint();
        const body: Record<string, unknown> = {
          prompt: text,
          locale: "zh",
          fp,
        };
        if (refine && result) {
          body.refine = {
            mode: refine,
            pattern: result.pattern,
            flags: result.flags,
          };
        }
        const res = await fetch(`${boot.apiBase}/generate`, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "X-Forge-Fp": fp,
          },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.code === "sign_in_required" || data.needsAuth) {
            setError(data.error || "试用次数已用完，请登录后继续。");
            setUsage({
              remaining: 0,
              limit: data.limit ?? 2,
              needsAuth: true,
              isGuest: true,
              isPro: false,
            });
          } else {
            setError(data.error || "生成失败，请重试。");
            if (typeof data.remaining === "number") {
              setUsage({
                remaining: data.remaining,
                limit: data.limit ?? 8,
                isPro: Boolean(data.isPro),
                needsAuth: Boolean(data.needsAuth),
              });
            }
          }
          return;
        }
        const next: RegexResult = {
          pattern: String(data.pattern || ""),
          flags: normalizeFlags(String(data.flags || "")),
          explanation: Array.isArray(data.explanation) ? data.explanation : [],
        };
        setResult(next);
        setPatternDirty(false);
        const sample =
          typeof data.sample === "string" && data.sample.trim()
            ? data.sample
            : testText;
        if (typeof data.sample === "string" && data.sample.trim()) {
          setTestText(data.sample);
        }
        setUsage({
          remaining: data.remaining ?? -1,
          limit: data.limit ?? -1,
          isPro: Boolean(data.isPro),
          needsAuth: false,
        });
        if (data.isPro) setHasPro(true);
        remember(next, text, sample);
      } catch {
        setError("网络错误，请稍后重试。");
      } finally {
        setLoading(false);
      }
    },
    [boot.apiBase, prompt, remember, result, testText]
  );

  const applyExample = (ex: (typeof EXAMPLES)[number]) => {
    setPrompt(ex.label);
    setResult(ex.result);
    setTestText(ex.sample);
    setPatternDirty(false);
    setError(null);
    remember(ex.result, ex.label, ex.sample);
  };

  const restore = (item: HistoryItem) => {
    setPrompt(item.prompt);
    setResult({
      pattern: item.pattern,
      flags: normalizeFlags(item.flags),
      explanation: item.explanation || [],
    });
    setTestText(item.testText || DEFAULT_TEST);
    setPatternDirty(false);
  };

  const copyPattern = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(`/${result.pattern}/${flags}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const quotaLabel = (() => {
    if (hasPro || usage?.isPro) return "Pro · 无限生成";
    if (!usage) return "";
    if (usage.needsAuth) return "试用已用完 · 请登录";
    if (usage.remaining < 0) return "Pro · 无限生成";
    if (usage.isGuest || !authenticated) {
      return `试用剩余 ${usage.remaining} 次`;
    }
    return `今日剩余 ${usage.remaining}/${usage.limit}`;
  })();

  return (
    <div className="forge-cn">
      <header className="forge-cn__header">
        <div>
          <h1 className="forge-cn__title">Forge Regex</h1>
          <p className="forge-cn__sub">用中文描述规则，得到可用正则</p>
        </div>
        <div className="forge-cn__meta">
          {quotaLabel ? <span className="forge-cn__quota">{quotaLabel}</span> : null}
          {!authenticated ? (
            <a className="forge-cn__link" href={boot.loginUrl}>
              登录
            </a>
          ) : !hasPro ? (
            <a className="forge-cn__link" href={boot.pricingUrl}>
              开通 Pro
            </a>
          ) : (
            <span className="forge-cn__badge">已开通 Pro</span>
          )}
        </div>
      </header>

      <div className="forge-cn__examples">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            className="forge-cn__chip"
            onClick={() => applyExample(ex)}
          >
            {ex.label}
          </button>
        ))}
      </div>

      {history.length > 0 ? (
        <section className="forge-cn__history">
          <h2>最近</h2>
          <ul>
            {history.slice(0, 8).map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => restore(item)}>
                  {item.prompt.trim() || `/${item.pattern.slice(0, 36)}/`}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <label className="forge-cn__label" htmlFor="forge-prompt">
        描述你想匹配的内容
      </label>
      <textarea
        id="forge-prompt"
        className="forge-cn__textarea"
        rows={3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="例如：提取 HTML 里 a 标签的 href 值"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void generate();
          }
        }}
      />
      <div className="forge-cn__actions">
        <button
          type="button"
          className="forge-cn__btn"
          disabled={loading}
          onClick={() => void generate()}
        >
          {loading ? "生成中…" : "生成正则"}
        </button>
        <span className="forge-cn__hint">⌘/Ctrl + Enter</span>
      </div>

      {error ? <p className="forge-cn__error">{error}</p> : null}
      {usage?.needsAuth ? (
        <p className="forge-cn__gate">
          <a href={boot.loginUrl}>登录 SilentTrace 账号</a>
          后每天可免费生成 8 次；或 <a href={boot.pricingUrl}>开通 Pro</a>。
        </p>
      ) : null}

      {result ? (
        <section className="forge-cn__result">
          <div className="forge-cn__pattern-wrap">
            <span className="forge-cn__slash">/</span>
            <textarea
              className="forge-cn__pattern"
              value={result.pattern}
              rows={1}
              spellCheck={false}
              onChange={(e) => {
                setResult({ ...result, pattern: e.target.value });
                setPatternDirty(true);
              }}
              aria-invalid={!patternValid}
            />
            <span className="forge-cn__slash">/{flags}</span>
          </div>
          {!patternValid ? (
            <p className="forge-cn__warn">正则语法无效，请检查转义或括号。</p>
          ) : null}
          {patternDirty ? (
            <p className="forge-cn__warn">你已手动改写正则；下方解释可能已过时。</p>
          ) : null}

          <div className="forge-cn__flags">
            <span>标志</span>
            {FLAG_CHIPS.map((flag) => {
              const on = hasFlag(flags, flag);
              return (
                <button
                  key={flag}
                  type="button"
                  aria-pressed={on}
                  className={on ? "on" : ""}
                  onClick={() =>
                    setResult({
                      ...result,
                      flags: toggleFlag(flags, flag as FlagChip),
                    })
                  }
                >
                  {flag}
                </button>
              );
            })}
            <button
              type="button"
              className="forge-cn__copy"
              onClick={() => void copyPattern()}
            >
              {copied ? "已复制" : "复制"}
            </button>
          </div>

          <div className="forge-cn__refine">
            <span>改写</span>
            {REFINE_PRESETS.map((p) => (
              <button
                key={p.mode}
                type="button"
                disabled={loading}
                onClick={() => void generate(prompt, p.mode)}
              >
                {p.label}
              </button>
            ))}
            <p className="forge-cn__hint">改写会计入生成次数；失败不扣次。</p>
          </div>

          {redos?.risk ? (
            <p className="forge-cn__warn">
              检测到潜在 ReDoS 风险（{redos.code}），复杂输入下可能较慢。
            </p>
          ) : null}

          {result.explanation.length > 0 && !patternDirty ? (
            <ul className="forge-cn__explain">
              {result.explanation.map((row) => (
                <li key={row.token + row.description}>
                  <code>{row.token}</code>
                  <span>{row.description}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <label className="forge-cn__label" htmlFor="forge-test">
            测试文本
          </label>
          <textarea
            id="forge-test"
            className="forge-cn__textarea"
            rows={5}
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
          />
          <div className="forge-cn__hl" aria-live="polite">
            {highlight.length === 0 ? (
              <span className="forge-cn__muted">暂无匹配</span>
            ) : (
              highlight.map((part, i) =>
                part.match ? (
                  <mark key={i}>{part.text}</mark>
                ) : (
                  <span key={i}>{part.text}</span>
                )
              )
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
