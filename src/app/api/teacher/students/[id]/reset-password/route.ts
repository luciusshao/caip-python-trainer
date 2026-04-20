import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, generatePassword } from "@/lib/password";
import { getTeacherProfileId } from "@/lib/session";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teacherId = await getTeacherProfileId();
    if (!teacherId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const student = await prisma.studentProfile.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!student || student.teacherId !== teacherId) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const newPassword = generatePassword(8);
    const passwordHash = await hashPassword(newPassword);

    // Password lives on User. Invalidate all active sessions by deleting them.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: student.user.id },
        data: { passwordHash },
      }),
      prisma.session.deleteMany({ where: { userId: student.user.id } }),
    ]);

    // TODO Phase 4: Send email via Resend
    const isSyntheticEmail = student.user.email.endsWith("@caip-trainer.local");
    if (!isSyntheticEmail) {
      console.log(
        `[DEV] Password reset email would be sent to ${student.user.email} for ${student.username}: ${newPassword}`
      );
    }

    return NextResponse.json({
      success: true,
      newPassword,
      emailSent: !isSyntheticEmail,
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
