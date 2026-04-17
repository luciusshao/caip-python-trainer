# CAIP Python Trainer - Quick Architecture Reference

## 🎯 Project At a Glance

**What:** Interactive Python learning platform for CAIP certification prep  
**Tech:** Next.js 15 + React 19 + Zustand + Tailwind  
**Runtime:** Python via Pyodide (in-browser WebAssembly)  
**AI:** DeepSeek LLM API for tutoring  

---

## 📁 File Quick Reference

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Main entry point |
| `src/app/api/chat/route.ts` | LLM streaming endpoint |
| `src/components/Sidebar.tsx` | Lesson navigation |
| `src/components/LessonView.tsx` | Step router (Theory→Code→Quiz→Practice) |
| `src/components/TheoryPane.tsx` | Lesson content (bilingual) |
| `src/components/CodePane.tsx` | Interactive Python editor |
| `src/components/QuizPane.tsx` | Quiz interface |
| `src/components/PracticePane.tsx` | Challenge sandbox |
| `src/components/AIChatPanel.tsx` | AI tutor chat |
| `src/components/Header.tsx` | Progress bar + streaks |
| `src/lib/usePyodide.ts` | Python runtime hook |
| `src/lib/useAIChat.ts` | AI chat hook |
| `src/store/useAppStore.ts` | Global state (Zustand) |
| `src/content/syllabus.json` | Course structure |
| `src/content/challenges.json` | Module challenges |
| `config/ai_model.json` | LLM config |

---

## 🔄 Data Flow Diagram

```
Browser
├─ User clicks lesson
│  └─ Sidebar → useAppStore.setCurrentLesson()
│     └─ LessonView re-renders
│        └─ Shows current step pane
│
├─ User writes code
│  └─ CodePane state update (Monaco)
│     └─ User clicks Run
│        └─ usePyodide().runPython()
│           └─ Pyodide executes in browser
│              └─ Returns output/error
│
├─ User passes code test
│  └─ CodePane → useAppStore.markCodeCompleted()
│     └─ Progress tracked in store
│
├─ User asks AI
│  └─ AIChatPanel → useAIChat.sendMessage()
│     └─ POST /api/chat {messages, context}
│        └─ Server builds system prompt with context
│           └─ Server calls DeepSeek API
│              └─ Streams response back (SSE)
│                 └─ AIChatPanel renders markdown
│
└─ State persists
   └─ Zustand auto-saves to localStorage
      └─ Survives page refresh
```

---

## 🏗️ Component Hierarchy

```
page.tsx
├── Sidebar
│   └── [Module Navigation]
│       └─ setCurrentLesson()
│
└── Main
    ├── Header
    │   ├── Progress bar
    │   ├── Language toggle
    │   └── Streak display
    │
    └── LessonView
        ├── Step Pills (Theory | Code | Quiz | Practice)
        │
        └── Content Area (renders based on currentStep)
            ├── TheoryPane (when step = 'theory')
            ├── CodePane (when step = 'code')
            ├── QuizPane (when step = 'quiz')
            ├── PracticePane (when step = 'practice')
            │   └── AIChatPanel (sidebar, all steps)
```

---

## 💾 State Structure (Zustand)

```typescript
{
  // Navigation
  currentModuleId: 'm1'                    // Current module
  currentLessonId: 'm1-l1'                 // Current lesson
  currentStep: 'theory' | 'code' | 'quiz' | 'practice'
  theoryLang: 'en' | 'zh' | 'both'        // Display language

  // Progress
  lessonProgress: {                        // Keyed by lessonId
    'm1-l1': {
      lessonId: 'm1-l1'
      theoryRead: boolean
      codeCompleted: boolean
      quizPassed: boolean
      quizAttempts: [{quizId, selectedAnswer, correct, timestamp}]
    }
  }
  completedModules: ['m1', 'm2', ...]     // Finished modules

  // Gamification
  streak: {
    currentStreak: 5                       // Days
    lastActiveDate: '2026-04-17'
    longestStreak: 12
    activeDays: ['2026-04-17', ...]
  }
  mockExamUnlocked: boolean                // After 5 modules
  mockExamScores: [{score, total, date}]

  // Analytics
  mistakes: [QuizAttempt[]]                // Wrong quiz answers
  practiceProgress: {                      // Keyed by moduleId
    'm1': {completed: boolean, attempts: number}
  }
}
```

**Persisted to localStorage as:** `caip-trainer-progress`

---

## 🐍 Python Execution (Pyodide)

**How it works:**
1. First code run → Pyodide loaded from CDN (~30MB, ~5s)
2. Loads Python 3.11 as WebAssembly
3. Full Python stdlib included
4. Subsequent runs instant (cached in memory)
5. usePyodide hook captures stdout/stderr
6. Errors extracted and displayed

**Example:**
```typescript
const { status, runPython } = usePyodide();
const result = await runPython("print('hello')");
// {output: "hello\n", error: null}
```

---

## 🤖 AI Tutor (DeepSeek)

**Endpoint:** `POST /api/chat`

**Flow:**
1. Client sends message + context (code, error, task description)
2. Server templates system prompt with context
3. All messages assembled (system + history)
4. Server calls DeepSeek API with `stream: true`
5. Response piped through ReadableStream (SSE)
6. Client accumulates response via setMessages()
7. Rendered as markdown in AIChatPanel

**System Prompt Template:**
```
You are a friendly Python tutor for a high school student preparing for CAIP certification.
Guide them to the answer step by step, DO NOT just give them the final code.
Explain errors simply. Use Chinese when the student writes in Chinese, otherwise use English.

Current task: {task_desc}
Student's code:
```python
{student_code}
```
Error (if any): {error_msg}
```

---

## 📚 Learning Flow

**Theory → Code → Quiz → Practice → Unlock Next**

1. **Theory Phase**
   - Read lesson (EN, 中文, or bilingual)
   - Click "Continue to Code Practice"
   - `markTheoryRead()` called

2. **Code Phase**
   - Write code in Monaco editor
   - Click "Run" (or Ctrl+Enter)
   - Pyodide executes code in browser
   - If output matches expected: `markCodeCompleted()` called
   - Continue button appears

3. **Quiz Phase**
   - Answer 2-3 multiple choice questions
   - Scoring: 70% pass required
   - `submitQuizAnswer()` tracks attempt
   - If passed: `markQuizPassed()` called

4. **Practice Phase** (optional, if module has challenges)
   - Complex coding challenge
   - Test case runner (via Pyodide)
   - If all pass: `markPracticeCompleted()` called

5. **Module Completion**
   - If all lessons done: `completeModule()` called
   - If 5 modules done: `mockExamUnlocked = true`

---

## 🔌 API Endpoint

### `POST /api/chat`

**Request:**
```json
{
  "messages": [
    {"role": "user", "content": "How do I fix this error?"},
    {"role": "assistant", "content": "..."}
  ],
  "context": {
    "taskDesc": "Write a function that...",
    "studentCode": "def foo():\n    pass",
    "errorMsg": "IndentationError: ..."
  }
}
```

**Response:** Server-Sent Events (SSE) stream

```
data: {"content": "Here's"}
data: {"content": " how"}
data: {"content": " to"}
data: {"content": " fix"}
data: {"content": " it"}
data: [DONE]
```

---

## 🎨 Design System

**Brand Colors:**
- Deep Purple: `#3B0764` (dark backgrounds)
- Purple: `#6B21A8` (accents)
- Magenta: `#A21CAF` (active/primary)
- Gold: `#F5A623` (success)
- Dark: `#0F172A` (main bg)

**Font:** Inter (sans-serif)

**Theme:** Dark mode (eye-friendly for long coding sessions)

---

## 🔑 Key Patterns

**1. Server-Side Content**
```typescript
import syllabus from "@/content/syllabus.json";
// Bundled at build time, zero runtime overhead
```

**2. Lazy Components**
```typescript
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false
});
// Only loads when component renders
```

**3. Streaming API**
```typescript
const stream = new ReadableStream({/* ... */});
return new Response(stream, {headers: SSE_headers});
```

**4. Context-Based Prompting**
```typescript
const systemPrompt = template
  .replace("{task_desc}", context.taskDesc)
  .replace("{student_code}", context.studentCode)
  .replace("{error_msg}", context.errorMsg);
```

**5. State Persistence**
```typescript
persist((set, get) => ({...}), {name: 'key'})
// Auto-saves to localStorage
```

---

## 🚀 Development

**Start dev server:**
```bash
npm run dev
```

**Build for production:**
```bash
npm run build
npm run start
```

**Lint code:**
```bash
npm run lint
```

---

## 📊 Content Structure

### Syllabus (syllabus.json)
```
5 Modules × 2-3 Lessons each
├── Module metadata (title, icon, exam weight)
├── Lessons with bilingual theory content
├── Interactive code exercises
└── 2-3 multiple choice quizzes per lesson
```

### Challenges (challenges.json)
```
1 Challenge per module
├── Complex coding problem
├── Multiple test cases
├── Hint
└── Difficulty level
```

---

## 💡 Important Notes

- **No Server Database:** All progress stored in localStorage (client-side)
- **No Authentication:** Demo mode (assumes single user per browser)
- **Free Access:** All lessons/modules accessible (no sequential lock currently)
- **Pyodide Latency:** First Python run takes ~5s (initial load), then instant
- **API Key Required:** Must set `LLM_API_KEY` in `.env.local`
- **Development Only:** Not configured for production scale (would need backend)

---

## 📖 For More Details

See `DESIGN.md` for:
- Complete file tree
- Architecture diagrams
- State management details
- API specifications
- Data models
- Component relationships
- Technical stack deep dive

