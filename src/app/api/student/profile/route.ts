import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Fetch student profile
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const student = await prisma.student.findUnique({
      where: { id: userId },
      select: {
        username: true,
        displayName: true,
        email: true,
      },
    });

    if (!student) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(student);
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
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { displayName, email } = body;

    const updated = await prisma.student.update({
      where: { id: userId },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(email !== undefined && { email }),
      },
      select: {
        username: true,
        displayName: true,
        email: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT profile error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
