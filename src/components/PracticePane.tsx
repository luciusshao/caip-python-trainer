"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { useAppStore } from "@/store/useAppStore";
import { usePyodide } from "@/lib/usePyodide";
import AIChatPanel from "./AIChatPanel";

// Dynamically import Monaco to avoid SSR issues
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface TestCase {
  label: string;
  setupCode: string;
  assertionCode: string;
}

interface PracticalTask {
  title: string;
  description: string;
  startingCode: string;
  testCases: TestCase[];
  hint: string;
}

interface PracticePaneProps {
  practicalTask: PracticalTask;
  moduleId: string;
}

interface TestResult {
  label: string;
  passed: boolean;
  error?: string;
}

export default function PracticePane({ practicalTask, moduleId }: PracticePaneProps) {
  const { markPracticeCompleted, incrementPracticeAttempt, practiceProgress } =
    useAppStore();
  const { status: pyodideStatus, runPython } = usePyodide();
  const [code, setCode] = useState(practicalTask.startingCode);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [autoExplainError, setAutoExplainError] = useState<string | null>(null);

  const isCompleted = practiceProgress[moduleId]?.completed;
  const attempts = practiceProgress[moduleId]?.attempts || 0;

  // Reset when task changes
  useEffect(() => {
    setCode(practicalTask.startingCode);
    setTestResults([]);
    setLastError(null);
    setShowHint(false);
    setAutoExplainError(null);
  }, [practicalTask.startingCode]);

  const runTests = useCallback(async () => {
    setIsRunning(true);
    setTestResults([]);
    setLastError(null);
    incrementPracticeAttempt(moduleId);

    const results: TestResult[] = [];

    for (const testCase of practicalTask.testCases) {
      const fullCode = `${code}\n${testCase.setupCode}\n${testCase.assertionCode}`;
      const result = await runPython(fullCode);

      if (result.error) {
        results.push({
          label: testCase.label,
          passed: false,
          error: result.error,
        });
        setLastError(result.error);
      } else {
        results.push({ label: testCase.label, passed: true });
      }
    }

    setTestResults(results);

    // Check if all passed
    const allPassed = results.every((r) => r.passed);
    if (allPassed) {
      markPracticeCompleted(moduleId);
    }

    setIsRunning(false);
  }, [code, practicalTask.testCases, moduleId, runPython, markPracticeCompleted, incrementPracticeAttempt]);

  const handleExplainError = (error: string) => {
    setAutoExplainError(error);
    setChatOpen(true);
  };

  const pyodideReady = pyodideStatus === "ready";
  const passedCount = testResults.filter((r) => r.passed).length;
  const totalTests = practicalTask.testCases.length;

  return (
    <div className="h-full flex overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Code Editor */}
        <div className="flex-1 flex flex-col border-r border-brand-purple/20">
          {/* Editor Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-[#0d0221] border-b border-brand-purple/20">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <span className="text-xs text-gray-500 ml-2">challenge.py</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  pyodideStatus === "ready"
                    ? "bg-green-900/50 text-green-400"
                    : pyodideStatus === "loading"
                    ? "bg-yellow-900/50 text-yellow-400"
                    : "bg-red-900/50 text-red-400"
                }`}
              >
                {pyodideStatus === "ready"
                  ? "🐍 Ready"
                  : pyodideStatus === "loading"
                  ? "⏳ Loading..."
                  : "❌ Error"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                  chatOpen
                    ? "bg-brand-magenta text-white"
                    : "bg-brand-purple/30 text-gray-300 hover:bg-brand-purple/50"
                }`}
              >
                <img src="/ai-tutor-icon.png" alt="AI" className="w-4 h-4" /> AI Tutor
              </button>
              <button
                onClick={runTests}
                disabled={isRunning || !pyodideReady}
                className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isRunning ? (
                  <>
                    <span className="animate-spin">⟳</span> Running...
                  </>
                ) : (
                  <>▶ Run Tests</>
                )}
              </button>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 overflow-hidden">
            {pyodideStatus === "loading" ? (
              <div className="h-full bg-black/30 flex items-center justify-center">
                <div className="bg-brand-purple-deep/90 border border-brand-purple/40 rounded-xl px-6 py-4 text-center">
                  <div className="text-3xl mb-2 animate-bounce">🐍</div>
                  <p className="text-sm text-gray-300">Loading Python Engine...</p>
                </div>
              </div>
            ) : (
              <MonacoEditor
                height="100%"
                language="python"
                theme="vs-dark"
                value={code}
                onChange={(v) => setCode(v || "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 4,
                  wordWrap: "on",
                  padding: { top: 12 },
                }}
              />
            )}
          </div>
        </div>

        {/* Right: Task Description + Test Results */}
        <div className="flex-1 flex flex-col max-h-[50%] lg:max-h-full">
          {/* Task Description */}
          <div className="border-b border-brand-purple/20 p-4 bg-brand-purple-deep/30 overflow-y-auto max-h-[40%]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-brand-gold flex items-center gap-2">
                🏆 {practicalTask.title}
              </h3>
              {isCompleted && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-400">
                  ✓ Completed
                </span>
              )}
            </div>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
              {practicalTask.description}
            </p>
            <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
              <span>📋 {totalTests} test cases</span>
              {attempts > 0 && <span>🔄 {attempts} attempts</span>}
            </div>
          </div>

          {/* Test Results */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 bg-[#0d0221] border-b border-brand-purple/20 flex items-center justify-between">
              <span className="text-xs text-gray-400">Test Results</span>
              {testResults.length > 0 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    passedCount === totalTests
                      ? "bg-green-900/50 text-green-400"
                      : "bg-yellow-900/50 text-yellow-400"
                  }`}
                >
                  {passedCount}/{totalTests} passed
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {testResults.length === 0 ? (
                <p className="text-gray-600 italic text-sm">
                  Click &quot;Run Tests&quot; to check your solution...
                </p>
              ) : (
                testResults.map((result, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg p-3 border text-sm ${
                      result.passed
                        ? "bg-green-900/20 border-green-700/30"
                        : "bg-red-900/20 border-red-700/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={result.passed ? "text-green-400" : "text-red-400"}>
                        {result.passed ? "✓" : "✗"} {result.label}
                      </span>
                    </div>
                    {result.error && (
                      <div className="mt-2 space-y-2">
                        <pre className="text-xs text-red-300 bg-red-900/30 p-2 rounded overflow-x-auto whitespace-pre font-mono leading-relaxed">
                          {result.error}
                        </pre>
                        <button
                          onClick={() => handleExplainError(result.error!)}
                          className="text-xs text-brand-gold hover:text-brand-gold-light transition-colors flex items-center gap-1"
                        >
                          ✨ Explain Error with AI
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* All passed celebration */}
              {testResults.length > 0 && passedCount === totalTests && (
                <div className="mt-4 text-center p-4 bg-green-900/20 border border-green-700/30 rounded-xl">
                  <div className="text-4xl mb-2">🎉</div>
                  <p className="text-green-400 font-bold">All Tests Passed!</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Challenge complete. Great job!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Hint */}
          <div className="border-t border-brand-purple/20 p-3 bg-brand-purple-deep/30">
            {showHint ? (
              <div className="bg-brand-gold/10 border border-brand-gold/20 rounded-lg p-3">
                <p className="text-xs text-brand-gold-light flex items-start gap-1.5">
                  <span className="shrink-0">💡</span>
                  <span>{practicalTask.hint}</span>
                </p>
              </div>
            ) : (
              <button
                onClick={() => setShowHint(true)}
                className="text-xs text-gray-500 hover:text-brand-gold transition-colors flex items-center gap-1"
              >
                💡 Show hint
              </button>
            )}
          </div>
        </div>
      </div>

      {/* AI Chat Sidebar */}
      <AIChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        context={{
          taskDesc: `${practicalTask.title}: ${practicalTask.description}`,
          studentCode: code,
          errorMsg: lastError || undefined,
        }}
        autoExplainError={autoExplainError}
      />
    </div>
  );
}
