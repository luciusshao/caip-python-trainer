import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const teacherId = request.headers.get("x-user-id");
    if (!teacherId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date().toISOString().split("T")[0];

    // Total students
    const totalStudents = await prisma.student.count({
      where: { teacherId, isActive: true },
    });

    // Active today
    const todayStart = new Date(today + "T00:00:00.000Z");
    const todayEnd = new Date(today + "T23:59:59.999Z");
    const activeToday = await prisma.student.count({
      where: {
        teacherId,
        isActive: true,
        lastLoginAt: { gte: todayStart, lte: todayEnd },
      },
    });

    // Average streak
    const streaks = await prisma.streak.findMany({
      where: { student: { teacherId, isActive: true } },
      select: { currentStreak: true },
    });
    const avgStreak =
      streaks.length > 0
        ? Math.round(
            streaks.reduce((sum, s) => sum + s.currentStreak, 0) /
              streaks.length * 10
          ) / 10
        : 0;

    // Average completion (% of lessons with quizPassed)
    const progresses = await prisma.learningProgress.findMany({
      where: { student: { teacherId, isActive: true } },
      select: { completedModules: true },
    });
    const totalModules = 5;
    const avgCompletion =
      progresses.length > 0
        ? Math.round(
            (progresses.reduce(
              (sum, p) => sum + p.completedModules.length,
              0
            ) /
              (progresses.length * totalModules)) *
              100
          )
        : 0;

    // Recent active students
    const recentStudents = await prisma.student.findMany({
      where: { teacherId, isActive: true, lastLoginAt: { not: null } },
      orderBy: { lastLoginAt: "desc" },
      take: 5,
      select: {
        id: true,
        displayName: true,
        username: true,
        lastLoginAt: true,
        progress: { select: { completedModules: true } },
      },
    });

    return NextResponse.json({
      totalStudents,
      activeToday,
      avgStreak,
      avgCompletion,
      recentStudents: recentStudents.map((s) => ({
        id: s.id,
        displayName: s.displayName,
        username: s.username,
        lastLoginAt: s.lastLoginAt,
        completedModules: s.progress?.completedModules.length ?? 0,
      })),
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
