import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Resolve the StudentProfile.id for the authenticated user.
 *
 * Learning data (progress, streak, attempts, token usage) all FK to
 * StudentProfile.id, NOT User.id. Route handlers use this helper instead
 * of threading session.user.id directly into queries.
 */
export async function getStudentProfileId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  return profile?.id ?? null;
}

/**
 * Resolve the TeacherProfile.id for the authenticated user.
 * Returns null if the user is not a teacher.
 */
export async function getTeacherProfileId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") {
    return null;
  }

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  return profile?.id ?? null;
}
