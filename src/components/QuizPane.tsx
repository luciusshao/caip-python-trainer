"use client";

import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import syllabus from "@/content/syllabus.json";
import challengesData from "@/content/challenges.json";

interface Quiz {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface Lesson {
  id: string;
  title: string;
  theory_en: string;
  theory_zh: string;
  interactiveCode: { initialCode: string; expectedOutput: string; hint: string };
  quizzes: Quiz[];
}

export default function QuizPane({
  lesson,
  moduleId,
}: {
  lesson: Lesson;
  moduleId: string;
}) {
  const {
    submitQuizAnswer,
    markQuizPassed,
    completeModule,
    setCurrentLesson,
    setCurrentStep,
    lessonProgress,
  } = useAppStore();

  const [currentQuizIdx, setCurrentQuizIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);

  const quiz = lesson.quizzes[currentQuizIdx];
  const totalQuizzes = lesson.quizzes.length;

  const handleSubmit = () => {
    if (selectedAnswer === null) return;

    const correct = selectedAnswer === quiz.correctAnswer;
    submitQuizAnswer(lesson.id, quiz.id, selectedAnswer, correct);
    if (correct) setCorrectCount((c) => c + 1);
    setShowResult(true);
  };

  const handleNext = () => {
    if (currentQuizIdx < totalQuizzes - 1) {
      setCurrentQuizIdx((i) => i + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      // Quiz complete
      const finalCorrect = correctCount + (selectedAnswer === quiz.correctAnswer ? 0 : 0);
      // Already counted in handleSubmit
      setQuizComplete(true);

      // Pass if all correct (or enough)
      if (correctCount >= Math.ceil(totalQuizzes * 0.7)) {
        markQuizPassed(lesson.id);

        // Check if all lessons in module are done
        const currentModule = syllabus.modules.find((m) => m.id === moduleId);
        if (currentModule) {
          const allDone = currentModule.lessons.every((l) => {
            if (l.id === lesson.id) return true; // Current one is being completed
            return lessonProgress[l.id]?.quizPassed;
          });
          if (allDone) completeModule(moduleId);
        }
      }
    }
  };

  const handleNextLesson = () => {
    // Find next lesson
    const currentModule = syllabus.modules.find((m) => m.id === moduleId);
    if (!currentModule) return;
    const lessonIdx = currentModule.lessons.findIndex((l) => l.id === lesson.id);

    if (lessonIdx < currentModule.lessons.length - 1) {
      // Next lesson in same module
      setCurrentLesson(moduleId, currentModule.lessons[lessonIdx + 1].id);
    } else {
      // First lesson of next module
      const moduleIdx = syllabus.modules.findIndex((m) => m.id === moduleId);
      if (moduleIdx < syllabus.modules.length - 1) {
        const nextModule = syllabus.modules[moduleIdx + 1];
        setCurrentLesson(nextModule.id, nextModule.lessons[0].id);
      }
    }
  };

  if (quizComplete) {
    const passed = correctCount >= Math.ceil(totalQuizzes * 0.7);
    // Check if current lesson is the LAST in the module — challenge only shows there
    const moduleChallenges = (challengesData.challenges as Record<string, unknown[]>)[moduleId];
    const currentModule = syllabus.modules.find((m) => m.id === moduleId);
    const isLastLesson = currentModule
      ? currentModule.lessons[currentModule.lessons.length - 1].id === lesson.id
      : false;
    const hasPractice = moduleChallenges && moduleChallenges.length > 0 && isLastLesson;

    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-6 max-w-md">
          <div className="text-6xl">{passed ? "🎉" : "😅"}</div>
          <h3 className="text-2xl font-bold">
            {passed ? "Quiz Passed!" : "Not quite..."}
          </h3>
          <p className="text-gray-400">
            You got{" "}
            <span className={`font-bold ${passed ? "text-green-400" : "text-red-400"}`}>
              {correctCount}/{totalQuizzes}
            </span>{" "}
            questions correct.
          </p>
          {passed && (
            <div className="bg-green-900/30 border border-green-700/30 rounded-xl p-4">
              <p className="text-green-400 text-sm">
                ✓ Lesson unlocked! You can proceed to the next lesson.
              </p>
            </div>
          )}
          <div className="flex gap-3 justify-center flex-wrap">
            {!passed && (
              <button
                onClick={() => {
                  setCurrentQuizIdx(0);
                  setSelectedAnswer(null);
                  setShowResult(false);
                  setCorrectCount(0);
                  setQuizComplete(false);
                }}
                className="px-6 py-2 bg-brand-purple/50 hover:bg-brand-purple/70 rounded-lg text-sm transition-all"
              >
                Retry Quiz
              </button>
            )}
            {passed && hasPractice && (
              <button
                onClick={() => setCurrentStep("practice")}
                className="px-6 py-2 bg-gradient-to-r from-brand-gold to-brand-gold-light text-brand-dark font-semibold rounded-lg text-sm hover:shadow-lg hover:shadow-brand-gold/30 transition-all"
              >
                🏆 Module Challenge →
              </button>
            )}
            {passed && (
              <button
                onClick={handleNextLesson}
                className={`px-6 py-2 rounded-lg text-sm transition-all ${
                  hasPractice
                    ? "bg-brand-purple/40 hover:bg-brand-purple/60 text-gray-300"
                    : "bg-gradient-to-r from-brand-gold to-brand-gold-light text-brand-dark font-semibold hover:shadow-lg hover:shadow-brand-gold/30"
                }`}
              >
                Next Lesson →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-6">
        {/* Progress */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Question {currentQuizIdx + 1} of {totalQuizzes}
          </span>
          <div className="flex gap-1">
            {lesson.quizzes.map((_, idx) => (
              <div
                key={idx}
                className={`w-8 h-1.5 rounded-full ${
                  idx < currentQuizIdx
                    ? "bg-green-500"
                    : idx === currentQuizIdx
                    ? "bg-brand-gold"
                    : "bg-gray-700"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Question */}
        <div className="bg-brand-purple-deep/50 border border-brand-purple/30 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-6">{quiz.question}</h3>

          {/* Options */}
          <div className="space-y-3">
            {quiz.options.map((option, idx) => {
              const isSelected = selectedAnswer === idx;
              const isCorrectAnswer = idx === quiz.correctAnswer;
              let optionStyle = "border-brand-purple/30 hover:border-brand-magenta/50 hover:bg-brand-purple/20";

              if (showResult) {
                if (isCorrectAnswer) {
                  optionStyle = "border-green-500 bg-green-900/30";
                } else if (isSelected && !isCorrectAnswer) {
                  optionStyle = "border-red-500 bg-red-900/30";
                } else {
                  optionStyle = "border-gray-700/30 opacity-50";
                }
              } else if (isSelected) {
                optionStyle = "border-brand-gold bg-brand-gold/10";
              }

              return (
                <button
                  key={idx}
                  onClick={() => !showResult && setSelectedAnswer(idx)}
                  disabled={showResult}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center gap-3 ${optionStyle}`}
                >
                  <span
                    className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold shrink-0 ${
                      isSelected
                        ? "border-brand-gold text-brand-gold"
                        : "border-gray-600 text-gray-500"
                    }`}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="text-sm">{option}</span>
                  {showResult && isCorrectAnswer && <span className="ml-auto text-green-400">✓</span>}
                  {showResult && isSelected && !isCorrectAnswer && (
                    <span className="ml-auto text-red-400">✗</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {showResult && (
            <div
              className={`mt-4 p-3 rounded-lg text-sm ${
                selectedAnswer === quiz.correctAnswer
                  ? "bg-green-900/20 text-green-400 border border-green-800/30"
                  : "bg-red-900/20 text-red-400 border border-red-800/30"
              }`}
            >
              <p>💡 {quiz.explanation}</p>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          {!showResult ? (
            <button
              onClick={handleSubmit}
              disabled={selectedAnswer === null}
              className="px-6 py-2 bg-brand-magenta hover:bg-brand-magenta/80 text-white font-semibold rounded-lg text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Submit Answer
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-gradient-to-r from-brand-gold to-brand-gold-light text-brand-dark font-semibold rounded-lg text-sm hover:shadow-lg hover:shadow-brand-gold/30 transition-all"
            >
              {currentQuizIdx < totalQuizzes - 1 ? "Next Question →" : "See Results →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
