import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Google Search Console HTML file verification.
 * Next 16 does not serve arbitrary .html/.txt from /public, and may strip
 * the ".html" suffix before routing — handle both path forms.
 */
const GOOGLE_VERIFY_BODY = "google-site-verification: googled3628dff84dc4290.html\n";

function isGoogleVerifyPath(pathname: string): boolean {
  return (
    pathname === "/googled3628dff84dc4290.html" ||
    pathname === "/googled3628dff84dc4290"
  );
}

export function middleware(request: NextRequest) {
  if (isGoogleVerifyPath(request.nextUrl.pathname)) {
    return new NextResponse(GOOGLE_VERIFY_BODY, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/googled3628dff84dc4290.html", "/googled3628dff84dc4290"],
};
