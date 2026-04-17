"use client";

import { useAppStore } from "@/store/useAppStore";
import syllabus from "@/content/syllabus.json";

export default function Sidebar() {
  const {
    currentModuleId,
    currentLessonId,
    setCurrentLesson,
    lessonProgress,
    completedModules,
    isLessonUnlocked,
    isModuleUnlocked,
    mockExamUnlocked,
  } = useAppStore();

  return (
    <aside className="w-72 bg-gradient-to-b from-brand-purple-deep to-[#1a0a2e] border-r border-brand-purple/20 flex flex-col shrink-0 overflow-hidden">
      {/* Logo */}
      <div className="p-5 border-b border-brand-purple/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-magenta to-brand-purple flex items-center justify-center text-lg font-bold">
            C
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              CAIP<span className="text-brand-gold">™</span> Trainer
            </h1>
            <p className="text-[10px] text-gray-400 tracking-wider uppercase">Python Interactive</p>
          </div>
        </div>
      </div>

      {/* Module List */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-3">
        {syllabus.modules.map((module) => {
          const moduleUnlocked = isModuleUnlocked(module.id);
          const isCurrentModule = module.id === currentModuleId;
          const isCompleted = completedModules.includes(module.id);

          return (
            <div key={module.id}>
              {/* Module Header */}
              <div
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                  !moduleUnlocked
                    ? "opacity-40"
                    : isCurrentModule
                    ? "bg-brand-purple/30"
                    : "hover:bg-brand-purple/15"
                }`}
              >
                <span className="text-xl">{moduleUnlocked ? module.icon : "🔒"}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold truncate">{module.title}</h3>
                  <p className="text-[10px] text-gray-500">{module.weight} of exam</p>
                </div>
                {isCompleted && (
                  <span className="text-brand-gold text-lg">✓</span>
                )}
              </div>

              {/* Lesson List */}
              {moduleUnlocked && (
                <div className="ml-5 mt-1 space-y-0.5 border-l border-brand-purple/20 pl-4">
                  {module.lessons.map((lesson, idx) => {
                    const unlocked = isLessonUnlocked(module.id, lesson.id);
                    const isCurrent = lesson.id === currentLessonId;
                    const progress = lessonProgress[lesson.id];
                    const isLessonComplete = progress?.quizPassed;

                    return (
                      <button
                        key={lesson.id}
                        onClick={() => unlocked && setCurrentLesson(module.id, lesson.id)}
                        disabled={!unlocked}
                        className={`w-full text-left px-3 py-2 rounded-md text-xs transition-all flex items-center gap-2 ${
                          !unlocked
                            ? "opacity-30 cursor-not-allowed"
                            : isCurrent
                            ? "bg-brand-magenta/25 text-brand-gold-light font-medium border border-brand-magenta/30"
                            : "hover:bg-brand-purple/20 text-gray-300"
                        }`}
                      >
                        {/* Status indicator */}
                        <span className="shrink-0">
                          {!unlocked ? (
                            <span className="text-gray-500">🔒</span>
                          ) : isLessonComplete ? (
                            <span className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center text-[10px]">
                              ✓
                            </span>
                          ) : isCurrent ? (
                            <span className="w-5 h-5 rounded-full bg-brand-gold flex items-center justify-center text-[10px] text-brand-dark font-bold pulse-gold">
                              {idx + 1}
                            </span>
                          ) : (
                            <span className="w-5 h-5 rounded-full border border-gray-600 flex items-center justify-center text-[10px] text-gray-500">
                              {idx + 1}
                            </span>
                          )}
                        </span>
                        <span className="truncate">{lesson.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Mock Exam Button */}
        <div className="pt-3 border-t border-brand-purple/20">
          <button
            disabled={!mockExamUnlocked}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
              mockExamUnlocked
                ? "bg-gradient-to-r from-brand-gold/20 to-brand-magenta/20 hover:from-brand-gold/30 hover:to-brand-magenta/30 border border-brand-gold/30"
                : "opacity-30 cursor-not-allowed"
            }`}
          >
            <span className="text-xl">{mockExamUnlocked ? "📝" : "🔒"}</span>
            <div>
              <p className="text-sm font-semibold">Mock Exam</p>
              <p className="text-[10px] text-gray-400">
                {mockExamUnlocked ? "Ready to test!" : "Complete all modules first"}
              </p>
            </div>
          </button>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-brand-purple/20 text-center">
        <p className="text-[9px] text-gray-600">
          USAII® CAIP™ Python Prep Tool
        </p>
      </div>
    </aside>
  );
}
