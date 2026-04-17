"use client";

import { useAppStore } from "@/store/useAppStore";
import syllabus from "@/content/syllabus.json";
import challengesData from "@/content/challenges.json";
import TheoryPane from "./TheoryPane";
import CodePane from "./CodePane";
import QuizPane from "./QuizPane";
import PracticePane from "./PracticePane";

interface Challenge {
  id: string;
  title: string;
  description: string;
  startingCode: string;
  testCases: { label: string; setupCode: string; assertionCode: string }[];
  hint: string;
  difficulty: string;
}

const challenges = challengesData.challenges as Record<string, Challenge[]>;

export default function LessonView() {
  const { currentModuleId, currentLessonId, currentStep, setCurrentStep, lessonProgress, practiceProgress } =
    useAppStore();

  // Find current lesson and module
  const currentModule = syllabus.modules.find((m) => m.id === currentModuleId);
  const currentLesson = currentModule?.lessons.find((l) => l.id === currentLessonId);

  // Get challenges for this module from independent config
  const moduleChallenges = challenges[currentModuleId] || [];
  // Challenge only appears on the LAST lesson of each module
  const isLastLesson = currentModule
    ? currentModule.lessons[currentModule.lessons.length - 1].id === currentLessonId
    : false;
  const hasPractice = moduleChallenges.length > 0 && isLastLesson;
  // For now, show the first challenge; future: support multi-challenge selection
  const activeChallenge = moduleChallenges[0];

  if (!currentLesson || !currentModule) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">Select a lesson to begin</p>
      </div>
    );
  }

  const progress = lessonProgress[currentLessonId];
  const practiceCompleted = practiceProgress[currentModuleId]?.completed;

  const steps = [
    { key: "theory" as const, label: "📖 Learn", icon: "📖", done: progress?.theoryRead },
    { key: "code" as const, label: "💻 Code", icon: "💻", done: progress?.codeCompleted },
    { key: "quiz" as const, label: "✅ Quiz", icon: "✅", done: progress?.quizPassed },
    ...(hasPractice
      ? [{ key: "practice" as const, label: "🏆 Challenge", icon: "🏆", done: practiceCompleted }]
      : []),
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Step Navigation Bar */}
      <div className="bg-brand-purple-deep/50 border-b border-brand-purple/20 px-6 py-3 flex items-center gap-2">
        <div className="flex-1">
          <h2 className="text-base font-bold text-white">
            {currentStep === "practice" && activeChallenge
              ? activeChallenge.title
              : currentLesson.title}
          </h2>
          <p className="text-xs text-gray-400">
            {currentModule.title} ·{" "}
            {currentStep === "practice" ? "Module Challenge" : `Lesson ${currentLessonId.split("-l")[1]}`}
          </p>
        </div>

        {/* Step Pills */}
        <div className="flex items-center gap-1">
          {steps.map((step) => (
            <button
              key={step.key}
              onClick={() => setCurrentStep(step.key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                currentStep === step.key
                  ? step.key === "practice"
                    ? "bg-brand-gold text-brand-dark shadow-lg shadow-brand-gold/30"
                    : "bg-brand-magenta text-white shadow-lg shadow-brand-magenta/30"
                  : step.done
                  ? "bg-green-900/40 text-green-400 border border-green-700/40"
                  : "bg-brand-purple/20 text-gray-400 hover:text-white hover:bg-brand-purple/30"
              }`}
            >
              <span>{step.icon}</span>
              <span>{step.label.split(" ").slice(1).join(" ")}</span>
              {step.done && currentStep !== step.key && <span>✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {currentStep === "theory" && <TheoryPane lesson={currentLesson} />}
        {currentStep === "code" && <CodePane lesson={currentLesson} />}
        {currentStep === "quiz" && <QuizPane lesson={currentLesson} moduleId={currentModuleId} />}
        {currentStep === "practice" && activeChallenge && (
          <PracticePane practicalTask={activeChallenge} moduleId={currentModuleId} />
        )}
      </div>
    </div>
  );
}
