"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAIChat } from "@/lib/useAIChat";

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  context?: {
    taskDesc?: string;
    studentCode?: string;
    errorMsg?: string;
  };
  /** Auto-send an error explanation when this changes */
  autoExplainError?: string | null;
}

export default function AIChatPanel({
  isOpen,
  onClose,
  context,
  autoExplainError,
}: AIChatPanelProps) {
  const { messages, isStreaming, sendMessage, explainError, stopStreaming, clearChat } =
    useAIChat();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastExplainedError = useRef<string | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-explain error when triggered
  useEffect(() => {
    if (autoExplainError && autoExplainError !== lastExplainedError.current) {
      lastExplainedError.current = autoExplainError;
      explainError(autoExplainError, context);
    }
  }, [autoExplainError, context, explainError]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    sendMessage(trimmed, context);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 lg:w-96 flex flex-col bg-[#0d0221] border-l border-brand-purple/30 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-purple/20 bg-brand-purple-deep/50">
        <div className="flex items-center gap-2">
          <img src="/ai-tutor-icon.png" alt="AI" className="w-6 h-6" />
          <span className="text-sm font-semibold text-white">AI Tutor</span>
          {context?.errorMsg && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-900/50 text-red-400">
              Error context
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearChat}
            className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded transition-colors"
            title="Clear chat"
          >
            🗑
          </button>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white px-2 py-1 rounded transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 text-sm mt-8 space-y-2">
            <p className="text-3xl">🐍</p>
            <p>Hi! I&apos;m your AI Python Tutor.</p>
            <p className="text-xs text-gray-600">
              Ask me about your code, errors, or Python concepts.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-brand-magenta/30 text-white border border-brand-magenta/20"
                  : "bg-brand-purple/20 text-gray-200 border border-brand-purple/20"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-invert prose-sm max-w-none [&_pre]:bg-[#1e1b4b] [&_pre]:border [&_pre]:border-brand-purple/30 [&_code]:text-brand-gold-light [&_p]:my-1">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content || (isStreaming && idx === messages.length - 1 ? "..." : "")}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="flex justify-center">
            <button
              onClick={stopStreaming}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors px-3 py-1 rounded-full border border-gray-700"
            >
              ■ Stop
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Context badges */}
      {context && (context.studentCode || context.errorMsg) && (
        <div className="px-4 py-1 border-t border-brand-purple/10 flex gap-1 flex-wrap">
          {context.studentCode && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-purple/30 text-gray-400">
              📎 Code attached
            </span>
          )}
          {context.errorMsg && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-900/30 text-red-400">
              📎 Error attached
            </span>
          )}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-brand-purple/20 p-3">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your code..."
            rows={2}
            className="flex-1 bg-brand-purple/10 border border-brand-purple/30 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 resize-none outline-none focus:border-brand-magenta/50 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="self-end px-3 py-2 bg-brand-magenta hover:bg-brand-magenta/80 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
