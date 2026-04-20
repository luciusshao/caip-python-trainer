import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  hashPassword,
  signToken,
  setAuthCookie,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "请填写当前密码和新密码" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "新密码至少需要 6 个字符" },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { id: userId },
    });

    if (!student) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const valid = await verifyPassword(currentPassword, student.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "当前密码不正确" },
        { status: 401 }
      );
    }

    // Update password and clear mustChangePassword flag
    const newHash = await hashPassword(newPassword);
    await prisma.student.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    });

    // Re-sign JWT with updated mustChangePassword
    const token = await signToken(
      {
        userId: student.id,
        role: "student",
        mustChangePassword: false,
      },
      "student"
    );

    const response = NextResponse.json({ success: true });
    setAuthCookie(response, token, "student");
    return response;
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "服务器错误，请稍后重试" },
      { status: 500 }
    );
  }
}
