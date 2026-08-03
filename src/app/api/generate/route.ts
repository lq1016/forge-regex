import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  checkAndIncrement,
  checkCnProxyQuota,
  checkQuota,
  clientIp,
  fingerprintFromRequest,
  incrementCnProxyQuota,
  parseCnProxyIdentity,
} from "@/lib/quota";
import { getCachedRegex, setCachedRegex } from "@/lib/generate-cache";
import { resolveProEdition } from "@/lib/pro";
import { buildRefineUserMessage, isRefineMode } from "@/lib/refine";

/* ─── Types ─────────────────────────────────────────── */

type ExplanationItem = { token: string; description: string };

type GeneratedRegex = {
  pattern: string;
  flags: string;
  explanation: ExplanationItem[];
  sample?: string;
};

type LLMResponse = {
  regex: GeneratedRegex | null;
};

/* ─── System prompt (kept short for lower latency) ─── */

function buildSystemPrompt(locale: "en" | "zh"): string {
  const langRule =
    locale === "zh"
      ? "- Write explanation descriptions in Simplified Chinese."
      : "- Write explanation descriptions in English.";

  return `Regex expert. Return ONLY JSON:
{"regex":{"pattern":"...","flags":"g","explanation":[{"token":"...","description":"..."}],"sample":"..."}}
or {"regex":null} if impossible.

Rules:
- JS-compatible RegExp (PCRE-ish). Escape backslashes in JSON (\\\\d).
- Find-in-text by default: use g (and i if case-insensitive). No ^/$ unless user asks for full-string/exact validation.
- Max 4 short explanation items.
${langRule}
- "sample" must be a short realistic text (1–3 sentences or a few lines) that contains 2–4 clear matches for the pattern, plus ideally 1 near-miss that should NOT match. Keep sample under 280 characters.
- Prefer common interpretation when ambiguous.

HTML / crawler attribute extraction (critical):
- When the user wants the VALUE of an attribute (href, src, data-src, content, etc.) — e.g. “获取 href 的值”, “extract the URL” — the FULL match must BE that value only.
  Prefer lookbehind: (?<=href\\\\s*=\\\\s*['"])[^'"]+  (JS lookbehind is allowed).
  Do NOT return href=(['"])(.*?)\\\\1 where the full match includes href= and quotes.
- If you must use a capturing group, put the desired value in the LAST capturing group.
- Support BOTH single and double quotes.
- If the user asks for src AND data-src (or “或懒加载”), match EITHER attribute — do NOT require both on the same tag unless they say “同时包含”.
- Sample HTML must use the same quote styles your pattern accepts, and include at least one match.`;
}

/** High-frequency prompts → stable, tested patterns (bypass flaky LLM). */
function curatedOverride(prompt: string): GeneratedRegex | null {
  const key = prompt.trim().toLowerCase().replace(/\s+/g, " ");
  const table: { match: RegExp; value: GeneratedRegex }[] = [
    {
      match:
        /(extract|匹配|提取|获取|抽取|取出).{0,40}(img).{0,48}(src|data-src|懒加载)|(src).{0,12}(data-src).{0,24}(img)/i,
      value: {
        pattern: "(?<=(?:data-src|src)\\s*=\\s*['\"])[^'\"]+",
        flags: "gi",
        explanation: [
          {
            token: "(?<=(?:data-src|src)\\s*=\\s*['\"])",
            description: "紧跟在 src / data-src 引号后（不占匹配）",
          },
          {
            token: "[^'\"]+",
            description: "整段匹配即为图片 URL（兼容单双引号）",
          },
        ],
        sample:
          "<img src=\"a.jpg\" /><img data-src='lazy.webp' class=\"lazy\" /><img src='only.jpg' alt=\"x\">",
      },
    },
    {
      match:
        /(extract|匹配|提取|获取|抽取|取出|拿).{0,80}(href|a\s*标签|anchor)|(href).{0,24}(值|value|url)/i,
      value: {
        pattern: "(?<=href\\s*=\\s*['\"])[^'\"]+",
        flags: "gi",
        explanation: [
          {
            token: "(?<=href\\s*=\\s*['\"])",
            description: "紧跟在 href= 引号后（不占匹配）",
          },
          {
            token: "[^'\"]+",
            description: "整段匹配即为 URL 值（兼容单双引号）",
          },
        ],
        sample:
          "<a href=\"https://example.com/a\">A</a> <a href='/rel'>B</a> <span>href=notquoted</span>",
      },
    },
    {
      match: /(strip|去掉|移除|删除).{0,16}(html\s*标签|标签).{0,20}(纯文本|正文|plain)?/i,
      value: {
        pattern: "<[^>]+>",
        flags: "g",
        explanation: [
          { token: "<[^>]+>", description: "匹配任意 HTML 标签（替换为空即可清洗）" },
        ],
        sample: "<p>第一段<em>强调</em></p><div>第二段</div>",
      },
    },
  ];
  for (const row of table) {
    if (row.match.test(key)) return row.value;
  }
  return null;
}

/* ─── Route handler ─────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = body.prompt;
    const cnProxy = parseCnProxyIdentity(req);
    const locale: "en" | "zh" = cnProxy
      ? "zh"
      : body.locale === "zh"
        ? "zh"
        : "en";
    const fp = fingerprintFromRequest(req, body.fp);
    const refineRaw = body.refine;
    const refine =
      refineRaw &&
      typeof refineRaw === "object" &&
      isRefineMode((refineRaw as { mode?: unknown }).mode) &&
      typeof (refineRaw as { pattern?: unknown }).pattern === "string" &&
      (refineRaw as { pattern: string }).pattern.length > 0
        ? {
            mode: (refineRaw as { mode: import("@/lib/refine").RefineMode }).mode,
            pattern: String((refineRaw as { pattern: string }).pattern).slice(
              0,
              4000
            ),
            flags: String((refineRaw as { flags?: string }).flags || "").slice(
              0,
              16
            ),
          }
        : null;

    if (
      !refine &&
      (!prompt || typeof prompt !== "string" || !prompt.trim())
    ) {
      return NextResponse.json(
        { error: "Please provide a description of the pattern you want to match." },
        { status: 400 }
      );
    }

    const ip = clientIp(req);
    const edition = resolveProEdition(req);
    const quotaCheck = cnProxy
      ? checkCnProxyQuota(cnProxy, ip, fp)
      : await checkQuota(ip, fp, edition);
    if (quotaCheck.needsAuth) {
      return NextResponse.json(
        {
          error: cnProxy
            ? "试用次数已用完，请登录 SilentTrace 账号后继续（每天 8 次）。"
            : locale === "zh"
              ? "试用次数已用完，请用邮箱登录后继续（每天 8 次）。"
              : "Free trial used up. Sign in with email for 8 generations per day.",
          code: "sign_in_required",
          remaining: 0,
          limit: quotaCheck.limit,
          isPro: false,
          needsAuth: true,
          isGuest: true,
        },
        { status: 401 }
      );
    }
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        {
          error:
            locale === "zh"
              ? "今日免费次数已用完。开通 Pro 可继续使用。"
              : "Daily free limit reached. Upgrade to Pro.",
          remaining: 0,
          limit: quotaCheck.limit,
          isPro: false,
        },
        { status: 429 }
      );
    }

    const bumpQuota = () =>
      cnProxy
        ? Promise.resolve(incrementCnProxyQuota(cnProxy, ip, fp))
        : checkAndIncrement(ip, fp, edition);

    const trimmed = (
      typeof prompt === "string" ? prompt : ""
    )
      .trim()
      .slice(0, 1500);

    // Refine always hits the model (skip curated/cache so we don't return the same pattern).
    if (!refine) {
      const curated = curatedOverride(trimmed);
      if (curated) {
        const quota = await bumpQuota();
        setCachedRegex(trimmed, curated);
        return NextResponse.json({
          pattern: curated.pattern,
          flags: curated.flags || "",
          explanation: curated.explanation,
          sample: curated.sample || "",
          remaining: quota.remaining,
          limit: quota.limit,
          isPro: quota.isPro,
          cached: false,
          curated: true,
        });
      }

      const cached = getCachedRegex(trimmed);
      if (cached) {
        const quota = await bumpQuota();
        return NextResponse.json({
          pattern: cached.pattern,
          flags: cached.flags || "",
          explanation: cached.explanation,
          sample: cached.sample || "",
          remaining: quota.remaining,
          limit: quota.limit,
          isPro: quota.isPro,
          cached: true,
        });
      }
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json(
        { error: "AI is not configured. Set DEEPSEEK_API_KEY in .env.local." },
        { status: 503 }
      );
    }

    const client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
    });
    const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

    const userContent = refine
      ? buildRefineUserMessage({
          locale,
          mode: refine.mode,
          basePrompt: trimmed,
          pattern: refine.pattern,
          flags: refine.flags,
        })
      : trimmed;

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt(locale) },
        { role: "user", content: userContent },
      ],
      temperature: 0,
      max_tokens: 500,
      response_format: { type: "json_object" },
      // DeepSeek V4: disable thinking mode (default can add multi-second latency)
      thinking: { type: "disabled" },
    } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(
        { error: "AI returned an empty response. Please try again." },
        { status: 502 }
      );
    }

    let data: LLMResponse;
    try {
      data = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 502 }
      );
    }

    if (!data.regex) {
      return NextResponse.json(
        {
          error:
            "The AI couldn't generate a valid regex for this description. Try being more specific.",
        },
        { status: 422 }
      );
    }

    const { pattern, flags, explanation, sample } = data.regex;

    if (!pattern || typeof pattern !== "string") {
      return NextResponse.json(
        { error: "Generated regex pattern is invalid. Please try again." },
        { status: 502 }
      );
    }

    try {
      new RegExp(pattern, flags);
    } catch {
      return NextResponse.json(
        {
          error:
            "Generated regex failed validation. Please try rephrasing your request.",
        },
        { status: 502 }
      );
    }

    const sampleText =
      typeof sample === "string" ? sample.trim().slice(0, 280) : "";

    const result = {
      pattern,
      flags: flags || "",
      explanation: Array.isArray(explanation) ? explanation.slice(0, 4) : [],
      sample: sampleText,
    };

    if (!refine && trimmed) {
      setCachedRegex(trimmed, result);
    }

    // Only successful generations consume quota (failed paths above return earlier).
    const quota = await bumpQuota();

    return NextResponse.json({
      ...result,
      remaining: quota.remaining,
      limit: quota.limit,
      isPro: quota.isPro,
      cached: false,
      refined: Boolean(refine),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/generate]", message);
    const friendly = /model/i.test(message)
      ? "AI model is misconfigured. Set DEEPSEEK_MODEL to deepseek-v4-flash or deepseek-v4-pro."
      : "Something went wrong. Please try again.";
    return NextResponse.json({ error: friendly }, { status: 500 });
  }
}
