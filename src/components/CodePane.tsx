"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useAppStore } from "@/store/useAppStore";
import { usePyodide } from "@/lib/usePyodide";
import AIChatPanel from "./AIChatPanel";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface Lesson {
  id: string;
  title: string;
  theory_en: string;
  theory_zh: string;
  interactiveCode: { initialCode: string; expectedOutput: string; hint: string };
  quizzes: { id: string; question: string; options: string[]; correctAnswer: number; explanation: string }[];
}

export default function CodePane({ lesson }: { lesson: Lesson }) {
  const { markCodeCompleted, setCurrentStep } = useAppStore();
  const { status: pyodideStatus, runPython } = usePyodide();
  const [code, setCode] = useState(lesson.interactiveCode.initialCode);
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [hintTimer, setHintTimer] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [autoExplainError, setAutoExplainError] = useState<string | null>(null);
  const editorRef = useRef<unknown>(null);

  // Reset code when lesson changes
  useEffect(() => {
    setCode(lesson.interactiveCode.initialCode);
    setOutput("");
    setIsCorrect(null);
    setShowHint(false);
  }, [lesson.id, lesson.interactiveCode.initialCode]);

  // Start hint timer (show after 3 min)
  useEffect(() => {
    setHintTimer(false);
    const timer = setTimeout(() => setHintTimer(true), 180000);
    return () => clearTimeout(timer);
  }, [lesson.id]);

  const runCode = useCallback(async () => {
    setIsRunning(true);
    setOutput("");
    setIsCorrect(null);

    const result = await runPython(code);

    if (result.error) {
      const errorOutput = result.output ? result.output + "\n" + result.error : result.error;
      setOutput(errorOutput);
      setIsCorrect(false);
      setAutoExplainError(result.error);
    } else {
      const trimmedOutput = result.output.trimEnd();
      setOutput(trimmedOutput || "(No output — add a print() statement)");
      const correct = trimmedOutput === lesson.interactiveCode.expectedOutput.trim();
      setIsCorrect(correct);
      if (correct) markCodeCompleted(lesson.id);
    }

    setIsRunning(false);
  }, [code, lesson, markCodeCompleted, runPython]);

  const pyodideReady = pyodideStatus === "ready";

  // Handle Ctrl/Cmd+Enter in Monaco
  const handleEditorMount = (editor: unknown) => {
    editorRef.current = editor;
    const monacoEditor = editor as { addCommand: (keybinding: number, handler: () => void) => void };
    monacoEditor.addCommand(
      // KeyMod.CtrlCmd | KeyCode.Enter (2048 | 3)
      2048 | 3,
      () => {
        runCode();
      }
    );
  };

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Code Editor */}
        <div className="flex-1 flex flex-col border-r border-brand-purple/20">
          {/* Task Instructions */}
          <div className="border-b border-brand-purple/20 px-4 py-3 bg-brand-purple-deep/30 overflow-y-auto max-h-[30%]">
            <h3 className="text-sm font-bold text-brand-gold mb-1.5">📝 {lesson.title}</h3>
            <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
              {lesson.interactiveCode.initialCode
                .split("\n")
                .filter((line) => line.startsWith("#"))
                .map((line) => line.replace(/^#\s?/, ""))
                .join("\n")}
            </pre>
          </div>

          {/* Editor Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-[#0d0221] border-b border-brand-purple/20">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <span className="text-xs text-gray-500 ml-2">main.py</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                pyodideStatus === "ready"
                  ? "bg-green-900/50 text-green-400"
                  : pyodideStatus === "loading"
                  ? "bg-yellow-900/50 text-yellow-400"
                  : pyodideStatus === "error"
                  ? "bg-red-900/50 text-red-400"
                  : "bg-gray-800 text-gray-500"
              }`}>
                {pyodideStatus === "ready"
                  ? "🐍 Python Ready"
                  : pyodideStatus === "loading"
                  ? "⏳ Loading Python..."
                  : pyodideStatus === "error"
                  ? "❌ Engine Error"
                  : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-600">⌘+Enter to run</span>
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className={`px-2 py-1.5 text-xs rounded-md transition-all flex items-center gap-1 ${
                  chatOpen
                    ? "bg-brand-magenta/30 text-brand-magenta border border-brand-magenta/30"
                    : "bg-brand-purple/20 text-gray-400 hover:text-white border border-brand-purple/30"
                }`}
              >
                <img src="/ai-tutor-icon.png" alt="AI" className="w-4 h-4" /> AI Tutor
              </button>
              <button
                onClick={runCode}
                disabled={isRunning || !pyodideReady}
                className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isRunning ? (
                  <>
                    <span className="animate-spin">⟳</span> Running...
                  </>
                ) : !pyodideReady ? (
                  <>⏳ Loading...</>
                ) : (
                  <>▶ Run</>
                )}
              </button>
            </div>
          </div>

          {/* Code Area */}
          <div className="flex-1 overflow-hidden relative">
            {pyodideStatus === "loading" ? (
              <div className="h-full bg-[#0d0221] flex items-center justify-center">
                <div className="bg-brand-purple-deep/90 border border-brand-purple/40 rounded-xl px-6 py-4 text-center">
                  <div className="text-3xl mb-2 animate-bounce">🐍</div>
                  <p className="text-sm text-gray-300">Loading Python Engine...</p>
                  <p className="text-[10px] text-gray-500 mt-1">First load takes ~5 seconds</p>
                </div>
              </div>
            ) : (
              <MonacoEditor
                height="100%"
                language="python"
                theme="vs-dark"
                value={code}
                onChange={(v) => setCode(v || "")}
                onMount={handleEditorMount}
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

        {/* Output Panel */}
        <div className="flex-1 flex flex-col max-h-[50%] lg:max-h-full">
          {/* Output */}
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-2 bg-[#0d0221] border-b border-brand-purple/20 flex items-center justify-between">
              <span className="text-xs text-gray-400">Output</span>
              {isCorrect !== null && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    isCorrect
                      ? "bg-green-900/50 text-green-400"
                      : "bg-red-900/50 text-red-400"
                  }`}
                >
                  {isCorrect ? "✓ Correct!" : "✗ Try again"}
                </span>
              )}
            </div>
            <div className="flex-1 bg-[#0a0118] p-4 font-mono text-sm overflow-y-auto">
              {output ? (
                <pre className="text-gray-300 whitespace-pre-wrap">{output}</pre>
              ) : (
                <p className="text-gray-600 italic">Click &quot;Run&quot; to see output...</p>
              )}
            </div>
          </div>

          {/* Expected Output & Hint */}
          <div className="border-t border-brand-purple/20 p-4 bg-brand-purple-deep/30 space-y-3">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Expected Output</p>
              <pre className="text-xs text-brand-gold font-mono bg-brand-purple/20 p-2 rounded">
                {lesson.interactiveCode.expectedOutput}
              </pre>
            </div>

            {/* Hint Button */}
            <div>
              {showHint ? (
                <div className="bg-brand-gold/10 border border-brand-gold/20 rounded-lg p-3">
                  <p className="text-xs text-brand-gold-light flex items-center gap-1.5">
                    <span>💡</span> {lesson.interactiveCode.hint}
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => setShowHint(true)}
                  className={`text-xs text-gray-500 hover:text-brand-gold transition-colors flex items-center gap-1 ${
                    hintTimer ? "animate-pulse text-brand-gold/60" : ""
                  }`}
                >
                  💡 {hintTimer ? "Need a hint?" : "Show hint"}
                </button>
              )}
            </div>

            {/* Continue to Quiz */}
            {isCorrect && (
              <button
                onClick={() => setCurrentStep("quiz")}
                className="w-full py-2 bg-gradient-to-r from-brand-magenta to-brand-purple rounded-lg font-semibold text-sm text-white hover:shadow-lg transition-all"
              >
                Continue to Quiz →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* AI Tutor Panel */}
      <AIChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        context={{
          taskDesc: lesson.title,
          studentCode: code,
          errorMsg: output && isCorrect === false ? output : undefined,
        }}
        autoExplainError={autoExplainError}
      />
    </div>
  );
}
