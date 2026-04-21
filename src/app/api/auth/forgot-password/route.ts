import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createResetPasswordToken } from "@/lib/tokens";
import { sendEmail, resetPasswordTemplate, getBaseUrl } from "@/lib/email";
import { verifyTurnstile } from "@/lib/turnstile";
import { features } from "@/lib/env";
import { limitAuth } from "@/lib/ratelimit";

/**
 * POST /api/auth/forgot-password
 * Body: { email, turnstileToken? }
 *
 * Always returns a generic success message (to prevent email enumeration),
 * but only actually sends the reset email if the user exists.
 */
export async function POST(request: NextRequest) {
  try {
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
    const turnstileToken = typeof body.turnstileToken === "string" ? body.turnstileToken : "";

    if (!email) {
      return NextResponse.json({ error: "请填写邮箱" }, { status: 400 });
    }

    if (features.turnstile) {
      const ok = await verifyTurnstile(turnstileToken);
      if (!ok) {
        return NextResponse.json({ error: "人机验证失败" }, { status: 400 });
      }
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (user && user.passwordHash) {
      const token = await createResetPasswordToken(email);
      const link = `${getBaseUrl()}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
      const tpl = resetPasswordTemplate(link);
      const sendResult = await sendEmail({ to: email, ...tpl });
      if (!sendResult.ok) {
        // Mail provider rejected the send. Surface a generic service-unavailable
        // message — never include raw provider error (may leak account info).
        console.error(
          `[forgot-password] email send failed for ${email}:`,
          sendResult
        );
        return NextResponse.json(
          { error: "邮件服务暂时不可用，请稍后重试" },
          { status: 503 }
        );
      }
    } else if (user && !user.passwordHash) {
      // OAuth-only user — no password to reset. Silently do nothing.
      console.log(`[forgot-password] ${email} is OAuth-only; no email sent`);
    }
    // If user not found: silently no-op (prevent enumeration)

    return NextResponse.json({
      success: true,
      message: "如该邮箱已注册，我们将发送重置链接。请查收邮箱。",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "请求失败，请稍后重试" },
      { status: 500 }
    );
  }
}
