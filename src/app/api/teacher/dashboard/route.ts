import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeacherProfileId } from "@/lib/session";

export async function GET() {
  try {
    const teacherId = await getTeacherProfileId();
    if (!teacherId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date().toISOString().split("T")[0];

    const totalStudents = await prisma.studentProfile.count({
      where: { teacherId, user: { isActive: true } },
    });

    const todayStart = new Date(today + "T00:00:00.000Z");
    const todayEnd = new Date(today + "T23:59:59.999Z");
    const activeToday = await prisma.studentProfile.count({
      where: {
        teacherId,
        user: { isActive: true },
        lastLoginAt: { gte: todayStart, lte: todayEnd },
      },
    });

    const streaks = await prisma.streak.findMany({
      where: { student: { teacherId, user: { isActive: true } } },
      select: { currentStreak: true },
    });
    const avgStreak =
      streaks.length > 0
        ? Math.round(
            (streaks.reduce((sum, s) => sum + s.currentStreak, 0) /
              streaks.length) *
              10
          ) / 10
        : 0;

    const progresses = await prisma.learningProgress.findMany({
      where: { student: { teacherId, user: { isActive: true } } },
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

    const recentStudents = await prisma.studentProfile.findMany({
      where: {
        teacherId,
        user: { isActive: true },
        lastLoginAt: { not: null },
      },
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
