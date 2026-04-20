import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, generatePassword } from "@/lib/auth";

// GET: List all students for this teacher
export async function GET(request: NextRequest) {
  try {
    const teacherId = request.headers.get("x-user-id");
    if (!teacherId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";

    const students = await prisma.student.findMany({
      where: {
        teacherId,
        isActive: true,
        ...(query && {
          OR: [
            { displayName: { contains: query, mode: "insensitive" } },
            { username: { contains: query, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        lastLoginAt: true,
        mustChangePassword: true,
        createdAt: true,
        progress: {
          select: { completedModules: true, lessonProgress: true },
        },
      },
    });

    const result = students.map((s) => {
      const lessonProgress = (s.progress?.lessonProgress ?? {}) as Record<
        string,
        { quizPassed?: boolean }
      >;
      const totalLessons = Object.keys(lessonProgress).length;
      const passedLessons = Object.values(lessonProgress).filter(
        (p) => p.quizPassed
      ).length;

      return {
        id: s.id,
        username: s.username,
        displayName: s.displayName,
        email: s.email,
        lastLoginAt: s.lastLoginAt,
        mustChangePassword: s.mustChangePassword,
        createdAt: s.createdAt,
        completedModules: s.progress?.completedModules.length ?? 0,
        completionPercent:
          totalLessons > 0
            ? Math.round((passedLessons / totalLessons) * 100)
            : 0,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET students error:", error);
    return NextResponse.json(
      { error: "Failed to fetch students" },
      { status: 500 }
    );
  }
}

// POST: Create a new student
export async function POST(request: NextRequest) {
  try {
    const teacherId = request.headers.get("x-user-id");
    if (!teacherId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { displayName, username } = body;

    if (!displayName || !username) {
      return NextResponse.json(
        { error: "姓名和账号不能为空" },
        { status: 400 }
      );
    }

    // Check username uniqueness
    const existing = await prisma.student.findUnique({
      where: { username },
    });
    if (existing) {
      return NextResponse.json(
        { error: "该账号已存在" },
        { status: 409 }
      );
    }

    const initialPassword = generatePassword(8);
    const passwordHash = await hashPassword(initialPassword);

    const student = await prisma.student.create({
      data: {
        username,
        displayName,
        passwordHash,
        mustChangePassword: true,
        teacherId,
      },
    });

    // Create related records
    await prisma.learningProgress.create({
      data: { studentId: student.id },
    });

    await prisma.streak.create({
      data: { studentId: student.id },
    });

    return NextResponse.json({
      id: student.id,
      username: student.username,
      displayName: student.displayName,
      initialPassword, // Only returned once!
    });
  } catch (error) {
    console.error("POST student error:", error);
    return NextResponse.json(
      { error: "Failed to create student" },
      { status: 500 }
    );
  }
}
