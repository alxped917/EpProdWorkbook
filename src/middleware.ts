import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [/^\/login$/, /^\/api\/auth\/login$/, /^\/api\/webhooks\//, /^\/api\/cron\//];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((pattern) => pattern.test(pathname))) return NextResponse.next();
  const token = request.cookies.get("ep_session")?.value;
  if (token) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
