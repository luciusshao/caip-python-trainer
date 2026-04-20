import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStudentProfileId } from "@/lib/session";

// GET: Fetch student's learning progress
export async function GET() {
  try {
    const studentId = await getStudentProfileId();
    if (!studentId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find or create learning progress
    let progress = await prisma.learningProgress.findUnique({
      where: { studentId },
    });
    if (!progress) {
      progress = await prisma.learningProgress.create({
        data: { studentId },
      });
    }

    let streak = await prisma.streak.findUnique({ where: { studentId } });
    if (!streak) {
      streak = await prisma.streak.create({ data: { studentId } });
    }

    const practiceAttempts = await prisma.practiceAttempt.findMany({
      where: { studentId },
    });

    const practiceProgress: Record<
      string,
      { completed: boolean; attempts: number }
    > = {};
    for (const pa of practiceAttempts) {
      practiceProgress[pa.moduleId] = {
        completed: pa.completed,
        attempts: pa.attempts,
      };
    }

    return NextResponse.json({
      currentModuleId: progress.currentModuleId,
      currentLessonId: progress.currentLessonId,
      currentStep: progress.currentStep,
      theoryLang: progress.theoryLang,
      lessonProgress: progress.lessonProgress,
      completedModules: progress.completedModules,
      mockExamUnlocked: progress.mockExamUnlocked,
      streak: {
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        lastActiveDate: streak.lastActiveDate,
        activeDays: streak.activeDays,
      },
      practiceProgress,
    });
  } catch (error) {
    console.error("GET progress error:", error);
    return NextResponse.json(
      { error: "Failed to fetch progress" },
      { status: 500 }
    );
  }
}

// PUT: Update student's learning progress
export async function PUT(request: NextRequest) {
  try {
    const studentId = await getStudentProfileId();
    if (!studentId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    await prisma.learningProgress.upsert({
      where: { studentId },
      update: {
        currentModuleId: body.currentModuleId,
        currentLessonId: body.currentLessonId,
        currentStep: body.currentStep,
        theoryLang: body.theoryLang,
        lessonProgress: body.lessonProgress ?? {},
        completedModules: body.completedModules ?? [],
        mockExamUnlocked: body.mockExamUnlocked ?? false,
      },
      create: {
        studentId,
        currentModuleId: body.currentModuleId ?? "m1",
        currentLessonId: body.currentLessonId ?? "m1-l1",
        currentStep: body.currentStep ?? "theory",
        theoryLang: body.theoryLang ?? "both",
        lessonProgress: body.lessonProgress ?? {},
        completedModules: body.completedModules ?? [],
        mockExamUnlocked: body.mockExamUnlocked ?? false,
      },
    });

    if (body.streak) {
      await prisma.streak.upsert({
        where: { studentId },
        update: {
          currentStreak: body.streak.currentStreak ?? 0,
          longestStreak: body.streak.longestStreak ?? 0,
          lastActiveDate: body.streak.lastActiveDate ?? null,
          activeDays: body.streak.activeDays ?? [],
        },
        create: {
          studentId,
          currentStreak: body.streak.currentStreak ?? 0,
          longestStreak: body.streak.longestStreak ?? 0,
          lastActiveDate: body.streak.lastActiveDate ?? null,
          activeDays: body.streak.activeDays ?? [],
        },
      });
    }

    if (body.practiceProgress) {
      for (const [moduleId, data] of Object.entries(body.practiceProgress)) {
        const pd = data as { completed: boolean; attempts: number };
        await prisma.practiceAttempt.upsert({
          where: { studentId_moduleId: { studentId, moduleId } },
          update: { completed: pd.completed, attempts: pd.attempts },
          create: {
            studentId,
            moduleId,
            completed: pd.completed,
            attempts: pd.attempts,
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT progress error:", error);
    return NextResponse.json(
      { error: "Failed to update progress" },
      { status: 500 }
    );
  }
}
