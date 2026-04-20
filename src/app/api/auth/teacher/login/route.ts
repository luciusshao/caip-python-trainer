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

    const teacher = await prisma.teacher.findUnique({
      where: { username },
    });

    if (!teacher) {
      return NextResponse.json(
        { error: "账号或密码错误" },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, teacher.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "账号或密码错误" },
        { status: 401 }
      );
    }

    const token = await signToken(
      { userId: teacher.id, role: "teacher" },
      "teacher"
    );

    const response = NextResponse.json({
      success: true,
      displayName: teacher.displayName,
    });

    setAuthCookie(response, token, "teacher");
    return response;
  } catch (error) {
    console.error("Teacher login error:", error);
    return NextResponse.json(
      { error: "服务器错误，请稍后重试" },
      { status: 500 }
    );
  }
}
