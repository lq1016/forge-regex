import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  checkCnProxyQuota,
  clientIp,
  fingerprintFromRequest,
  incrementCnProxyQuota,
  parseCnProxyIdentity,
} from "@/lib/quota";
import { getCachedExcel, setCachedExcel } from "@/lib/excel-cache";
import {
  buildExcelSystemPrompt,
  dialectWarning,
  isExcelDialect,
  validateFormula,
  type ExcelDialect,
} from "@/lib/excel-prompt";

type ExplanationItem = {
  token: string;
  description: string;
};

type ExcelResponse = {
  formula?: string | null;
  assumptions?: string;
  explanation?: ExplanationItem[];
  impossible?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const cn = parseCnProxyIdentity(req);
    if (!cn) {
      return NextResponse.json(
        { error: "excel generate is CN-proxy only" },
        { status: 403 }
      );
    }

    const rawBody = await req.json();
    const body =
      rawBody && typeof rawBody === "object"
        ? (rawBody as Record<string, unknown>)
        : {};

    const prompt =
      typeof body.prompt === "string" ? body.prompt.trim().slice(0, 1500) : "";
    if (!prompt) {
      return NextResponse.json(
        { error: "请描述你想完成的计算。" },
        { status: 400 }
      );
    }

    let dialect: ExcelDialect = "excel365";
    if (body.dialect != null && body.dialect !== "") {
      if (!isExcelDialect(body.dialect)) {
        return NextResponse.json(
          { error: "未知的 Excel 版本。" },
          { status: 400 }
        );
      }
      dialect = body.dialect;
    }

    const ip = clientIp(req);
    const fp = fingerprintFromRequest(req, body.fp);
    const quotaCheck = checkCnProxyQuota(cn, ip, fp, "excel");
    if (quotaCheck.needsAuth) {
      return NextResponse.json(
        {
          error: "试用次数已用完，请登录 SilentTrace 账号后继续（每天 8 次）。",
          code: "sign_in_required",
          remaining: 0,
          limit: quotaCheck.limit,
          needsAuth: true,
          isGuest: true,
        },
        { status: 401 }
      );
    }
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        {
          error: "今日免费次数已用完。",
          remaining: 0,
          limit: quotaCheck.limit,
        },
        { status: 429 }
      );
    }

    const cached = getCachedExcel(prompt, dialect);
    if (cached) {
      const quota = incrementCnProxyQuota(cn, ip, fp, "excel");
      return NextResponse.json({
        ...cached,
        remaining: quota.remaining,
        limit: quota.limit,
        isGuest: quota.isGuest,
        cached: true,
      });
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json({ error: "AI 未配置" }, { status: 503 });
    }

    const client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
    });
    const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: buildExcelSystemPrompt(dialect) },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 600,
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
    } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: "模型返回为空" }, { status: 502 });
    }

    let data: ExcelResponse;
    try {
      data = JSON.parse(raw) as ExcelResponse;
    } catch {
      return NextResponse.json({ error: "无法解析模型结果" }, { status: 502 });
    }

    if (data.impossible || data.formula == null) {
      return NextResponse.json(
        { error: "这个需求没法用一条公式完成，请拆成更具体的计算。" },
        { status: 422 }
      );
    }

    const formula = String(data.formula).trim();
    const assumptions =
      typeof data.assumptions === "string"
        ? data.assumptions.trim().slice(0, 200)
        : "";
    if (!assumptions) {
      return NextResponse.json(
        { error: "模型未给出假设条件" },
        { status: 502 }
      );
    }

    const explanation = Array.isArray(data.explanation)
      ? data.explanation
          .filter(
            (item): item is ExplanationItem =>
              !!item &&
              typeof item === "object" &&
              typeof (item as { token?: unknown }).token === "string" &&
              typeof (item as { description?: unknown }).description === "string"
          )
          .slice(0, 5)
          .map((item) => ({
            token: item.token.trim().slice(0, 120),
            description: item.description.trim().slice(0, 120),
          }))
      : [];

    const validation = validateFormula(formula, dialect);
    if (!validation.ok && validation.kind === "structural") {
      return NextResponse.json(
        { error: "生成的公式结构无效，请重试。" },
        { status: 502 }
      );
    }

    const blocked = validation.ok ? validation.blocked : validation.blocked;
    const warning = blocked.length > 0 ? dialectWarning(blocked, dialect) : null;

    const payload = {
      formula,
      dialect,
      assumptions,
      explanation,
      warning,
    };
    setCachedExcel(prompt, dialect, payload);

    const quota = incrementCnProxyQuota(cn, ip, fp, "excel");
    return NextResponse.json({
      ...payload,
      remaining: quota.remaining,
      limit: quota.limit,
      isGuest: quota.isGuest,
      cached: false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/excel/generate]", message);
    return NextResponse.json({ error: "出错了，请重试。" }, { status: 500 });
  }
}
