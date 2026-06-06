import { NextRequest, NextResponse } from "next/server";

// Cheap presence check only: if a session cookie exists, let the request
// through and let the server-side `auth()` in AdminLayout do the real
// validation. Edge-runtime JWT decoding was flaky and was kicking signed-in
// users back to /admin/login even when the server saw a valid session.
const SESSION_COOKIE_NAMES = [
  "ti_admin_session", // primary — our own HMAC cookie, immune to NextAuth hiccups
  "__Secure-authjs.session-token",
  "authjs.session-token",
];

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always forward the resolved pathname so AdminLayout (RSC) can detect the
  // login route and skip its own cookie-bounce — otherwise /admin/login loops.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  const passthrough = () =>
    NextResponse.next({ request: { headers: requestHeaders } });

  // Protect /admin, /parent and /learn. Cheap cookie-presence check only;
  // per-role authorization happens in each section's server layout.
  const isProtected =
    (pathname.startsWith("/admin") && pathname !== "/admin/login") ||
    pathname.startsWith("/parent") ||
    pathname.startsWith("/learn");
  if (!isProtected) {
    return passthrough();
  }
  const hasSession = SESSION_COOKIE_NAMES.some(
    (name) => req.cookies.get(name)?.value,
  );
  if (hasSession) {
    return passthrough();
  }
  // Non-admin sections bounce to the unified /login page.
  if (!pathname.startsWith("/admin")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  // Diagnostic: list every cookie name the request DID send so we can spot
  // whether the session cookie was renamed, dropped, or simply never issued.
  // Logs to the Next dev server console — does not leak to the browser.
  const cookieNames = req.cookies.getAll().map((c) => c.name);
  console.warn(
    `[middleware] bouncing → /admin/login (path=${pathname}) — cookies present: [${cookieNames.join(", ") || "(none)"}]`,
  );
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/parent",
    "/parent/:path*",
    "/learn",
    "/learn/:path*",
  ],
};
