import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter }) as unknown as InstanceType<typeof PrismaClient>;

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  const teacher = await prisma.teacher.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash,
      displayName: "Admin Teacher",
      email: "admin@caip-trainer.local",
    },
  });

  console.log("Seeded teacher:", teacher.username, "(password: admin123)");

  // Create a test student for development
  const studentHash = await bcrypt.hash("test123", 10);

  const student = await prisma.student.upsert({
    where: { username: "student01" },
    update: {},
    create: {
      username: "student01",
      passwordHash: studentHash,
      displayName: "Test Student",
      mustChangePassword: true,
      teacherId: teacher.id,
    },
  });

  // Create related records
  await prisma.learningProgress.upsert({
    where: { studentId: student.id },
    update: {},
    create: { studentId: student.id },
  });

  await prisma.streak.upsert({
    where: { studentId: student.id },
    update: {},
    create: { studentId: student.id },
  });

  console.log(
    "Seeded student:",
    student.username,
    "(password: test123, mustChangePassword: true)"
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
