# CAIP Python Trainer - Complete System Design Document

**Project:** CAIP Python Trainer (Interactive Python Learning Platform)  
**Framework:** Next.js 15 + React 19  
**State Management:** Zustand 5  
**Code Editor:** Monaco Editor  
**Python Runtime:** Pyodide (via CDN)  
**AI Backend:** DeepSeek LLM API  
**Styling:** Tailwind CSS 4 + PostCSS  
**Testing:** Playwright  

---

## 📋 Table of Contents
1. [Complete File Tree](#complete-file-tree)
2. [Architecture Overview](#architecture-overview)
3. [Directory Structure Details](#directory-structure-details)
4. [Core Components](#core-components)
5. [State Management](#state-management)
6. [API Layer](#api-layer)
7. [Data Models](#data-models)
8. [Hooks & Utilities](#hooks--utilities)
9. [Data Flow](#data-flow)
10. [Component Relationships](#component-relationships)
11. [Learning Flow](#learning-flow)
12. [Technical Stack Details](#technical-stack-details)

---

## Complete File Tree

```
caip-python-trainer/
├── .claude/
│   └── settings.local.json
├── .next/                          # Next.js build output (auto-generated)
├── config/
│   └── ai_model.json               # AI backend configuration
├── node_modules/                   # Dependencies
├── public/                         # Static assets
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── chat/
│   │   │       └── route.ts        # LLM streaming API endpoint
│   │   ├── globals.css             # Global styles + Tailwind theming
│   │   ├── layout.tsx              # Root layout
│   │   └── page.tsx                # Home page (main app)
│   ├── components/
│   │   ├── AIChatPanel.tsx         # AI tutor chat sidebar
│   │   ├── CodePane.tsx            # Interactive code editor
│   │   ├── Header.tsx              # Top navigation bar
│   │   ├── LessonView.tsx          # Main lesson container
│   │   ├── PracticePane.tsx        # Module challenge sandbox
│   │   ├── QuizPane.tsx            # Quiz interface
│   │   ├── Sidebar.tsx             # Left navigation sidebar
│   │   └── TheoryPane.tsx          # Lesson content display
│   ├── content/
│   │   ├── challenges.json         # Module challenges/practical tasks
│   │   └── syllabus.json           # Course structure + lessons + content
│   ├── lib/
│   │   ├── useAIChat.ts            # AI chat hook
│   │   └── usePyodide.ts           # Python runtime hook
│   └── store/
│       └── useAppStore.ts          # Zustand global state
├── test-results/                   # Playwright test artifacts
├── .env.local                      # Environment variables
├── .gitignore
├── eslint.config.mjs               # ESLint configuration
├── next.config.mjs                 # Next.js configuration
├── package.json                    # Dependencies & scripts
├── package-lock.json
├── postcss.config.mjs              # PostCSS configuration
└── tsconfig.json                   # TypeScript configuration

```

---

## Architecture Overview

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser / Client                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  React Components (UI Layer)                            │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ ┌────────────┐ ┌────────────┐ ┌────────────────────┐   │   │
│  │ │  Sidebar   │ │   Header   │ │  LessonView        │   │   │
│  │ └────────────┘ └────────────┘ └────────────────────┘   │   │
│  │                                                          │   │
│  │ ┌──────────────────────────────────────────────────┐   │   │
│  │ │ Theory | Code | Quiz | Practice  (Step Panes)   │   │   │
│  │ ├──────────────────────────────────────────────────┤   │   │
│  │ │ TheoryPane | CodePane | QuizPane | PracticePane │   │   │
│  │ └──────────────────────────────────────────────────┘   │   │
│  │                                                          │   │
│  │ ┌──────────────────────────────────────────────────┐   │   │
│  │ │          AIChatPanel (Sidebar)                   │   │   │
│  │ └──────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           │                                     │
│  ┌────────────────────────▼──────────────────────────────────┐  │
│  │  State Management (Zustand)                              │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │ • Lesson Navigation (currentModule, currentLesson)       │  │
│  │ • Progress Tracking (quizzes, code, theory)              │  │
│  │ • User Gamification (streak, completed modules)          │  │
│  │ • Practice Progress                                      │  │
│  │ • Language Preference                                    │  │
│  └──────────────────┬──────────────────────────────────────┘   │
│                     │                                           │
│  ┌──────────────────▼──────────────────────────────────────┐   │
│  │  Custom Hooks                                           │   │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ • usePyodide()     → Python runtime (Pyodide)           │   │
│  │ • useAIChat()      → AI streaming chat                   │   │
│  │ • useAppStore()    → State access                        │   │
│  └──────┬──────────────┬──────────────────────────────────┘   │
│         │              │                                        │
│    ┌────▼──┐      ┌────▼──────┐                                │
│    │ Pyodide│      │ Monaco    │                                │
│    │ (CDN)  │      │ Editor    │                                │
│    └────────┘      └──────────┘                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/WebSocket
                            │
┌─────────────────────────────────────────────────────────────────┐
│                         Server (Next.js)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  API Routes                                            │    │
│  ├────────────────────────────────────────────────────────┤    │
│  │  POST /api/chat  → LLM Streaming Endpoint             │    │
│  │  • Takes chat messages + context                       │    │
│  │  • Builds system prompt with task info                │    │
│  │  • Streams response from DeepSeek API                 │    │
│  └────────────────────────────────────────────────────────┘    │
│                            │                                    │
│                            ▼                                    │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  DeepSeek LLM API                                      │    │
│  │  (External, via Environment Variable)                 │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

```
User Interaction
    │
    ├─→ Navigate lesson (Sidebar click)
    │   └─→ useAppStore.setCurrentLesson()
    │       └─→ Zustand updates state
    │           └─→ Components re-render
    │
    ├─→ Write code (Monaco Editor)
    │   └─→ CodePane state update
    │       └─→ usePyodide().runPython()
    │           └─→ Pyodide executes on client
    │               └─→ Show output
    │
    ├─→ Submit quiz
    │   └─→ useAppStore.submitQuizAnswer()
    │       └─→ Track in store + mistakes
    │
    ├─→ Run practice challenge
    │   └─→ PracticePane.runTests()
    │       └─→ Execute via Pyodide
    │           └─→ Update store progress
    │
    └─→ Ask AI Tutor
        └─→ useAIChat.sendMessage()
            └─→ POST /api/chat
                └─→ Streams LLM response
                    └─→ Display in AIChatPanel
```

---

## Directory Structure Details

### `/config`
**Purpose:** Configuration files for external services

**Files:**
- `ai_model.json` - LLM configuration (provider, endpoint, model, system prompt, temperature)

### `/src/app`
**Purpose:** Next.js App Router pages and API routes

**Files:**
- `layout.tsx` - Root layout, HTML structure, font imports
- `page.tsx` - Main home page (entry point)
- `globals.css` - Global styles, Tailwind theme, custom animations
- `api/chat/route.ts` - POST endpoint for AI chat (SSE streaming)

**Key Features:**
- Server-side rendering for initial load
- Client-side hydration for interactivity

### `/src/components`
**Purpose:** React components for UI

**Components:**
1. **Sidebar.tsx** - Left navigation sidebar
   - Module/lesson tree
   - Progress indicators
   - Mock exam button

2. **Header.tsx** - Top navigation bar
   - Progress bar
   - Language toggle (EN/中文/Both)
   - Streak counter
   - Module completion counter

3. **LessonView.tsx** - Main content container
   - Step navigation (Theory → Code → Quiz → Practice)
   - Renders appropriate pane based on currentStep
   - Manages visible steps based on module challenges

4. **TheoryPane.tsx** - Lesson content display
   - Bilingual markdown rendering
   - Side-by-side EN/中文 option
   - Continue button to progress

5. **CodePane.tsx** - Interactive code editor
   - Monaco editor integration
   - Pyodide runtime execution
   - Output display
   - Expected output comparison
   - Hint system with timer

6. **QuizPane.tsx** - Quiz interface
   - Multiple choice questions
   - Answer validation
   - Score calculation (70% pass)
   - Module completion logic
   - Next lesson navigation

7. **PracticePane.tsx** - Module challenge sandbox
   - Full-featured code editor
   - Test case runner
   - Progress tracking
   - Error explanation with AI
   - Attempt counter

8. **AIChatPanel.tsx** - AI tutor chat sidebar
   - Chat message display
   - Auto-scroll to latest
   - Streaming response handling
   - Context attachment (code, errors, task)
   - Auto-explain error trigger
   - Clear chat button

### `/src/content`
**Purpose:** Data files defining curriculum and challenges

**Files:**
1. **syllabus.json** - Complete course structure
   ```
   modules[]
   ├── id: string (m1, m2, m3, m4, m5)
   ├── title: string
   ├── description: string
   ├── icon: emoji
   ├── weight: percentage (exam weight)
   └── lessons[]
       ├── id: string (m1-l1, m1-l2, ...)
       ├── title: string
       ├── theory_en: markdown string
       ├── theory_zh: markdown string
       ├── interactiveCode: {initialCode, expectedOutput, hint}
       └── quizzes[]
           ├── id: string
           ├── question: string
           ├── options: string[]
           ├── correctAnswer: number (index)
           └── explanation: string
   ```

2. **challenges.json** - Module practical challenges
   ```
   challenges: {
     [moduleId]: [
       {
         id: string
         title: string
         description: string
         startingCode: string
         testCases[]: {label, setupCode, assertionCode}
         hint: string
         difficulty: "easy" | "medium" | "hard"
       }
     ]
   }
   ```

### `/src/lib`
**Purpose:** Custom React hooks for external services

**Hooks:**
1. **usePyodide.ts** - Python execution
   - Lazy loads Pyodide from CDN
   - Singleton instance pattern
   - Captures stdout/stderr
   - Error handling and cleanup

2. **useAIChat.ts** - AI chat interface
   - Manages chat messages state
   - Streaming response handler
   - Context attachment
   - Auto-explain error helper
   - Abort signal support

### `/src/store`
**Purpose:** Global state management

**File:** `useAppStore.ts` (Zustand)

**State Structure:**
```typescript
{
  // Navigation
  currentModuleId: string
  currentLessonId: string
  currentStep: 'theory' | 'code' | 'quiz' | 'practice'
  theoryLang: 'en' | 'zh' | 'both'

  // Progress Tracking
  lessonProgress: {
    [lessonId]: {
      lessonId: string
      theoryRead: boolean
      codeCompleted: boolean
      quizPassed: boolean
      quizAttempts: QuizAttempt[]
    }
  }
  completedModules: string[]

  // Gamification
  streak: {
    currentStreak: number
    lastActiveDate: string
    longestStreak: number
    activeDays: string[]
  }

  // Learning Analytics
  mistakes: QuizAttempt[]
  mockExamUnlocked: boolean
  mockExamScores: {score, total, date}[]

  // Practice Progress
  practiceProgress: {
    [moduleId]: {
      completed: boolean
      attempts: number
    }
  }
}
```

**Persistence:** Zustand middleware persists state to localStorage as "caip-trainer-progress"

---

## Core Components

### Component Hierarchy

```
App (page.tsx)
├── Sidebar
│   └── Navigation to lessons
├── Main Content Area
│   ├── Header
│   │   ├── Progress bar
│   │   ├── Language toggle
│   │   └── Streak display
│   └── LessonView
│       ├── Step Navigation (Pills)
│       └── Content Area
│           ├── TheoryPane (step: theory)
│           ├── CodePane (step: code)
│           ├── QuizPane (step: quiz)
│           ├── PracticePane (step: practice)
│           └── AIChatPanel (sidebar, all steps)
```

### Component Communication Pattern

**Props-based:**
- Components receive data via props
- Example: `LessonView` → `CodePane` gets `lesson` prop

**Zustand Store:**
- Components call store actions directly
- Example: `setCurrentStep()`, `markCodeCompleted()`
- Triggers re-renders for subscribers

**Context via Props (Limited):**
- `PracticePane` passes context to `AIChatPanel`
  ```
  context={{
    taskDesc: string
    studentCode: string
    errorMsg?: string
  }}
  ```

---

## State Management

### Zustand Store Pattern

```typescript
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // State
      currentModuleId: 'm1',
      currentLessonId: 'm1-l1',
      
      // Actions
      setCurrentLesson: (moduleId, lessonId) => 
        set({ currentModuleId: moduleId, currentLessonId: lessonId }),
      
      // Complex actions with state access
      getLessonProgress: (lessonId) => {
        const state = get();
        return state.lessonProgress[lessonId] || defaultProgress;
      }
    }),
    { name: 'caip-trainer-progress' }
  )
);
```

### State Flow for Lesson Navigation

```
User clicks lesson in Sidebar
  → Sidebar calls useAppStore.setCurrentLesson(moduleId, lessonId)
    → Zustand updates state
      → All subscribed components re-render
        → LessonView gets new currentModuleId, currentLessonId
          → Finds current lesson from syllabus
            → Renders appropriate pane
```

### State Flow for Quiz Completion

```
User selects quiz answer
  → QuizPane calls useAppStore.submitQuizAnswer()
    → Zustand updates lessonProgress[lessonId].quizAttempts
      → Also updates mistakes if answer wrong
        → Components re-render
  
User gets last question correct
  → QuizPane calls useAppStore.markQuizPassed()
    → Zustand updates lessonProgress[lessonId].quizPassed = true
      → Header/Sidebar show completion checkmark
  
If all lessons in module complete
  → QuizPane calls useAppStore.completeModule()
    → Zustand updates completedModules
    → If 5 modules done → mockExamUnlocked = true

User returns to home after each step
  → Zustand state persists via localStorage
    → On refresh, progress is restored
```

---

## API Layer

### Chat Endpoint: `POST /api/chat`

**Location:** `src/app/api/chat/route.ts`

**Request Body:**
```typescript
{
  messages: [
    { role: "user" | "assistant", content: string }
  ],
  context?: {
    taskDesc?: string          // Current task description
    studentCode?: string       // Student's code (optional)
    errorMsg?: string          // Error message (if any)
  }
}
```

**Response:**
- Server-Sent Events (SSE) stream
- Each event: `data: { content: string }`
- Stream terminator: `data: [DONE]`

**Flow:**
```
1. Client sends request via useAIChat.sendMessage()
2. Route extracts messages and context
3. buildSystemPrompt() templates system message with context
4. All messages assembled: [system, ...messages]
5. fetch() to DeepSeek API with stream: true
6. Response piped through custom ReadableStream
7. Each SSE chunk extracted and sent to client
8. Client accumulates response via setMessages()
```

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

**Error Handling:**
- Missing API key → 500 with error message
- Invalid request body → 400
- LLM API error → 502 with error details
- Connection error → 502

---

## Data Models

### Lesson
```typescript
interface Lesson {
  id: string                           // m1-l1, m1-l2, etc
  title: string                        // e.g., "Variables & Casting"
  theory_en: string                    // English markdown content
  theory_zh: string                    // Chinese markdown content
  interactiveCode: {
    initialCode: string                // Starting code template
    expectedOutput: string             // Expected console output
    hint: string                       // Hint for learner
  }
  quizzes: Quiz[]                      // Multiple choice questions
}
```

### Module
```typescript
interface Module {
  id: string                           // m1, m2, m3, m4, m5
  title: string                        // "Python Basics"
  description: string                  // Full description
  icon: string                         // Emoji (🐍, 📊, etc)
  weight: string                       // Exam weight ("25%")
  lessons: Lesson[]
}
```

### Challenge (Practical Task)
```typescript
interface Challenge {
  id: string                           // m1-c1, m2-c1, etc
  title: string                        // Challenge title
  description: string                  // What to build
  startingCode: string                 // Code template
  testCases: {
    label: string                      // "Test case 1"
    setupCode: string                  // Before-test setup
    assertionCode: string              // Test assertion
  }[]
  hint: string                         // Hint
  difficulty: "easy" | "medium" | "hard"
}
```

### Quiz Attempt
```typescript
interface QuizAttempt {
  quizId: string
  selectedAnswer: number               // Index of selected option
  correct: boolean
  timestamp: number
}
```

### Lesson Progress
```typescript
interface LessonProgress {
  lessonId: string
  theoryRead: boolean
  codeCompleted: boolean
  quizPassed: boolean
  quizAttempts: QuizAttempt[]
}
```

### Chat Message
```typescript
interface ChatMessage {
  role: "user" | "assistant"
  content: string
}
```

---

## Hooks & Utilities

### useAppStore
**Source:** `src/store/useAppStore.ts`

**Key Methods:**
```typescript
// Navigation
setCurrentLesson(moduleId, lessonId) → void
setCurrentStep(step) → void
setTheoryLang(lang) → void

// Progress Tracking
markTheoryRead(lessonId) → void
markCodeCompleted(lessonId) → void
submitQuizAnswer(lessonId, quizId, selectedAnswer, correct) → void
markQuizPassed(lessonId) → void
completeModule(moduleId) → void

// Gamification
updateStreak() → void
addMockExamScore(score, total) → void

// Query
getLessonProgress(lessonId) → LessonProgress
isLessonUnlocked(moduleId, lessonId) → boolean  // Currently always true
isModuleUnlocked(moduleId) → boolean             // Currently always true

// Practice
markPracticeCompleted(moduleId) → void
incrementPracticeAttempt(moduleId) → void

// Maintenance
resetProgress() → void
```

### usePyodide
**Source:** `src/lib/usePyodide.ts`

**Returns:**
```typescript
{
  status: "idle" | "loading" | "ready" | "error"
  error: string | null
  runPython: (code: string) => Promise<{
    output: string
    error: string | null
  }>
}
```

**Features:**
- Lazy loads Pyodide from CDN (v0.26.4)
- Singleton pattern (reuses same instance)
- Captures stdout/stderr
- Error extraction from Pyodide exceptions
- Proper cleanup on errors

### useAIChat
**Source:** `src/lib/useAIChat.ts`

**Returns:**
```typescript
{
  messages: ChatMessage[]
  isStreaming: boolean
  sendMessage(userMsg: string, context?: ChatContext) → Promise<void>
  explainError(errorMsg: string, context?: ChatContext) → Promise<void>
  stopStreaming() → void
  clearChat() → void
}
```

**Features:**
- Streaming message handler (SSE)
- Context attachment
- Auto-scroll to latest message
- Abort signal support (stop button)
- Error handling

---

## Data Flow

### Learning Flow: Lesson Completion

```
1. User navigates to module m1, lesson m1-l1 (via Sidebar)
   └─→ setCurrentLesson('m1', 'm1-l1')
       └─→ currentStep = 'theory'

2. User views theory content
   └─→ LessonView renders TheoryPane
       └─→ Shows lesson.theory_en/theory_zh based on theoryLang

3. User clicks "Continue to Code Practice"
   └─→ markTheoryRead('m1-l1')
   └─→ setCurrentStep('code')

4. CodePane renders with initial code
   └─→ User writes code in Monaco editor
   └─→ Runs code via usePyodide().runPython()
   └─→ Output displayed

5. User gets expected output match
   └─→ CodePane calls markCodeCompleted('m1-l1')
   └─→ "Continue to Quiz" button appears

6. User clicks "Continue to Quiz"
   └─→ setCurrentStep('quiz')

7. QuizPane displays first question
   └─→ User selects answer
   └─→ Clicks "Submit Answer"
   └─→ submitQuizAnswer('m1-l1', quizId, selectedAnswer, correct)
   └─→ If wrong, added to mistakes[]

8. User answers all questions
   └─→ If score >= 70%, markQuizPassed('m1-l1')
   └─→ Check if all lessons in m1 complete
   └─→ If yes, completeModule('m1')
   └─→ If all 5 modules complete, mockExamUnlocked = true

9. If module has challenges, "Module Challenge" button enabled
   └─→ setCurrentStep('practice')
   └─→ PracticePane renders with challenge

10. User runs tests via usePyodide()
    └─→ Test passes → markPracticeCompleted('m1')
    └─→ All challenges done
```

### AI Chat Flow

```
1. User clicks "AI Tutor" button in PracticePane
   └─→ AIChatPanel opens (isOpen = true)

2. User types message or error is auto-explained
   └─→ useAIChat.sendMessage(msg, context)
       or
       useAIChat.explainError(error, context)

3. Hook adds user message to messages[]
   └─→ POST /api/chat with messages + context

4. Server receives request
   └─→ buildSystemPrompt() with context
   └─→ Calls DeepSeek API with full message history
   └─→ Streams response as SSE

5. Client receives SSE stream
   └─→ Each chunk parsed as JSON
   └─→ setMessages() updates last assistant message incrementally

6. Response fully streamed
   └─→ isStreaming = false
   └─→ User can send new message
```

---

## Component Relationships

### Component Dependency Graph

```
page.tsx (main entry)
├── Sidebar
│   ├── useAppStore (read: currentModuleId, currentLessonId, lessonProgress)
│   ├── useAppStore (write: setCurrentLesson)
│   └── syllabus.json (import)
│
├── Header
│   ├── useAppStore (read: streak, completedModules, lessonProgress, theoryLang)
│   ├── useAppStore (write: setTheoryLang)
│   └── syllabus.json (read)
│
└── LessonView
    ├── useAppStore (read/write: currentStep, practice progress)
    ├── syllabus.json (find current lesson/module)
    ├── challenges.json (get module challenges)
    │
    ├── TheoryPane
    │   ├── useAppStore (write: markTheoryRead, setCurrentStep)
    │   ├── React Markdown
    │   └── remark-gfm
    │
    ├── CodePane
    │   ├── useAppStore (write: markCodeCompleted, setCurrentStep)
    │   ├── usePyodide (runPython)
    │   ├── Monaco Editor
    │   └── Dynamic import
    │
    ├── QuizPane
    │   ├── useAppStore (write/read: submitQuizAnswer, markQuizPassed, completeModule)
    │   ├── syllabus.json (find next lesson/module)
    │   └── challenges.json (check if practice exists)
    │
    ├── PracticePane
    │   ├── useAppStore (write: markPracticeCompleted, incrementPracticeAttempt)
    │   ├── usePyodide (runPython, run tests)
    │   ├── Monaco Editor
    │   └── AIChatPanel (child)
    │
    └── AIChatPanel
        ├── useAIChat (sendMessage, explainError, clearChat)
        ├── React Markdown
        ├── remark-gfm
        └── fetch /api/chat
```

### Data Dependencies

**syllabus.json:**
- Used by: Sidebar, Header, LessonView, QuizPane
- Provides: Module/lesson tree, theory content, quiz questions
- Not mutable (read-only)

**challenges.json:**
- Used by: LessonView, QuizPane, PracticePane
- Provides: Challenge definitions, test cases
- Not mutable (read-only)

**ai_model.json:**
- Used by: `/api/chat` route
- Provides: LLM config (endpoint, model, temperature, prompt template)
- Not mutable (read-only)

**useAppStore (Zustand):**
- Global mutable state
- Accessed by: All components
- Persisted to localStorage

---

## Learning Flow

### Complete User Journey

```
ONBOARDING
│
├─ Home Page
│  └─ Load page.tsx
│     └─ Check localStorage for saved progress
│        └─ If new user: load default state (m1-l1)
│        └─ If returning: restore from localStorage
│
└─ updateStreak() triggered
   └─ Check if today's date different from lastActiveDate
      └─ Increment currentStreak if consecutive day
      └─ Reset if gap

MAIN LEARNING LOOP
│
├─ Choose Module (Sidebar click)
│  └─ Choose Lesson (Sidebar click)
│     └─ View current step (Theory | Code | Quiz | Practice)
│
├─ STEP 1: THEORY
│  └─ Read content (EN, 中文, or bilingual)
│     └─ Click "Continue to Code Practice"
│        └─ markTheoryRead()
│        └─ setCurrentStep('code')
│
├─ STEP 2: CODE
│  └─ Write code in interactive editor
│     └─ Run code
│        └─ View output
│           └─ If matches expected output:
│              └─ markCodeCompleted()
│              └─ Show "Continue to Quiz" button
│
├─ STEP 3: QUIZ
│  └─ Answer multiple choice questions
│     └─ For each question:
│        └─ Select answer
│           └─ Submit
│              └─ submitQuizAnswer()
│              └─ Show explanation
│                 └─ Next question or results
│        └─ If score >= 70%:
│           └─ markQuizPassed()
│           └─ Check if module complete
│              └─ If yes: completeModule()
│
├─ STEP 4: PRACTICE (if available)
│  └─ Challenge sandbox
│     └─ Run challenge against test cases
│        └─ If all tests pass:
│           └─ markPracticeCompleted()
│
└─ MODULE COMPLETE
   └─ If all 5 modules done:
      └─ mockExamUnlocked = true
      └─ "Mock Exam" button in Sidebar becomes active

ANYTIME:
├─ Ask AI Tutor
│  └─ Open AIChatPanel (blue button)
│     └─ Ask question about code/concepts
│        └─ AI responds with guidance (not solutions)
│
├─ Click "Explain Error"
│  └─ Auto-send error to AI with context
│     └─ AI explains what went wrong
│     └─ Suggests debugging steps
│
└─ View Progress
   └─ Header shows:
      └─ Overall completion %
      └─ Lessons completed / total
      └─ Current streak
      └─ Modules completed
```

### Lesson Structure

Each lesson in a module has 4 phases:

**Phase 1: Theory (Reading)**
- Interactive markdown with code examples
- Bilingual support (EN/中文)
- Estimated read time: 5-10 min
- Marked complete when user clicks "Continue"

**Phase 2: Code (Practice)**
- Guided coding exercise
- Monaco editor with syntax highlighting
- Pyodide runs code in browser
- Expected output shown
- Hint available (timer after 3 min)
- Completed when output matches expected

**Phase 3: Quiz (Assessment)**
- 2-3 multiple choice questions
- Immediate feedback with explanation
- 70% pass rate required
- Failed attempt tracked in mistakes book
- Can retry unlimited times

**Phase 4: Practice (Challenge) - Optional**
- Complex coding challenge (if module has challenges.json)
- Multiple test cases
- Full code editor with error handling
- AI tutor available for errors
- Tracks attempts and completion

---

## Technical Stack Details

### Frontend Technologies

**React 19**
- Latest hooks API
- Built-in useTransition, useDeferredValue
- Automatic batch updates

**Next.js 15**
- App Router (file-based routing)
- Server components by default ("use client" opts in)
- API routes (route handlers)
- Automatic code splitting

**Zustand 5**
- Lightweight state management (~800 bytes)
- Persist middleware for localStorage
- Selector optimization
- No unnecessary re-renders

**Tailwind CSS 4**
- Utility-first CSS
- Built-in dark mode support
- Custom theme colors (brand colors)
- PostCSS integration

**Monaco Editor 4.6**
- Full IDE-like code editing
- Syntax highlighting for Python
- Keyboard shortcuts (Ctrl+Enter to run)
- Responsive sizing

**React Markdown 9 + Remark GFM 4**
- Parse markdown to React components
- GitHub Flavored Markdown support (tables, strikethrough, etc)
- Code block syntax highlighting

### Python Runtime

**Pyodide v0.26.4**
- Python 3.11 in WebAssembly
- Loaded from CDN on first use
- Lazy initialization
- Full Python stdlib included
- Regular expressions, JSON, etc all work

**How it works:**
1. First code run triggers Pyodide load from CDN (~30MB)
2. Takes ~5 seconds on first load
3. Subsequent runs instant
4. Runs entirely in browser (no server needed)
5. Full stdout/stderr capture for feedback

### Backend / API

**Next.js API Routes**
- `/api/chat` - POST endpoint for chat
- Server-side environment variables for API keys
- No authentication layer (assumed development/demo)

**DeepSeek LLM API**
- Streaming text generation
- Server-Sent Events (SSE)
- Model: deepseek-chat
- Temperature: 0.3 (more consistent, less random)
- System prompt templated with task context

**Environment Variables:**
```
LLM_API_KEY=sk-deepseek-api-key-here
```

### Build & Deployment

**Development:**
```bash
npm run dev
# Starts Next.js dev server on http://localhost:3000
```

**Production Build:**
```bash
npm run build
npm run start
```

**Linting:**
```bash
npm run lint
```

### Styling System

**Color Palette (USAII CAIP Brand):**
```
--color-brand-purple-deep: #3B0764   (Dark backgrounds)
--color-brand-purple:      #6B21A8   (Secondary accents)
--color-brand-magenta:     #A21CAF   (Primary accents, active states)
--color-brand-gold:        #F5A623   (Success, highlights)
--color-brand-gold-light:  #FCD34D   (Light highlights)
--color-brand-white:       #F8FAFC   (Light text)
--color-brand-dark:        #0F172A   (Very dark background)
```

**Typography:**
- Font: Inter (sans-serif)
- Fallback: ui-sans-serif, system-ui

**Custom Animations:**
- `shimmer` - Background shimmer effect
- `pulse-gold` - Gold pulse glow (button focus)
- Built-in Tailwind animations: `animate-bounce`, `animate-spin`, `animate-pulse`

---

## Configuration Files

### package.json
```json
{
  "name": "caip-python-trainer",
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@monaco-editor/react": "^4.6.0",
    "framer-motion": "^11.15.0",
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0",
    "zustand": "^5.0.0"
  }
}
```

Note: framer-motion included but not currently used

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "paths": { "@/*": ["./src/*"] }
  }
}
```

Enables `@/` import alias for src/ directory

### next.config.mjs
Minimal config (default Next.js settings)

### postcss.config.mjs
Standard PostCSS with Tailwind plugin

---

## Key Design Patterns

### 1. Server-Side Data (Content)
**Pattern:** Import JSON files directly
```typescript
import syllabus from "@/content/syllabus.json";
import challenges from "@/content/challenges.json";
```
- Bundled into application at build time
- Zero runtime overhead
- Type-safe (TypeScript understands JSON structure)

### 2. Client-Side State
**Pattern:** Zustand with localStorage persistence
```typescript
export const useAppStore = create<AppState>()(
  persist((set, get) => ({...}), {name: 'key'})
);
```
- State survives page refresh
- No server sync needed
- Instant load from localStorage

### 3. Lazy Component Loading
**Pattern:** Dynamic import for heavy components
```typescript
const MonacoEditor = dynamic(
  () => import("@monaco-editor/react"),
  { ssr: false }
);
```
- Monaco (large bundle) only loaded when CodePane/PracticePane renders
- SSR disabled (Monaco requires DOM)

### 4. Streaming API Responses
**Pattern:** Server-Sent Events (SSE) via Web Streams API
```typescript
const stream = new ReadableStream({
  async start(controller) {
    // Stream chunks as they arrive from LLM
  }
});
return new Response(stream, {headers: SSE headers});
```
- Immediate response feel (no wait for full response)
- Used for AI chat
- Server pushes data to client

### 5. Context-Based AI Prompting
**Pattern:** Template system prompt with task context
```
systemPrompt = template.replace("{task_desc}", context.taskDesc);
```
- AI tutor stays in context of current task
- Can reference student's code
- Can explain errors from the lesson

### 6. Progressive Enhancement
- Page loads and shows content immediately (no spinners for whole page)
- Pyodide loads in background
- Monaco loads on demand
- Features gracefully degrade if services unavailable

---

## Summary: How Everything Connects

1. **User navigates** → Sidebar calls `useAppStore.setCurrentLesson()`
2. **Zustand updates** → All subscribed components re-render
3. **LessonView renders** → Shows appropriate step pane (Theory/Code/Quiz/Practice)
4. **User writes code** → Monaco editor state updated locally
5. **User clicks Run** → CodePane calls `usePyodide().runPython()` (client-side execution)
6. **Pyodide executes** → Returns output/error
7. **Output matches?** → CodePane calls `markCodeCompleted()` (state update)
8. **User asks AI** → AIChatPanel calls `useAIChat.sendMessage()`
9. **Hook sends POST** → `/api/chat` route receives request
10. **Server templates prompt** → Includes task context from request body
11. **Server calls DeepSeek** → LLM API (external)
12. **Streams response** → SSE back to client
13. **Client renders markdown** → Displays AI response in chat
14. **State persists** → Zustand saves to localStorage automatically

---

## Code Organization Best Practices Observed

✅ **Separation of Concerns**
- Components: UI rendering
- Hooks: Business logic & state
- Store: Global state
- Content: Data files

✅ **Type Safety**
- Full TypeScript
- Interfaces for all major types
- No `any` types

✅ **Modularity**
- Components are focused and single-purpose
- Hooks encapsulate external services
- Easy to test and refactor

✅ **Performance**
- Lazy loading (Monaco, Pyodide)
- Dynamic imports
- Zustand selectors prevent unnecessary re-renders

✅ **User Experience**
- Loading states
- Error handling with AI explanation
- Bilingual support
- Progress tracking and gamification

