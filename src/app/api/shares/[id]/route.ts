import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteShare, getShareById } from "@/lib/shares";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!id || id.length > 32) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const share = getShareById(id);
  if (!share) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({
    id: share.id,
    prompt: share.prompt,
    pattern: share.pattern,
    flags: share.flags,
    explanation: share.explanation,
    testText: share.testText,
    createdAt: share.createdAt,
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json(
      { error: "Sign in required.", code: "sign_in_required" },
      { status: 401 }
    );
  }
  const { id } = await ctx.params;
  const ok = deleteShare(id, session.email);
  if (!ok) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
