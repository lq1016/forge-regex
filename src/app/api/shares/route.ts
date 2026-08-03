import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isPro, resolveProEdition } from "@/lib/pro";
import { createShare, listSharesByEmail } from "@/lib/shares";

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/** Public share path: /r/{id} (EN) or /cn/r/{id} (CN). */
function sharePath(id: string, edition: "cn" | "global"): string {
  return edition === "cn" ? `/cn/r/${id}` : `/r/${id}`;
}

function shareUrl(id: string, edition: "cn" | "global"): string {
  return `${appUrl()}${sharePath(id, edition)}`;
}

export async function GET(req: NextRequest) {
  const edition = resolveProEdition(req);
  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json(
      { error: "Sign in required.", code: "sign_in_required" },
      { status: 401 }
    );
  }
  // List if Pro on this site OR the other edition (CN Pro users often hit /shares by mistake).
  const proHere = await isPro(edition);
  const other: "cn" | "global" = edition === "cn" ? "global" : "cn";
  const proOther = await isPro(other);
  if (!proHere && !proOther) {
    return NextResponse.json(
      { error: "Pro required.", code: "pro_required" },
      { status: 403 }
    );
  }
  const linkEdition = proHere ? edition : other;
  const shares = listSharesByEmail(session.email).map((s) => ({
    id: s.id,
    prompt: s.prompt,
    pattern: s.pattern,
    flags: s.flags,
    createdAt: s.createdAt,
    url: shareUrl(s.id, linkEdition),
    path: sharePath(s.id, linkEdition),
  }));
  return NextResponse.json({ shares });
}

export async function POST(req: NextRequest) {
  try {
    const edition = resolveProEdition(req);
    const session = await getSession();
    if (!session?.email) {
      return NextResponse.json(
        { error: "Sign in required.", code: "sign_in_required" },
        { status: 401 }
      );
    }
    if (!(await isPro(edition))) {
      return NextResponse.json(
        {
          error: "Sharing requires Pro. Upgrade to create a public link.",
          code: "share_needs_pro",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const pattern = typeof body?.pattern === "string" ? body.pattern : "";
    if (!pattern.trim()) {
      return NextResponse.json(
        { error: "Pattern is required.", code: "pattern_required" },
        { status: 400 }
      );
    }

    const explanation = Array.isArray(body?.explanation)
      ? body.explanation
          .filter(
            (x: unknown) =>
              x &&
              typeof x === "object" &&
              typeof (x as { token?: unknown }).token === "string" &&
              typeof (x as { description?: unknown }).description === "string"
          )
          .map((x: { token: string; description: string }) => ({
            token: x.token,
            description: x.description,
          }))
      : [];

    const share = createShare({
      email: session.email,
      prompt: typeof body?.prompt === "string" ? body.prompt : "",
      pattern,
      flags: typeof body?.flags === "string" ? body.flags : "",
      explanation,
      testText: typeof body?.testText === "string" ? body.testText : "",
    });

    const url = shareUrl(share.id, edition);
    return NextResponse.json({
      ok: true,
      id: share.id,
      url,
      path: sharePath(share.id, edition),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Create failed";
    console.error("[api/shares]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
