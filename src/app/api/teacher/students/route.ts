import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, generatePassword } from "@/lib/password";
import { getTeacherProfileId } from "@/lib/session";

// GET: List all students for this teacher
export async function GET(request: NextRequest) {
  try {
    const teacherId = await getTeacherProfileId();
    if (!teacherId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";

    const students = await prisma.studentProfile.findMany({
      where: {
        teacherId,
        user: { isActive: true },
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
        lastLoginAt: true,
        createdAt: true,
        user: { select: { email: true, emailVerified: true } },
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
        email: s.user.email,
        lastLoginAt: s.lastLoginAt,
        mustChangePassword: false, // legacy field; new auth uses emailVerified
        emailVerified: s.user.emailVerified !== null,
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

// POST: Create a new student (teacher-provisioned account)
export async function POST(request: NextRequest) {
  try {
    const teacherId = await getTeacherProfileId();
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

    // Generate a synthetic email so the User row has a unique identifier.
    // Teacher-provisioned students can update to a real email later.
    const syntheticEmail = `${username}@caip-trainer.local`.toLowerCase();

    // Check username / email uniqueness
    const existingProfile = await prisma.studentProfile.findUnique({
      where: { username },
    });
    if (existingProfile) {
      return NextResponse.json({ error: "该账号已存在" }, { status: 409 });
    }
    const existingUser = await prisma.user.findUnique({
      where: { email: syntheticEmail },
    });
    if (existingUser) {
      return NextResponse.json({ error: "该账号已存在" }, { status: 409 });
    }

    const initialPassword = generatePassword(8);
    const passwordHash = await hashPassword(initialPassword);

    // Create User + StudentProfile + related records in a transaction
    const studentProfile = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: syntheticEmail,
          emailVerified: new Date(), // teacher-provisioned; skip email verification
          name: displayName,
          role: "STUDENT",
          passwordHash,
        },
      });

      const profile = await tx.studentProfile.create({
        data: {
          userId: user.id,
          username,
          displayName,
          teacherId,
        },
      });

      await tx.learningProgress.create({ data: { studentId: profile.id } });
      await tx.streak.create({ data: { studentId: profile.id } });

      return profile;
    });

    return NextResponse.json({
      id: studentProfile.id,
      username: studentProfile.username,
      displayName: studentProfile.displayName,
      initialPassword, // shown only once
    });
  } catch (error) {
    console.error("POST student error:", error);
    return NextResponse.json(
      { error: "Failed to create student" },
      { status: 500 }
    );
  }
}
