import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getCookieName } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── Public routes — no auth needed ────────────────────
  if (
    pathname === "/login" ||
    pathname === "/teacher/login" ||
    pathname.startsWith("/api/auth/")
  ) {
    return NextResponse.next();
  }

  // ─── Static / internal — skip ──────────────────────────
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(png|jpg|svg|ico|css|js)$/)
  ) {
    return NextResponse.next();
  }

  // ─── Teacher routes ────────────────────────────────────
  if (pathname.startsWith("/teacher") || pathname.startsWith("/api/teacher")) {
    const token = request.cookies.get(getCookieName("teacher"))?.value;
    if (!token) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/teacher/login", request.url));
    }

    const decoded = await verifyToken(token, "teacher");
    if (!decoded) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/teacher/login", request.url));
    }

    // Inject user info into request headers for API routes
    const response = NextResponse.next();
    response.headers.set("x-user-id", decoded.userId);
    response.headers.set("x-user-role", "teacher");
    return response;
  }

  // ─── Student API routes ────────────────────────────────
  if (pathname.startsWith("/api/student") || pathname === "/api/chat") {
    const token = request.cookies.get(getCookieName("student"))?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await verifyToken(token, "student");
    if (!decoded) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = NextResponse.next();
    response.headers.set("x-user-id", decoded.userId);
    response.headers.set("x-user-role", "student");
    return response;
  }

  // ─── Student page routes (/, /profile, /change-password) ──
  const studentPages = ["/", "/profile", "/change-password"];
  const isStudentPage =
    studentPages.includes(pathname) || pathname.startsWith("/profile");

  if (isStudentPage) {
    const token = request.cookies.get(getCookieName("student"))?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const decoded = await verifyToken(token, "student");
    if (!decoded) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Force password change on first login
    if (decoded.mustChangePassword && pathname !== "/change-password") {
      return NextResponse.redirect(
        new URL("/change-password", request.url)
      );
    }

    const response = NextResponse.next();
    response.headers.set("x-user-id", decoded.userId);
    response.headers.set("x-user-role", "student");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
