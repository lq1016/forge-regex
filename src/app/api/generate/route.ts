import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createHash } from "crypto";
import { checkAndIncrement } from "@/lib/quota";

/* ─── Helpers ──────────────────────────────────────── */

function getIpHash(req: NextRequest): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

/* ─── Types ─────────────────────────────────────────── */

type ExplanationItem = { token: string; description: string };

type GeneratedRegex = {
  pattern: string;
  flags: string;
  explanation: ExplanationItem[];
};

type LLMResponse = {
  regex: GeneratedRegex;
};

/* ─── System prompt ─────────────────────────────────── */

const SYSTEM_PROMPT = `You are a regex expert. Your job is to translate natural-language descriptions into correct, production-ready regular expressions.

Given a user's description, produce a JSON object with this exact shape:

{
  "regex": {
    "pattern": "the regex pattern without delimiters",
    "flags": "flags like gi, gm, g, i, or empty string",
    "explanation": [
      { "token": "a regex fragment", "description": "what it matches in plain English" }
    ]
  }
}

Rules:
- Use PCRE (Perl-Compatible Regular Expression) syntax.
- Escape all backslashes in the JSON string properly (e.g. \\\\d for \\d).
- The pattern must be valid when used with \`new RegExp(pattern, flags)\`.
- Break the explanation into logical fragments — each significant token group gets its own entry.
- Use simple, precise English for descriptions. Target developers who might not know regex.
- If the user's request is ambiguous, pick the most common interpretation.
- For edge cases (empty string, special characters, unicode), add a note in the explanation.
- If the request doesn't make sense as a regex, respond with {"regex": null} and explain why.`;

/* ─── Route handler ─────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "Please provide a description of the pattern you want to match." },
        { status: 400 }
      );
    }

    /* ─── Quota check ──────────────────────────────── */
    const quota = await checkAndIncrement(getIpHash(req));
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: "Daily free limit reached. Upgrade to unlimited.",
          remaining: 0,
          limit: quota.limit,
        },
        { status: 429 }
      );
    }

    /* Prod: call DeepSeek */
    const client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY || "",
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
    });
    const completion = await client.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Generate a regex to: ${prompt.trim()}`,
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(
        { error: "AI returned an empty response. Please try again." },
        { status: 502 }
      );
    }

    /* Parse JSON response */
    let data: LLMResponse;
    try {
      data = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 502 }
      );
    }

    /* Validate */
    if (!data.regex) {
      return NextResponse.json(
        {
          error:
            "The AI couldn't generate a valid regex for this description. Try being more specific.",
        },
        { status: 422 }
      );
    }

    const { pattern, flags, explanation } = data.regex;

    if (!pattern || typeof pattern !== "string") {
      return NextResponse.json(
        { error: "Generated regex pattern is invalid. Please try again." },
        { status: 502 }
      );
    }

    /* Validate the regex compiles */
    try {
      new RegExp(pattern, flags);
    } catch {
      return NextResponse.json(
        { error: "Generated regex failed validation. Please try rephrasing your request." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      pattern,
      flags: flags || "",
      explanation: Array.isArray(explanation) ? explanation : [],
      remaining: quota.remaining,
      limit: quota.limit,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error";
    console.error("[api/generate]", message);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
