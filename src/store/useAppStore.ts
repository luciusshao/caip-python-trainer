import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface QuizAttempt {
  quizId: string;
  selectedAnswer: number;
  correct: boolean;
  timestamp: number;
}

export interface LessonProgress {
  lessonId: string;
  theoryRead: boolean;
  codeCompleted: boolean;
  quizPassed: boolean;
  quizAttempts: QuizAttempt[];
}

export interface DailyStreak {
  currentStreak: number;
  lastActiveDate: string; // YYYY-MM-DD
  longestStreak: number;
  activeDays: string[]; // Array of YYYY-MM-DD
}

interface AppState {
  // Current navigation
  currentModuleId: string;
  currentLessonId: string;
  currentStep: 'theory' | 'code' | 'quiz' | 'practice';
  theoryLang: 'en' | 'zh' | 'both';

  // Progress tracking
  lessonProgress: Record<string, LessonProgress>;
  completedModules: string[];

  // Streak
  streak: DailyStreak;

  // Mistake book
  mistakes: QuizAttempt[];

  // Mock exam
  mockExamUnlocked: boolean;
  mockExamScores: { score: number; total: number; date: string }[];

  // Practice challenge progress
  practiceProgress: Record<string, { completed: boolean; attempts: number }>;

  // Actions
  setCurrentLesson: (moduleId: string, lessonId: string) => void;
  setCurrentStep: (step: 'theory' | 'code' | 'quiz' | 'practice') => void;
  setTheoryLang: (lang: 'en' | 'zh' | 'both') => void;
  markTheoryRead: (lessonId: string) => void;
  markCodeCompleted: (lessonId: string) => void;
  submitQuizAnswer: (lessonId: string, quizId: string, selectedAnswer: number, correct: boolean) => void;
  markQuizPassed: (lessonId: string) => void;
  completeModule: (moduleId: string) => void;
  updateStreak: () => void;
  addMockExamScore: (score: number, total: number) => void;
  isLessonUnlocked: (moduleId: string, lessonId: string) => boolean;
  isModuleUnlocked: (moduleId: string) => boolean;
  getLessonProgress: (lessonId: string) => LessonProgress;
  markPracticeCompleted: (moduleId: string) => void;
  incrementPracticeAttempt: (moduleId: string) => void;
  resetProgress: () => void;

  // Server sync actions
  hydrateFromServer: (data: ServerProgressData) => void;
  getProgressSnapshot: () => ServerProgressData;
}

// Shape matching what the server returns/accepts
export interface ServerProgressData {
  currentModuleId: string;
  currentLessonId: string;
  currentStep: string;
  theoryLang: string;
  lessonProgress: Record<string, LessonProgress>;
  completedModules: string[];
  mockExamUnlocked: boolean;
  streak: DailyStreak;
  practiceProgress: Record<string, { completed: boolean; attempts: number }>;
}

const getToday = () => new Date().toISOString().split('T')[0];

const defaultLessonProgress: LessonProgress = {
  lessonId: '',
  theoryRead: false,
  codeCompleted: false,
  quizPassed: false,
  quizAttempts: [],
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentModuleId: 'm1',
      currentLessonId: 'm1-l1',
      currentStep: 'theory',
      theoryLang: 'both',
      lessonProgress: {},
      completedModules: [],
      streak: {
        currentStreak: 0,
        lastActiveDate: '',
        longestStreak: 0,
        activeDays: [],
      },
      mistakes: [],
      mockExamUnlocked: false,
      mockExamScores: [],
      practiceProgress: {},

      // Actions
      setCurrentLesson: (moduleId, lessonId) =>
        set({ currentModuleId: moduleId, currentLessonId: lessonId, currentStep: 'theory' }),

      setCurrentStep: (step) => set({ currentStep: step }),

      setTheoryLang: (lang) => set({ theoryLang: lang }),

      markTheoryRead: (lessonId) =>
        set((state) => ({
          lessonProgress: {
            ...state.lessonProgress,
            [lessonId]: {
              ...(state.lessonProgress[lessonId] || { ...defaultLessonProgress, lessonId }),
              theoryRead: true,
            },
          },
        })),

      markCodeCompleted: (lessonId) =>
        set((state) => ({
          lessonProgress: {
            ...state.lessonProgress,
            [lessonId]: {
              ...(state.lessonProgress[lessonId] || { ...defaultLessonProgress, lessonId }),
              codeCompleted: true,
            },
          },
        })),

      submitQuizAnswer: (lessonId, quizId, selectedAnswer, correct) => {
        const attempt: QuizAttempt = {
          quizId,
          selectedAnswer,
          correct,
          timestamp: Date.now(),
        };
        set((state) => ({
          lessonProgress: {
            ...state.lessonProgress,
            [lessonId]: {
              ...(state.lessonProgress[lessonId] || { ...defaultLessonProgress, lessonId }),
              quizAttempts: [
                ...(state.lessonProgress[lessonId]?.quizAttempts || []),
                attempt,
              ],
            },
          },
          mistakes: correct
            ? state.mistakes
            : [...state.mistakes, attempt],
        }));
      },

      markQuizPassed: (lessonId) =>
        set((state) => ({
          lessonProgress: {
            ...state.lessonProgress,
            [lessonId]: {
              ...(state.lessonProgress[lessonId] || { ...defaultLessonProgress, lessonId }),
              quizPassed: true,
            },
          },
        })),

      completeModule: (moduleId) =>
        set((state) => ({
          completedModules: state.completedModules.includes(moduleId)
            ? state.completedModules
            : [...state.completedModules, moduleId],
          mockExamUnlocked:
            state.completedModules.includes(moduleId)
              ? state.mockExamUnlocked
              : [...state.completedModules, moduleId].length >= 5, // All 5 modules (m1-m5)
        })),

      updateStreak: () => {
        const today = getToday();
        set((state) => {
          const { lastActiveDate, currentStreak, longestStreak, activeDays } = state.streak;
          if (lastActiveDate === today) return state; // Already counted today

          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          const newStreak = lastActiveDate === yesterdayStr ? currentStreak + 1 : 1;
          const newLongest = Math.max(longestStreak, newStreak);

          return {
            streak: {
              currentStreak: newStreak,
              lastActiveDate: today,
              longestStreak: newLongest,
              activeDays: [...activeDays, today],
            },
          };
        });
      },

      addMockExamScore: (score, total) =>
        set((state) => ({
          mockExamScores: [
            ...state.mockExamScores,
            { score, total, date: getToday() },
          ],
        })),

      // All lessons and modules are freely accessible — no sequential lock
      isLessonUnlocked: (_moduleId, _lessonId) => true,
      isModuleUnlocked: (_moduleId) => true,

      getLessonProgress: (lessonId) => {
        const state = get();
        return state.lessonProgress[lessonId] || { ...defaultLessonProgress, lessonId };
      },

      markPracticeCompleted: (moduleId) =>
        set((state) => ({
          practiceProgress: {
            ...state.practiceProgress,
            [moduleId]: {
              completed: true,
              attempts: (state.practiceProgress[moduleId]?.attempts || 0),
            },
          },
        })),

      incrementPracticeAttempt: (moduleId) =>
        set((state) => ({
          practiceProgress: {
            ...state.practiceProgress,
            [moduleId]: {
              completed: state.practiceProgress[moduleId]?.completed || false,
              attempts: (state.practiceProgress[moduleId]?.attempts || 0) + 1,
            },
          },
        })),

      resetProgress: () =>
        set({
          lessonProgress: {},
          completedModules: [],
          streak: { currentStreak: 0, lastActiveDate: '', longestStreak: 0, activeDays: [] },
          mistakes: [],
          mockExamUnlocked: false,
          mockExamScores: [],
          practiceProgress: {},
          currentModuleId: 'm1',
          currentLessonId: 'm1-l1',
          currentStep: 'theory',
        }),

      // ─── Server sync ─────────────────────────────────────
      hydrateFromServer: (data: ServerProgressData) => {
        const current = get();
        // Merge: completion states use OR (never lose progress)
        const mergedLessonProgress = { ...data.lessonProgress };
        for (const [key, local] of Object.entries(current.lessonProgress)) {
          const server = mergedLessonProgress[key];
          if (server) {
            mergedLessonProgress[key] = {
              ...server,
              theoryRead: server.theoryRead || local.theoryRead,
              codeCompleted: server.codeCompleted || local.codeCompleted,
              quizPassed: server.quizPassed || local.quizPassed,
              quizAttempts: server.quizAttempts.length >= local.quizAttempts.length
                ? server.quizAttempts : local.quizAttempts,
            };
          } else {
            mergedLessonProgress[key] = local;
          }
        }

        // Merge completedModules: union
        const mergedModules = [
          ...new Set([...data.completedModules, ...current.completedModules]),
        ];

        // Merge practice: OR completed, max attempts
        const mergedPractice = { ...data.practiceProgress };
        for (const [key, local] of Object.entries(current.practiceProgress)) {
          const server = mergedPractice[key];
          if (server) {
            mergedPractice[key] = {
              completed: server.completed || local.completed,
              attempts: Math.max(server.attempts, local.attempts),
            };
          } else {
            mergedPractice[key] = local;
          }
        }

        set({
          currentModuleId: data.currentModuleId,
          currentLessonId: data.currentLessonId,
          currentStep: data.currentStep as 'theory' | 'code' | 'quiz' | 'practice',
          theoryLang: data.theoryLang as 'en' | 'zh' | 'both',
          lessonProgress: mergedLessonProgress,
          completedModules: mergedModules,
          mockExamUnlocked: data.mockExamUnlocked || current.mockExamUnlocked,
          streak: data.streak,
          practiceProgress: mergedPractice,
        });
      },

      getProgressSnapshot: (): ServerProgressData => {
        const s = get();
        return {
          currentModuleId: s.currentModuleId,
          currentLessonId: s.currentLessonId,
          currentStep: s.currentStep,
          theoryLang: s.theoryLang,
          lessonProgress: s.lessonProgress,
          completedModules: s.completedModules,
          mockExamUnlocked: s.mockExamUnlocked,
          streak: s.streak,
          practiceProgress: s.practiceProgress,
        };
      },
    }),
    {
      name: 'caip-trainer-progress',
    }
  )
);
