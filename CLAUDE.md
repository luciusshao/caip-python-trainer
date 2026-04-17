# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (auto-selects port if 3000 is busy)
npm run build      # Production build + type check + ESLint
npm run lint       # ESLint only
npm run start      # Start production server
```

There are no automated tests. Use Playwright for visual verification when needed:
```bash
# Playwright is installed as devDependency
# Run with explicit executablePath due to version mismatch:
node /tmp/your-script.js  # chromium-1217 at ~/Library/Caches/ms-playwright/
```

## Architecture

**Pure frontend app** (Next.js 15 App Router) with one API route. All Python execution runs in-browser via Pyodide WebAssembly — no backend needed for code execution.

### Layout (single page)
```
page.tsx
├── Sidebar          — module/lesson navigation tree
├── Header           — streak, language toggle (en/zh/both), progress stats
└── LessonView       — step controller: theory → code → quiz → practice
    ├── TheoryPane   — bilingual markdown rendering (react-markdown + remark-gfm)
    ├── CodePane     — Monaco Editor + Pyodide execution, Ctrl+Enter to run
    ├── QuizPane     — multiple choice, 70% pass threshold
    └── PracticePane — module challenge sandbox, Monaco + Pyodide test runner + AIChatPanel
```

### State (Zustand, persisted to localStorage)
All state lives in `src/store/useAppStore.ts`, persisted under key `caip-trainer-progress`.

Key state shape:
- `currentModuleId / currentLessonId / currentStep` — navigation
- `lessonProgress: Record<lessonId, { theoryRead, codeCompleted, quizPassed, quizAttempts }>` — per-lesson tracking
- `practiceProgress: Record<moduleId, { completed, attempts }>` — challenge tracking
- `completedModules[]` — triggers `mockExamUnlocked` when all 5 modules done
- `streak` — daily login streak
- `theoryLang: 'en' | 'zh' | 'both'` — controls TheoryPane column layout

All lessons/modules are freely accessible — `isLessonUnlocked` and `isModuleUnlocked` always return `true`.

### Content data
- `src/content/syllabus.json` — module/lesson tree; each lesson has `theory_en`, `theory_zh`, `interactiveCode` (initialCode, expectedOutput, hint), and `quizzes[]`
- `src/content/challenges.json` — independent challenge config; `challenges[moduleId][]` each with `testCases[]` (setupCode + assertionCode run via Pyodide)
- `config/ai_model.json` — LLM provider config (endpoint, modelName, temperature, systemPrompt with `{task_desc}` / `{student_code}` / `{error_msg}` placeholders)

### AI Tutor
- `POST /api/chat` (route at `src/app/api/chat/route.ts`) — reads `config/ai_model.json` + `process.env.LLM_API_KEY`, injects context into systemPrompt, streams SSE response
- `src/lib/useAIChat.ts` — hook managing streaming chat state; `sendMessage(msg, context)`, `explainError(errorMsg, context)`, `stopStreaming()`, `clearChat()`
- `AIChatPanel` — collapsible sidebar embedded inside PracticePane
- LLM API key goes in `.env.local` as `LLM_API_KEY=sk-...`

### Python Runtime
`src/lib/usePyodide.ts` — singleton loader (loads once from CDN `cdn.jsdelivr.net/pyodide/v0.26.4`). Captures stdout/stderr via Python's `io.StringIO`. Used by both `CodePane` (single run) and `PracticePane` (sequential test case assertions).

## Key Constraints

- **Monaco Editor** must be imported via `next/dynamic` with `{ ssr: false }` — it's a browser-only module.
- **ESLint rules to watch**: `@next/next/no-assign-module-variable` (don't use `module` as variable name), `@typescript-eslint/no-explicit-any` (use explicit types instead of `as any`).
- **Import paths**: challenges import as `@/content/challenges.json` (not from `config/` — that's outside `src/` and can't be aliased).
- **Tailwind v4** syntax: theme variables defined in `globals.css` under `@theme {}`, not `tailwind.config.js`. Brand colors are `brand-purple-deep`, `brand-purple`, `brand-magenta`, `brand-gold`, `brand-gold-light`.
- **Bilingual layout**: TheoryPane `grid-cols-2` children need `min-w-0 overflow-hidden` to prevent code block overflow.
