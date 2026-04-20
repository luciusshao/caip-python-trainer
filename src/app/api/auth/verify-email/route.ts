import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeVerifyEmailToken } from "@/lib/tokens";

/**
 * GET /api/auth/verify-email?token=...&email=...
 *
 * Validates the token, sets User.emailVerified = now(), then redirects to
 * /login with a success flag. Works with simple email clients by using GET.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") || "";
  const email = (searchParams.get("email") || "").trim().toLowerCase();

  if (!token || !email) {
    return NextResponse.redirect(new URL("/verify-email?status=invalid", request.url));
  }

  const ok = await consumeVerifyEmailToken(email, token);
  if (!ok) {
    return NextResponse.redirect(new URL("/verify-email?status=expired", request.url));
  }

  try {
    await prisma.user.update({
      where: { email },
      data: { emailVerified: new Date() },
    });
    return NextResponse.redirect(new URL("/verify-email?status=ok", request.url));
  } catch {
    return NextResponse.redirect(new URL("/verify-email?status=error", request.url));
  }
}
