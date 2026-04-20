import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, generatePassword } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teacherId = request.headers.get("x-user-id");
    if (!teacherId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const student = await prisma.student.findUnique({ where: { id } });
    if (!student || student.teacherId !== teacherId) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const newPassword = generatePassword(8);
    const passwordHash = await hashPassword(newPassword);

    await prisma.student.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
    });

    // TODO Phase 4: Send email if student has email registered
    // For now, return the password to the teacher
    if (student.email) {
      console.log(
        `[DEV] Password reset email would be sent to ${student.email} for ${student.username}: ${newPassword}`
      );
    }

    return NextResponse.json({
      success: true,
      newPassword, // Teacher shows this once
      emailSent: !!student.email,
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
