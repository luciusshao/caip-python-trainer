# CAIP Python Trainer - Project Exploration Summary

## 1. Brand Color Scheme (from globals.css)

The project uses a sophisticated USAII CAIP brand color palette with deep purples, magenta, and gold accents:

```css
--color-brand-purple-deep: #3B0764    /* Deep purple - main dark bg */
--color-brand-purple: #6B21A8         /* Mid purple - accents, borders */
--color-brand-magenta: #A21CAF        /* Magenta - secondary accent */
--color-brand-gold: #F5A623           /* Gold - primary accent */
--color-brand-gold-light: #FCD34D     /* Light gold - highlights */
--color-brand-white: #F8FAFC          /* Off-white - text */
--color-brand-dark: #0F172A           /* Very dark - fallback */
```

### Color Usage in UI:
- **Backgrounds**: `#3B0764` (brand-purple-deep) with backdrop blur for depth
- **Borders & Dividers**: `#6B21A8` (brand-purple) with opacity
- **Progress Indicators**: Gradient from gold to light-gold
- **Interactive Elements**: Gold backgrounds for active states
- **Code Blocks**: `#1e1b4b` background with gold text
- **Scrollbars**: Purple (#6B21A8) on purple tracks
- **Table Headers**: Deep purple (#3B0764) background with gold text

### Custom Animations Defined:
- **shimmer**: Horizontal gradient animation for loading states (gold-based, 2s loop)
- **pulse-gold**: Box-shadow pulse effect with gold color (2s loop)

---

## 2. Project Structure - Next.js 15 App Router

### Root Level Files:
```
caip-python-trainer/
├── src/                          # Source code
├── public/                        # Static assets
├── config/                        # Configuration
├── Doc/                          # Documentation
├── .next/                        # Build output
├── node_modules/                 # Dependencies
├── package.json                  # Dependencies list
├── tsconfig.json                # TypeScript config
├── postcss.config.mjs            # PostCSS config
├── next.config.mjs               # Next.js config
├── eslint.config.mjs             # ESLint config
├── .env.local                    # Environment variables
└── CLAUDE.md                     # Project documentation
```

### src/app Directory Structure (App Router):
```
src/app/
├── layout.tsx                    # Root layout component
├── page.tsx                      # Home page (main app)
├── globals.css                   # Global styles & @theme
├── api/
│   └── chat/
│       └── route.ts              # Chat API endpoint
```

### src Components Directory:
```
src/components/
├── Header.tsx                    # Top bar with progress, language toggle, streak
├── Sidebar.tsx                   # Left navigation (learning map)
├── LessonView.tsx               # Main lesson display container
├── TheoryPane.tsx               # Theory content display
├── CodePane.tsx                 # Code editor pane
├── QuizPane.tsx                 # Quiz interface
├── PracticePane.tsx             # Practice challenges
└── AIChatPanel.tsx              # AI chat interface
```

### src Supporting Directories:
```
src/
├── app/                          # App Router pages
├── components/                   # React components
├── store/
│   └── useAppStore.ts           # Zustand state management
├── lib/
│   ├── useAIChat.ts             # AI chat hook
│   └── usePyodide.ts            # Python execution hook
└── content/
    ├── syllabus.json            # Course structure
    └── challenges.json          # Practice challenges
```

---

## 3. App Router Organization

The project follows Next.js 15 App Router conventions:

- **`layout.tsx`**: Root layout with global metadata, Inter font import, and base styling
  - Applies `bg-brand-dark`, `text-white`, `antialiased` classes
  - Sets up HTML lang and font CDN

- **`page.tsx`**: Main home page (client component with "use client")
  - Renders 2-column layout: Sidebar + Main content
  - Main content has Header + LessonView
  - Uses Zustand store for state
  - Initial streak update on mount

- **`globals.css`**: Contains Tailwind import, theme variables, and custom styles
  - `@import "tailwindcss"` - Tailwind CSS v4
  - `@theme` block for brand color variables
  - Custom scrollbar styling
  - Markdown prose styling
  - Animation keyframes

- **`api/chat/route.ts`**: API route for chat functionality

---

## 4. Dependencies (package.json)

### Production Dependencies:
```json
{
  "@monaco-editor/react": "^4.6.0",      // Code editor component
  "framer-motion": "^11.15.0",            // Animation library
  "next": "^15.1.0",                      // Next.js framework
  "react": "^19.0.0",                     // React library
  "react-dom": "^19.0.0",                 // React DOM
  "react-markdown": "^9.0.0",             // Markdown rendering
  "remark-gfm": "^4.0.0",                 // GitHub Flavored Markdown
  "zustand": "^5.0.0"                     // State management
}
```

### Development Dependencies:
```json
{
  "@eslint/eslintrc": "^3.0.0",
  "@tailwindcss/postcss": "^4.0.0",       // Tailwind CSS v4
  "@types/node": "^22.0.0",
  "@types/react": "^19.0.0",
  "@types/react-dom": "^19.0.0",
  "eslint": "^9.0.0",
  "eslint-config-next": "^15.1.0",
  "playwright": "^1.50.0",                // E2E testing
  "postcss": "^8.4.0",                    // CSS processor
  "tailwindcss": "^4.0.0",                // Tailwind CSS v4
  "typescript": "^5.7.0"                  // TypeScript
}
```

### Key Findings:
- ✅ **GSAP is NOT installed** - Uses Framer Motion for animations instead
- Modern tech stack: React 19, Next.js 15, Tailwind CSS 4, TypeScript 5
- Includes Monaco Editor for code editing
- Has Playwright for testing
- Uses Zustand for lightweight state management

---

## 5. Tailwind/CSS Configuration

### Tailwind CSS v4 Setup:
- **PostCSS Config** (`postcss.config.mjs`):
  ```javascript
  const config = {
    plugins: ["@tailwindcss/postcss"],
  };
  export default config;
  ```
  
- **Tailwind Integration**:
  - Uses new `@tailwindcss/postcss` plugin (v4 approach)
  - No separate `tailwind.config.ts` file
  - Configuration is done via `@theme` in `globals.css`

### CSS Architecture (globals.css):
1. **Tailwind Import**: `@import "tailwindcss";`
2. **Theme Variables**: Custom CSS variables via `@theme` block
3. **Custom Scrollbars**: WebKit scrollbar styling
4. **Markdown Styling**: Prose class styles for rendered markdown
5. **Custom Animations**: Shimmer and pulse-gold keyframes
6. **TypeScript Config** (`tsconfig.json`):
   - Path alias: `@/*` → `./src/*`
   - Target: ES2017
   - Module: esnext
   - Strict mode enabled

---

## 6. Key Architectural Insights

### State Management:
- **Zustand Store** (`useAppStore.ts`):
  - Persists progress to localStorage
  - Tracks: current lesson, theory language, quiz results, streaks, mock exam scores
  - Features: Lesson unlock logic, practice progress, mistake tracking

### Component Architecture:
- **2-Column Layout**: Sidebar navigation + Main content area
- **Tabbed Lesson View**: Theory → Code → Quiz → Practice steps
- **Language Support**: English, Chinese, or both (toggleable)
- **Progress Tracking**: Visual progress bar, completed lessons counter

### Content Structure:
- **syllabus.json**: Defines modules and lessons
- **challenges.json**: Practice challenge definitions
- **MongoDB/Backend**: API at `/api/chat` for AI interactions

### UI/UX Features:
- **Daily Streak System**: Tracks consecutive active days
- **Module Completion**: Tracks completed modules
- **Mistake Book**: Records incorrect quiz answers
- **Mock Exams**: Unlocked after completing modules
- **Language Toggle**: Switch between EN/中文/EN+中文

---

## 7. TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

- TypeScript 5.7, strict mode, ES2017 target
- Path aliases for cleaner imports
- JSX preserved for Next.js compilation

---

## Summary

This is a **modern Next.js 15 educational platform** with:
- ✅ Sophisticated USAII brand color scheme (purple/gold)
- ✅ App Router architecture (no pages/ directory)
- ✅ Framer Motion for animations (NOT GSAP)
- ✅ Tailwind CSS v4 with custom theme
- ✅ Zustand for state + localStorage persistence
- ✅ Monaco editor for code practice
- ✅ i18n support (English/Chinese)
- ✅ Gamification (streaks, modules, mock exams)
- ✅ Responsive 2-column layout
- ✅ Rich content support (markdown, code highlighting)
