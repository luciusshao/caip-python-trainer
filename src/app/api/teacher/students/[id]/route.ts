import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeacherProfileId } from "@/lib/session";

// GET: Student detail with progress
export async function GET(
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
      include: {
        user: { select: { email: true, emailVerified: true } },
        progress: true,
        streak: true,
        practiceAttempts: true,
      },
    });

    if (!student || student.teacherId !== teacherId) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: student.id,
      username: student.username,
      displayName: student.displayName,
      email: student.user.email,
      lastLoginAt: student.lastLoginAt,
      emailVerified: student.user.emailVerified !== null,
      createdAt: student.createdAt,
      progress: student.progress,
      streak: student.streak,
      practiceAttempts: student.practiceAttempts,
    });
  } catch (error) {
    console.error("GET student detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch student" },
      { status: 500 }
    );
  }
}

// PUT: Update student info
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teacherId = await getTeacherProfileId();
    if (!teacherId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const student = await prisma.studentProfile.findUnique({
      where: { id },
      select: { teacherId: true, userId: true },
    });
    if (!student || student.teacherId !== teacherId) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const updated = await prisma.studentProfile.update({
      where: { id },
      data: {
        ...(body.displayName !== undefined && { displayName: body.displayName }),
      },
      include: { user: { select: { email: true } } },
    });

    if (body.email !== undefined) {
      await prisma.user.update({
        where: { id: student.userId },
        data: { email: body.email },
      });
    }

    return NextResponse.json({
      id: updated.id,
      displayName: updated.displayName,
      email: body.email !== undefined ? body.email : updated.user.email,
    });
  } catch (error) {
    console.error("PUT student error:", error);
    return NextResponse.json(
      { error: "Failed to update student" },
      { status: 500 }
    );
  }
}

// DELETE: Soft-delete (deactivate) student by marking User.isActive = false
export async function DELETE(
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
      select: { teacherId: true, userId: true },
    });
    if (!student || student.teacherId !== teacherId) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: student.userId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE student error:", error);
    return NextResponse.json(
      { error: "Failed to deactivate student" },
      { status: 500 }
    );
  }
}
