import { NextRequest, NextResponse } from "next/server";
import {
  clientIp,
  fingerprintFromRequest,
  getCnProxyUsage,
  getUsage,
  parseCnProxyIdentity,
} from "@/lib/quota";
import { resolveProEdition } from "@/lib/pro";

/**
 * GET /api/quota — remaining free usage (fingerprint ∩ IP ∩ email).
 * Pass ?fp= or header X-Forge-Fp for accurate guest trial remaining.
 * Pass X-Forge-Edition: cn|global (or ?edition=) for regional Pro.
 * CN embed: Flask proxy sends X-Forge-Proxy-Secret + CN user/pro headers.
 */
export async function GET(req: NextRequest) {
  const fp =
    fingerprintFromRequest(req) ||
    fingerprintFromRequest(req, req.nextUrl.searchParams.get("fp"));
  const cnProxy = parseCnProxyIdentity(req);
  if (cnProxy) {
    const usage = getCnProxyUsage(cnProxy, clientIp(req), fp);
    return NextResponse.json({ ...usage, edition: "cn", cnProxy: true });
  }
  const edition = resolveProEdition(req);
  const usage = await getUsage(clientIp(req), fp, edition);
  return NextResponse.json({ ...usage, edition });
}
