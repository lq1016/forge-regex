import { NextRequest, NextResponse } from "next/server";
import {
  clientIp,
  fingerprintFromRequest,
  getCnProxyUsage,
  getUsage,
  parseCnProxyIdentity,
  type QuotaTool,
} from "@/lib/quota";
import { resolveProEdition } from "@/lib/pro";

/**
 * GET /api/quota — remaining free usage (fingerprint ∩ IP ∩ email).
 * Pass ?fp= or header X-Forge-Fp for accurate guest trial remaining.
 * Pass X-Forge-Edition: cn|global (or ?edition=) for regional Pro.
 * CN embed: Flask proxy sends X-Forge-Proxy-Secret + CN user/pro headers.
 */
function parseTool(raw: string | null): QuotaTool {
  return raw === "excel" ? "excel" : "regex";
}

export async function GET(req: NextRequest) {
  const fp =
    fingerprintFromRequest(req) ||
    fingerprintFromRequest(req, req.nextUrl.searchParams.get("fp"));
  const cnProxy = parseCnProxyIdentity(req);
  const tool = parseTool(req.nextUrl.searchParams.get("tool"));
  if (cnProxy) {
    const usage = getCnProxyUsage(cnProxy, clientIp(req), fp, tool);
    return NextResponse.json({
      ...usage,
      edition: "cn",
      cnProxy: true,
      tool,
    });
  }
  const edition = resolveProEdition(req);
  const usage = await getUsage(clientIp(req), fp, edition);
  return NextResponse.json({ ...usage, edition });
}
