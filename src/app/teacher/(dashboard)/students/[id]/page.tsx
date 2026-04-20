"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import syllabus from "@/content/syllabus.json";

interface StudentDetail {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  createdAt: string;
  progress: {
    currentModuleId: string;
    currentLessonId: string;
    currentStep: string;
    lessonProgress: Record<
      string,
      {
        theoryRead?: boolean;
        codeCompleted?: boolean;
        quizPassed?: boolean;
      }
    >;
    completedModules: string[];
    mockExamUnlocked: boolean;
  } | null;
  streak: {
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: string | null;
  } | null;
  practiceAttempts: {
    moduleId: string;
    completed: boolean;
    attempts: number;
  }[];
}

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/teacher/students/${params.id}`)
      .then(async (res) => {
        if (!res.ok) {
          setStudent(null);
          setLoading(false);
          return;
        }
        const data = await res.json();
        setStudent(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-8">
        <p className="text-red-400">学生不存在</p>
      </div>
    );
  }

  const lessonProgress = student.progress?.lessonProgress ?? {};
  const totalLessonsInSyllabus = syllabus.modules.reduce(
    (sum, m) => sum + m.lessons.length,
    0
  );
  const completedLessons = Object.values(lessonProgress).filter(
    (p) => p.quizPassed
  ).length;

  return (
    <div className="p-8 max-w-4xl">
      {/* Back */}
      <button
        onClick={() => router.push("/teacher/students")}
        className="text-xs text-gray-500 hover:text-white mb-6 flex items-center gap-1 cursor-pointer"
      >
        ← 返回学生列表
      </button>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {student.displayName}
          </h1>
          <p className="text-sm text-gray-400">@{student.username}</p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <p>
            创建于{" "}
            {new Date(student.createdAt).toLocaleDateString("zh-CN")}
          </p>
          <p>
            最后登录{" "}
            {student.lastLoginAt
              ? new Date(student.lastLoginAt).toLocaleDateString("zh-CN")
              : "从未"}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-brand-purple-deep/60 border border-brand-purple/30 rounded-xl p-4 text-center">
          <p className="text-xl font-bold text-brand-gold">
            {student.progress?.completedModules.length ?? 0}/5
          </p>
          <p className="text-[10px] text-gray-400 mt-1">模块完成</p>
        </div>
        <div className="bg-brand-purple-deep/60 border border-brand-purple/30 rounded-xl p-4 text-center">
          <p className="text-xl font-bold text-brand-magenta">
            {completedLessons}/{totalLessonsInSyllabus}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">课时完成</p>
        </div>
        <div className="bg-brand-purple-deep/60 border border-brand-purple/30 rounded-xl p-4 text-center">
          <p className="text-xl font-bold text-orange-400">
            🔥 {student.streak?.currentStreak ?? 0}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">当前 Streak</p>
        </div>
        <div className="bg-brand-purple-deep/60 border border-brand-purple/30 rounded-xl p-4 text-center">
          <p className="text-xl font-bold text-green-400">
            {student.streak?.longestStreak ?? 0}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">最长 Streak</p>
        </div>
      </div>

      {/* Module progress */}
      <div className="bg-brand-purple-deep/40 border border-brand-purple/20 rounded-xl mb-6">
        <div className="px-5 py-3 border-b border-brand-purple/20">
          <h2 className="text-sm font-semibold text-white">模块进度</h2>
        </div>
        <div className="p-5 space-y-4">
          {syllabus.modules.map((mod) => {
            const isCompleted =
              student.progress?.completedModules.includes(mod.id) ?? false;
            const moduleLessons = mod.lessons;
            const passedInModule = moduleLessons.filter(
              (l) => lessonProgress[l.id]?.quizPassed
            ).length;
            const practice = student.practiceAttempts?.find(
              (pa) => pa.moduleId === mod.id
            );

            return (
              <div key={mod.id} className="flex items-center gap-4">
                <div className="w-8 text-center">
                  {isCompleted ? (
                    <span className="text-green-400">✓</span>
                  ) : (
                    <span className="text-gray-600">{mod.icon}</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-white">{mod.title}</p>
                    <span className="text-xs text-gray-400">
                      {passedInModule}/{moduleLessons.length} 课时
                      {practice && (
                        <span className="ml-2">
                          {practice.completed ? (
                            <span className="text-green-400">
                              实战 ✓
                            </span>
                          ) : (
                            <span className="text-yellow-400">
                              实战 ({practice.attempts}次)
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-brand-purple/30 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isCompleted ? "bg-green-400" : "bg-brand-gold"
                      }`}
                      style={{
                        width: `${
                          moduleLessons.length > 0
                            ? (passedInModule / moduleLessons.length) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
