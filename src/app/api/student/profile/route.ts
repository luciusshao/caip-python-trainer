import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// GET: Fetch student profile
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        username: true,
        displayName: true,
        user: { select: { email: true, passwordHash: true } },
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      username: profile.username,
      displayName: profile.displayName,
      email: profile.user.email,
      hasPassword: !!profile.user.passwordHash,
    });
  } catch (error) {
    console.error("GET profile error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// PUT: Update student profile
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { displayName, email } = body;

    const updated = await prisma.studentProfile.update({
      where: { userId: session.user.id },
      data: {
        ...(displayName !== undefined && { displayName }),
      },
      select: {
        username: true,
        displayName: true,
      },
    });

    // Only allow email updates for password-auth users. OAuth users get
    // their email from the provider and must not be able to change it here.
    if (email !== undefined) {
      const current = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { passwordHash: true },
      });
      if (current?.passwordHash) {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { email },
        });
      }
    }

    const userEmail = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });

    return NextResponse.json({
      username: updated.username,
      displayName: updated.displayName,
      email: userEmail?.email,
    });
  } catch (error) {
    console.error("PUT profile error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
