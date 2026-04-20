import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const teacherId = request.headers.get("x-user-id");
    if (!teacherId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse range parameter
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "30d";

    let dateFilter: Date | undefined;
    const now = new Date();
    if (range === "7d") {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === "30d") {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    // "all" → no date filter

    // Get this teacher's student IDs
    const students = await prisma.student.findMany({
      where: { teacherId, isActive: true },
      select: { id: true, displayName: true, username: true },
    });
    const studentIds = students.map((s) => s.id);

    if (studentIds.length === 0) {
      return NextResponse.json({
        summary: { totalTokens: 0, totalPrompt: 0, totalCompletion: 0, totalRequests: 0 },
        byStudent: [],
        byDate: [],
        byModel: [],
      });
    }

    const whereClause = {
      studentId: { in: studentIds },
      ...(dateFilter ? { createdAt: { gte: dateFilter } } : {}),
    };

    // Summary aggregation
    const summary = await prisma.tokenUsage.aggregate({
      where: whereClause,
      _sum: {
        totalTokens: true,
        promptTokens: true,
        completionTokens: true,
      },
      _count: true,
    });

    // By student aggregation
    const byStudentRaw = await prisma.tokenUsage.groupBy({
      by: ["studentId"],
      where: whereClause,
      _sum: { totalTokens: true },
      _count: true,
      orderBy: { _sum: { totalTokens: "desc" } },
    });

    const studentMap = new Map(students.map((s) => [s.id, s]));
    const byStudent = byStudentRaw.map((row) => {
      const student = studentMap.get(row.studentId);
      return {
        studentId: row.studentId,
        displayName: student?.displayName || "Unknown",
        username: student?.username || "unknown",
        totalTokens: row._sum.totalTokens || 0,
        requests: row._count,
      };
    });

    // By date aggregation — use raw query for DATE grouping
    const dateCondition = dateFilter
      ? `AND tu."createdAt" >= '${dateFilter.toISOString()}'`
      : "";
    const studentIdList = studentIds.map((id) => `'${id}'`).join(",");

    const byDateRaw: Array<{ date: string; total_tokens: bigint; requests: bigint }> =
      await prisma.$queryRawUnsafe(`
        SELECT
          TO_CHAR(tu."createdAt", 'YYYY-MM-DD') as date,
          SUM(tu."totalTokens")::bigint as total_tokens,
          COUNT(*)::bigint as requests
        FROM "TokenUsage" tu
        WHERE tu."studentId" IN (${studentIdList})
        ${dateCondition}
        GROUP BY TO_CHAR(tu."createdAt", 'YYYY-MM-DD')
        ORDER BY date ASC
      `);

    const byDate = byDateRaw.map((row) => ({
      date: row.date,
      totalTokens: Number(row.total_tokens),
      requests: Number(row.requests),
    }));

    // By model aggregation
    const byModelRaw = await prisma.tokenUsage.groupBy({
      by: ["model"],
      where: whereClause,
      _sum: { totalTokens: true, promptTokens: true, completionTokens: true },
      _count: true,
      orderBy: { _sum: { totalTokens: "desc" } },
    });

    const byModel = byModelRaw.map((row) => ({
      model: row.model,
      totalTokens: row._sum.totalTokens || 0,
      promptTokens: row._sum.promptTokens || 0,
      completionTokens: row._sum.completionTokens || 0,
      requests: row._count,
    }));

    return NextResponse.json({
      summary: {
        totalTokens: summary._sum.totalTokens || 0,
        totalPrompt: summary._sum.promptTokens || 0,
        totalCompletion: summary._sum.completionTokens || 0,
        totalRequests: summary._count,
      },
      byStudent,
      byDate,
      byModel,
    });
  } catch (error) {
    console.error("Token usage API error:", error);
    return NextResponse.json(
      { error: "服务器错误" },
      { status: 500 }
    );
  }
}
