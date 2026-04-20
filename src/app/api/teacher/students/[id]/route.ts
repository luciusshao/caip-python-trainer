import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Student detail with progress
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teacherId = request.headers.get("x-user-id");
    if (!teacherId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
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
      email: student.email,
      lastLoginAt: student.lastLoginAt,
      mustChangePassword: student.mustChangePassword,
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
    const teacherId = request.headers.get("x-user-id");
    if (!teacherId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const student = await prisma.student.findUnique({ where: { id } });
    if (!student || student.teacherId !== teacherId) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const updated = await prisma.student.update({
      where: { id },
      data: {
        ...(body.displayName !== undefined && { displayName: body.displayName }),
        ...(body.email !== undefined && { email: body.email }),
      },
    });

    return NextResponse.json({
      id: updated.id,
      displayName: updated.displayName,
      email: updated.email,
    });
  } catch (error) {
    console.error("PUT student error:", error);
    return NextResponse.json(
      { error: "Failed to update student" },
      { status: 500 }
    );
  }
}

// DELETE: Soft-delete (deactivate) student
export async function DELETE(
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

    await prisma.student.update({
      where: { id },
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
