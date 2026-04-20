import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter }) as unknown as InstanceType<typeof PrismaClient>;

/**
 * Seed creates three development accounts under the unified User model:
 *   1. admin  (ADMIN)    — admin@caip-trainer.local / admin123   (sees all students)
 *   2. student01 (STUDENT) — student01@caip-trainer.local / test123
 *   3. (optional) root admin for future  — not seeded here
 *
 * OAuth-only users (Google/GitHub) are created on-the-fly by NextAuth.
 */
async function main() {
  // ── Admin ───────────────────────────────────────────
  const adminHash = await bcrypt.hash("admin123", 10);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@caip-trainer.local" },
    update: { role: "ADMIN" },
    create: {
      email: "admin@caip-trainer.local",
      emailVerified: new Date(), // pre-verified for dev convenience
      name: "Admin",
      role: "ADMIN",
      passwordHash: adminHash,
      teacherProfile: {
        create: {
          username: "admin",
          displayName: "Admin",
        },
      },
    },
    include: { teacherProfile: true },
  });
  console.log(
    "Seeded admin:",
    adminUser.email,
    "(username: admin, password: admin123, role: ADMIN)"
  );

  if (!adminUser.teacherProfile) throw new Error("Admin teacher profile missing");

  // ── Test Student ────────────────────────────────────
  const studentHash = await bcrypt.hash("test123", 10);
  const studentUser = await prisma.user.upsert({
    where: { email: "student01@caip-trainer.local" },
    update: {},
    create: {
      email: "student01@caip-trainer.local",
      emailVerified: new Date(),
      name: "Test Student",
      role: "STUDENT",
      passwordHash: studentHash,
      studentProfile: {
        create: {
          username: "student01",
          displayName: "Test Student",
          teacherId: adminUser.teacherProfile.id,
        },
      },
    },
    include: { studentProfile: true },
  });

  if (!studentUser.studentProfile) throw new Error("Student profile missing");
  const studentProfileId = studentUser.studentProfile.id;

  // ── Student learning data ──────────────────────────
  await prisma.learningProgress.upsert({
    where: { studentId: studentProfileId },
    update: {},
    create: { studentId: studentProfileId },
  });

  await prisma.streak.upsert({
    where: { studentId: studentProfileId },
    update: {},
    create: { studentId: studentProfileId },
  });

  console.log(
    "Seeded student:",
    studentUser.email,
    "(username: student01, password: test123)"
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
