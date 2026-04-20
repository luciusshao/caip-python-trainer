import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createVerifyEmailToken } from "@/lib/tokens";
import { sendEmail, verifyEmailTemplate, getBaseUrl } from "@/lib/email";
import { verifyTurnstile } from "@/lib/turnstile";
import { features } from "@/lib/env";
import { limitAuth } from "@/lib/ratelimit";

/**
 * POST /api/auth/register
 * Body: { email, password, displayName?, turnstileToken? }
 *
 * Creates an unverified STUDENT User + sends verification email.
 * If Resend is not configured, the email is logged to console so dev flows
 * can still complete (token is identical — just click the logged link).
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP (10 req / 60s)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      "anonymous";
    const rate = await limitAuth(ip);
    if (!rate.success) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        { status: 429 }
      );
    }

    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const turnstileToken = typeof body.turnstileToken === "string" ? body.turnstileToken : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "邮箱和密码不能为空" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "密码至少需要 6 个字符" },
        { status: 400 }
      );
    }

    // Turnstile
    if (features.turnstile) {
      const ok = await verifyTurnstile(turnstileToken);
      if (!ok) {
        return NextResponse.json({ error: "人机验证失败" }, { status: 400 });
      }
    }

    // Uniqueness check
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // For security, don't reveal "email already registered". Return generic success
      // message so enumeration is harder. But we also can't send a new verify email
      // because that could be abused. Simplest: say account exists, tell user to log in.
      return NextResponse.json(
        { error: "该邮箱已注册，请直接登录或找回密码" },
        { status: 409 }
      );
    }

    // Create User + StudentProfile (role default STUDENT)
    const passwordHash = await hashPassword(password);
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email,
          name: displayName || email.split("@")[0],
          passwordHash,
          role: "STUDENT",
        },
      });
      await tx.studentProfile.create({
        data: {
          userId: u.id,
          displayName: displayName || email.split("@")[0],
        },
      });
      return u;
    });

    // Send verification email
    const token = await createVerifyEmailToken(email);
    const link = `${getBaseUrl()}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
    const tpl = verifyEmailTemplate(link);
    await sendEmail({ to: email, ...tpl });

    return NextResponse.json({
      success: true,
      userId: user.id,
      requiresEmailVerification: features.email,
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "注册失败，请稍后重试" },
      { status: 500 }
    );
  }
}
