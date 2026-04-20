"use client";

import syllabus from "@/content/syllabus.json";

export default function CoursesPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">课程管理</h1>
        <p className="text-sm text-gray-400 mt-1">
          查看当前课程结构（基于 CAIP 认证大纲）
        </p>
      </div>

      <div className="space-y-4">
        {syllabus.modules.map((mod) => (
          <div
            key={mod.id}
            className="bg-brand-purple-deep/40 border border-brand-purple/20 rounded-xl overflow-hidden"
          >
            {/* Module Header */}
            <div className="px-5 py-4 border-b border-brand-purple/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">{mod.icon}</span>
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    {mod.title}
                  </h2>
                  <p className="text-xs text-gray-400">{mod.description}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-brand-gold font-medium">
                  {mod.weight}
                </span>
                <p className="text-[10px] text-gray-500">
                  {mod.lessons.length} 课时
                </p>
              </div>
            </div>

            {/* Lessons List */}
            <div className="divide-y divide-brand-purple/10">
              {mod.lessons.map((lesson, idx) => (
                <div
                  key={lesson.id}
                  className="px-5 py-3 flex items-center gap-3"
                >
                  <span className="text-xs text-gray-600 w-6">
                    {idx + 1}.
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-300">{lesson.title}</p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    <span>📖 理论</span>
                    <span>💻 代码</span>
                    <span>
                      ✅ {lesson.quizzes.length} 题
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-brand-purple/10 border border-brand-purple/20 rounded-xl">
        <p className="text-xs text-gray-500">
          💡 自定义题库和难度调整功能将在后续版本中提供
        </p>
      </div>
    </div>
  );
}
