import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken, setAuthCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "账号和密码不能为空" },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { username },
    });

    if (!student || !student.isActive) {
      return NextResponse.json(
        { error: "账号或密码错误" },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, student.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "账号或密码错误" },
        { status: 401 }
      );
    }

    // Update last login time
    await prisma.student.update({
      where: { id: student.id },
      data: { lastLoginAt: new Date() },
    });

    // Sign JWT
    const token = await signToken(
      {
        userId: student.id,
        role: "student",
        mustChangePassword: student.mustChangePassword,
      },
      "student"
    );

    const response = NextResponse.json({
      success: true,
      mustChangePassword: student.mustChangePassword,
      displayName: student.displayName,
    });

    setAuthCookie(response, token, "student");
    return response;
  } catch (error) {
    console.error("Student login error:", error);
    return NextResponse.json(
      { error: "服务器错误，请稍后重试" },
      { status: 500 }
    );
  }
}
