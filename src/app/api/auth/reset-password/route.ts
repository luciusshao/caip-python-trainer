import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { consumeResetPasswordToken } from "@/lib/tokens";
import { verifyTurnstile } from "@/lib/turnstile";
import { features } from "@/lib/env";

/**
 * POST /api/auth/reset-password
 * Body: { email, token, newPassword, turnstileToken? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const token = typeof body.token === "string" ? body.token : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    const turnstileToken = typeof body.turnstileToken === "string" ? body.turnstileToken : "";

    if (!email || !token || !newPassword) {
      return NextResponse.json(
        { error: "请求参数缺失" },
        { status: 400 }
      );
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "新密码至少需要 6 个字符" },
        { status: 400 }
      );
    }

    if (features.turnstile) {
      const ok = await verifyTurnstile(turnstileToken);
      if (!ok) {
        return NextResponse.json({ error: "人机验证失败" }, { status: 400 });
      }
    }

    const valid = await consumeResetPasswordToken(email, token);
    if (!valid) {
      return NextResponse.json(
        { error: "重置链接无效或已过期，请重新申请" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: "用户不存在" },
        { status: 404 }
      );
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({
        where: { email },
        data: { passwordHash, emailVerified: user.emailVerified ?? new Date() },
      }),
      // Invalidate any active sessions tied to the JWT — since we use JWT session,
      // we can't delete sessions from DB; rely on the password change forcing
      // user to reauth on all devices (JWT still exp-valid but now has wrong pw).
      // If we had DB sessions, we'd delete them here.
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "重置失败，请稍后重试" },
      { status: 500 }
    );
  }
}
