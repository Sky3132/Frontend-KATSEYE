import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdminRoute = pathname.startsWith("/admin");
  const isUserRoute = pathname.startsWith("/user");

  if (!isAdminRoute && !isUserRoute) {
    return NextResponse.next();
  }

  const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001")
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");
  const serverApiBase = (process.env.API_BASE ?? apiBase)
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");

  const meRes = await fetch(`${serverApiBase}/api/users/me`, {
    headers: { cookie: req.headers.get("cookie") ?? "" },
    cache: "no-store",
  });

  if (meRes.status === 401) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (!meRes.ok) {
    return NextResponse.next();
  }

  const me = (await meRes.json()) as { role?: string };
  const role = String(me.role ?? "").toLowerCase();

  if (isAdminRoute && role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (isUserRoute && role !== "customer") {
    if (role === "user") {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/user/:path*"],
};
