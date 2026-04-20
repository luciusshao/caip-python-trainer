"use client";

import Link from "next/link";
import { useAppStore } from "@/store/useAppStore";
import syllabus from "@/content/syllabus.json";

export default function Header() {
  const { streak, completedModules, lessonProgress, theoryLang, setTheoryLang } = useAppStore();

  // Count completed lessons
  const totalLessons = syllabus.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const completedLessons = Object.values(lessonProgress).filter((p) => p.quizPassed).length;
  const progressPercent = Math.round((completedLessons / totalLessons) * 100);

  return (
    <header className="bg-brand-purple-deep/80 backdrop-blur-sm border-b border-brand-purple/30 px-6 py-3 flex items-center justify-between shrink-0">
      {/* Left: Progress */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-40 h-2 bg-brand-purple/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-gold to-brand-gold-light rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-sm text-brand-gold font-semibold">{progressPercent}%</span>
        </div>
        <span className="text-xs text-gray-400">
          {completedLessons}/{totalLessons} lessons
        </span>
      </div>

      {/* Center: Language Toggle */}
      <div className="flex items-center gap-1 bg-brand-purple/30 rounded-lg p-1">
        {(["en", "zh", "both"] as const).map((lang) => (
          <button
            key={lang}
            onClick={() => setTheoryLang(lang)}
            className={`px-3 py-1 text-xs rounded-md transition-all ${
              theoryLang === lang
                ? "bg-brand-gold text-brand-dark font-semibold"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {lang === "en" ? "EN" : lang === "zh" ? "中文" : "EN/中文"}
          </button>
        ))}
      </div>

      {/* Right: Streak */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔥</span>
          <div>
            <p className="text-sm font-bold text-brand-gold">{streak.currentStreak} days</p>
            <p className="text-xs text-gray-400">streak</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏆</span>
          <div>
            <p className="text-sm font-bold text-brand-gold-light">{completedModules.length}/{syllabus.modules.length}</p>
            <p className="text-xs text-gray-400">modules</p>
          </div>
        </div>
        <Link
          href="/profile"
          className="text-xs text-gray-400 hover:text-brand-gold transition-colors px-2 py-1 rounded-md hover:bg-brand-purple/20"
          title="个人资料"
        >
          👤
        </Link>
      </div>
    </header>
  );
}
