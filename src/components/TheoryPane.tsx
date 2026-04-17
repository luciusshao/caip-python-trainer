"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAppStore } from "@/store/useAppStore";

interface Lesson {
  id: string;
  title: string;
  theory_en: string;
  theory_zh: string;
  interactiveCode: { initialCode: string; expectedOutput: string; hint: string };
  quizzes: { id: string; question: string; options: string[]; correctAnswer: number; explanation: string }[];
}

export default function TheoryPane({ lesson }: { lesson: Lesson }) {
  const { theoryLang, markTheoryRead, setCurrentStep } = useAppStore();

  const handleContinue = () => {
    markTheoryRead(lesson.id);
    setCurrentStep("code");
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 pb-24">
        {/* Theory Content */}
        {theoryLang === "both" ? (
          <div className="grid grid-cols-2 gap-6">
            {/* English */}
            <div className="prose prose-invert prose-sm max-w-none min-w-0 overflow-hidden">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-brand-purple/30">
                <span className="text-xs bg-blue-800/50 text-blue-300 px-2 py-0.5 rounded-full">English</span>
              </div>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{lesson.theory_en}</ReactMarkdown>
            </div>
            {/* Chinese */}
            <div className="prose prose-invert prose-sm max-w-none min-w-0 overflow-hidden">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-brand-purple/30">
                <span className="text-xs bg-red-800/50 text-red-300 px-2 py-0.5 rounded-full">中文</span>
              </div>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{lesson.theory_zh}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {theoryLang === "en" ? lesson.theory_en : lesson.theory_zh}
            </ReactMarkdown>
          </div>
        )}

        {/* Continue Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleContinue}
            className="px-8 py-3 bg-gradient-to-r from-brand-magenta to-brand-purple rounded-xl font-semibold text-white hover:shadow-lg hover:shadow-brand-magenta/30 transition-all hover:scale-105"
          >
            Continue to Code Practice →
          </button>
        </div>
      </div>
    </div>
  );
}
