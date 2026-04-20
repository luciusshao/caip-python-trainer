import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "./auth.config";

/**
 * Edge-runtime middleware.
 *
 * Uses the lightweight `auth.config.ts` (no Prisma, no Node APIs) — the
 * full `auth.ts` with the Prisma adapter is Node-only and cannot run here.
 *
 * Downstream server-side code should still import `{ auth } from "@/auth"`
 * to get the full session with role, since role lives in the JWT claim.
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/auth/")) return NextResponse.next();

  const publicPages = [
    "/login",
    "/register",
    "/verify-email",
    "/forgot-password",
    "/reset-password",
  ];
  if (publicPages.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const session = req.auth;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = session.user?.role;

  const isTeacherRoute =
    pathname.startsWith("/teacher") || pathname.startsWith("/api/teacher");
  if (isTeacherRoute && role !== "TEACHER" && role !== "ADMIN") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
