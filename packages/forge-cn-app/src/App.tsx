import { useCallback, useEffect, useMemo, useState } from "react";
import {
  analyzeRedosRisk,
  buildHighlightParts,
  hasFlag,
  isValidRegExp,
  normalizeFlags,
  pushLocalHistory,
  toggleFlag,
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
    label: "身份证号",
    sample:
      "证件：11010119900307891X、44030119851212001X。无效：123456、1101011990030789123。",
    result: {
      pattern:
        "(?<!\\d)[1-9]\\d{5}(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx](?!\\d)",
      flags: "g",
      explanation: [
        { token: "[1-9]\\d{5}", description: "地区码 6 位（首位非 0）" },
        { token: "(?:19|20)\\d{2}", description: "出生年 1900–2099" },
        {
          token: "(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])",
          description: "出生月日",
        },
        { token: "\\d{3}[\\dXx]", description: "顺序码 3 位 + 校验位" },
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
        { token: "[\\u4e00-\\u9fa5]", description: "常用汉字 Unicode 范围" },
        { token: "{2,4}", description: "通常 2–4 个字（含复姓）" },
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
    label: "车牌号",
    sample: "车辆：京A12345、沪C88888、浙A1B2C3。无效：京12345、京A12。",
    result: {
      pattern: "[\\u4e00-\\u9fa5][A-HJ-NP-Z][A-HJ-NP-Z0-9]{5}",
      flags: "gi",
      explanation: [
        { token: "[\\u4e00-\\u9fa5]", description: "省份简称汉字" },
        { token: "[A-HJ-NP-Z]", description: "发牌机关字母（不含 I/O）" },
        { token: "[A-HJ-NP-Z0-9]{5}", description: "号牌序号 5 位" },
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
  const [copied, setCopied] = useState(false);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl");

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setShortcutLabel("⌘");
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
      pushLocalHistory({
        prompt: nextPrompt,
        pattern: next.pattern,
        flags: next.flags,
        testText: nextTest,
        explanation: next.explanation,
      });
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
      if (!refine) setActiveLabel(null);
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
    setActiveLabel(ex.label);
    remember(ex.result, ex.label, ex.sample);
  };

  const copyPattern = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(`/${result.pattern}/${flags}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isPro = hasPro || Boolean(usage?.isPro);
  const quotaLow =
    !isPro && usage != null && usage.remaining >= 0 && usage.remaining <= 1;
  const hasGenerated = Boolean(result);

  return (
    <div className="forge-cn">
      <div className="forge-cn__topbar forge-cn__enter">
        <div className="forge-cn__brand" aria-label="Forge Regex">
          <span className="forge-cn__mark" aria-hidden>
            /
          </span>
          <span className="forge-cn__brand-name">Forge Regex</span>
        </div>
        <div className="forge-cn__nav">
          {usage && !usage.needsAuth ? (
            <span
              className={`forge-cn__quota${
                isPro ? " forge-cn__quota--pro" : quotaLow ? " forge-cn__quota--low" : ""
              }`}
            >
              <span className="forge-cn__quota-dot" />
              {isPro
                ? "Pro"
                : usage.isGuest || !authenticated
                  ? `试用剩余 ${usage.remaining} 次`
                  : `今日剩余 ${usage.remaining} 次`}
            </span>
          ) : null}
          {!authenticated ? (
            <a className="forge-cn__link" href={boot.loginUrl}>
              登录
            </a>
          ) : null}
          <a className="forge-cn__link" href={boot.pricingUrl}>
            定价
          </a>
          {!isPro ? (
            <a className="forge-cn__btn-ink" href={boot.pricingUrl}>
              升级
            </a>
          ) : (
            <span className="forge-cn__quota forge-cn__quota--pro">已开通 Pro</span>
          )}
        </div>
      </div>

      <header
        className={`forge-cn__hero forge-cn__enter-2${
          hasGenerated ? " forge-cn__hero--compact" : ""
        }`}
      >
        <h1 className="forge-cn__title">
          {hasGenerated ? (
            "正则已生成"
          ) : (
            <>
              用中文描述规则。
              <br />
              得到正则表达式。
            </>
          )}
        </h1>
        {!hasGenerated ? (
          <p className="forge-cn__sub">
            别再死磕正则语法。说出你要匹配什么——我们帮你锻造可用表达式。
          </p>
        ) : null}
      </header>

      <div className="forge-cn__prompt-wrap forge-cn__enter-2">
        <label className="sr-only" htmlFor="forge-prompt" style={{ display: "none" }}>
          描述你想匹配的内容
        </label>
        <textarea
          id="forge-prompt"
          className="forge-cn__prompt"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="例如：匹配邮箱、手机号…"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void generate();
            }
          }}
        />
        <div className="forge-cn__prompt-bar">
          <span className="forge-cn__kbd">
            {shortcutLabel}
            <span style={{ opacity: 0.6 }}>↵</span>
          </span>
          <button
            type="button"
            className="forge-cn__btn-gen"
            disabled={loading || !prompt.trim()}
            onClick={() => void generate()}
          >
            {loading ? "生成中…" : "生成"}
          </button>
        </div>
      </div>

      <p className="forge-cn__examples-label forge-cn__enter-3">示例</p>
      <div className="forge-cn__examples forge-cn__enter-3">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            className={`forge-cn__chip${
              activeLabel === ex.label ? " forge-cn__chip--on" : ""
            }`}
            onClick={() => applyExample(ex)}
          >
            {ex.label}
          </button>
        ))}
      </div>

      {error || usage?.needsAuth ? (
        <p className="forge-cn__error" role="alert">
          {error || "试用次数已用完，请登录后继续。"}
        </p>
      ) : null}
      {usage?.needsAuth ? (
        <p className="forge-cn__gate">
          <a href={boot.loginUrl}>登录 SilentTrace 账号</a>
          后每天可免费生成 8 次；或 <a href={boot.pricingUrl}>开通 Pro</a>。
        </p>
      ) : null}
      {!isPro ? (
        <p className="forge-cn__hint">生成失败不扣次数。</p>
      ) : null}

      {result ? (
        <section className="forge-cn__result forge-cn__enter">
          <div className="forge-cn__result-head">生成的正则</div>
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
            <span>标志位</span>
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
            <p className="forge-cn__hint" style={{ margin: 0, width: "100%" }}>
              每次改写消耗 1 次生成额度（失败不扣次）。
            </p>
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

          <div className="forge-cn__test-block">
            <label className="forge-cn__label" htmlFor="forge-test">
              用文本测试
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
          </div>
        </section>
      ) : !loading ? (
        <div className="forge-cn__empty forge-cn__enter-3">
          <div className="forge-cn__empty-mark">.*</div>
          <p>在上方输入描述，或点选示例，看看 Forge 怎么工作。</p>
          <p style={{ color: "var(--forge-accent)", marginTop: "0.35rem" }}>
            ↑ 从「生成」开始
          </p>
        </div>
      ) : null}
    </div>
  );
}
