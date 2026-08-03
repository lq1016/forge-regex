import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listCloudHistory, replaceCloudHistory } from "@/lib/cloud-history";
import { isPro, resolveProEdition } from "@/lib/pro";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json(
      { error: "Sign in required.", code: "sign_in_required" },
      { status: 401 }
    );
  }
  const edition = resolveProEdition(req);
  if (!(await isPro(edition))) {
    return NextResponse.json(
      { error: "Pro required.", code: "pro_required" },
      { status: 403 }
    );
  }
  const items = listCloudHistory(session.email, 50);
  return NextResponse.json({
    items: items.map((h) => ({
      id: h.id,
      prompt: h.prompt,
      pattern: h.pattern,
      flags: h.flags,
      testText: h.testText,
      explanation: h.explanation,
      savedAt: h.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json(
      { error: "Sign in required.", code: "sign_in_required" },
      { status: 401 }
    );
  }
  const edition = resolveProEdition(req);
  if (!(await isPro(edition))) {
    return NextResponse.json(
      { error: "Pro required.", code: "pro_required" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const itemsRaw =
    body && typeof body === "object" && Array.isArray((body as { items?: unknown }).items)
      ? (body as { items: unknown[] }).items
      : null;
  if (!itemsRaw) {
    return NextResponse.json({ error: "items array required." }, { status: 400 });
  }

  const normalized = itemsRaw
    .slice(0, 50)
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      if (typeof r.pattern !== "string" || !r.pattern) return null;
      return {
        prompt: typeof r.prompt === "string" ? r.prompt : "",
        pattern: r.pattern,
        flags: typeof r.flags === "string" ? r.flags : "",
        testText: typeof r.testText === "string" ? r.testText : "",
        explanation: Array.isArray(r.explanation)
          ? (r.explanation as { token: string; description: string }[])
          : [],
        createdAt:
          typeof r.savedAt === "string"
            ? r.savedAt
            : typeof r.createdAt === "string"
              ? r.createdAt
              : undefined,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  const saved = replaceCloudHistory(session.email, normalized, 50);
  return NextResponse.json({
    ok: true,
    items: saved.map((h) => ({
      id: h.id,
      prompt: h.prompt,
      pattern: h.pattern,
      flags: h.flags,
      testText: h.testText,
      explanation: h.explanation,
      savedAt: h.createdAt,
    })),
  });
}
