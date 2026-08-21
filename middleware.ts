import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BLOCKED_HOST = "rage-agit.vercel.app";
const CANONICAL_HOST = "rageclan.site";

export function middleware(request: NextRequest) {
  if (request.nextUrl.hostname === BLOCKED_HOST) {
    const url = request.nextUrl.clone();
    url.hostname = CANONICAL_HOST;
    url.protocol = "https";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
