"use client";

import { useState, useEffect, useCallback } from "react";

interface TokenSummary {
  totalTokens: number;
  totalPrompt: number;
  totalCompletion: number;
  totalRequests: number;
}

interface StudentUsage {
  studentId: string;
  displayName: string;
  username: string;
  totalTokens: number;
  requests: number;
}

interface DateUsage {
  date: string;
  totalTokens: number;
  requests: number;
}

interface ModelUsage {
  model: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  requests: number;
}

interface TokenData {
  summary: TokenSummary;
  byStudent: StudentUsage[];
  byDate: DateUsage[];
  byModel: ModelUsage[];
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-brand-purple-deep/40 border border-brand-purple/20 rounded-xl p-5">
      <span className="text-2xl">{icon}</span>
      <p className="text-2xl font-bold text-brand-gold mt-2">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  );
}

function BarChart({ data, maxValue }: { data: DateUsage[]; maxValue: number }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">暂无数据</div>
    );
  }

  return (
    <div className="flex items-end gap-1 h-40">
      {data.map((d) => {
        const height = maxValue > 0 ? (d.totalTokens / maxValue) * 100 : 0;
        return (
          <div
            key={d.date}
            className="flex-1 flex flex-col items-center group relative min-w-0"
          >
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
              <div className="bg-brand-purple-deep border border-brand-purple/40 rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-lg">
                <p className="text-white font-medium">{d.date}</p>
                <p className="text-brand-gold">{formatNumber(d.totalTokens)} tokens</p>
                <p className="text-gray-400">{d.requests} 次请求</p>
              </div>
            </div>
            {/* Bar */}
            <div
              className="w-full bg-brand-gold/80 rounded-t-sm hover:bg-brand-gold transition-colors min-h-[2px]"
              style={{ height: `${Math.max(height, 1)}%` }}
            />
            {/* Label (show every few) */}
            {data.length <= 14 || data.indexOf(d) % Math.ceil(data.length / 7) === 0 ? (
              <span className="text-[9px] text-gray-600 mt-1 truncate w-full text-center">
                {d.date.slice(5)}
              </span>
            ) : (
              <span className="text-[9px] text-transparent mt-1">.</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function TokenUsagePage() {
  const [data, setData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"7d" | "30d" | "all">("30d");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/token-usage?range=${range}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch token usage:", err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const maxDateTokens =
    data?.byDate.reduce((max, d) => Math.max(max, d.totalTokens), 0) || 0;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Token 消耗</h1>
          <p className="text-sm text-gray-400 mt-1">
            查看 AI 辅导对话的 token 用量
          </p>
        </div>

        {/* Range selector */}
        <div className="flex bg-brand-purple-deep/60 border border-brand-purple/30 rounded-lg overflow-hidden">
          {(["7d", "30d", "all"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                range === r
                  ? "bg-brand-magenta text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {r === "7d" ? "7 天" : r === "30d" ? "30 天" : "全部"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">加载中...</p>
      ) : !data ? (
        <p className="text-gray-500">加载失败</p>
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon="🔥"
              label="总 Token"
              value={formatNumber(data.summary.totalTokens)}
            />
            <StatCard
              icon="💬"
              label="总请求数"
              value={data.summary.totalRequests.toString()}
            />
            <StatCard
              icon="📤"
              label="Prompt Tokens"
              value={formatNumber(data.summary.totalPrompt)}
            />
            <StatCard
              icon="📥"
              label="Completion Tokens"
              value={formatNumber(data.summary.totalCompletion)}
            />
          </div>

          {/* Date chart */}
          <div className="bg-brand-purple-deep/40 border border-brand-purple/20 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">
              按日期消耗趋势
            </h2>
            <BarChart data={data.byDate} maxValue={maxDateTokens} />
          </div>

          {/* Two columns: By Student + By Model */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* By student */}
            <div className="lg:col-span-2 bg-brand-purple-deep/40 border border-brand-purple/20 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-brand-purple/20">
                <h2 className="text-sm font-semibold text-white">
                  按学生统计
                </h2>
              </div>

              {data.byStudent.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  暂无数据
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-brand-purple/20 text-xs text-gray-400">
                      <th className="text-left px-5 py-3">学生</th>
                      <th className="text-right px-5 py-3">Token</th>
                      <th className="text-right px-5 py-3">请求</th>
                      <th className="text-right px-5 py-3">占比</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-purple/10">
                    {data.byStudent.map((s) => {
                      const percent =
                        data.summary.totalTokens > 0
                          ? ((s.totalTokens / data.summary.totalTokens) * 100).toFixed(1)
                          : "0";
                      return (
                        <tr
                          key={s.studentId}
                          className="hover:bg-brand-purple/10 transition"
                        >
                          <td className="px-5 py-3">
                            <p className="text-sm text-white">
                              {s.displayName}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              @{s.username}
                            </p>
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-brand-gold font-medium">
                            {formatNumber(s.totalTokens)}
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-gray-400">
                            {s.requests}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-brand-purple/30 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-brand-gold rounded-full"
                                  style={{
                                    width: `${Math.min(
                                      parseFloat(percent),
                                      100
                                    )}%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs text-gray-400 w-10 text-right">
                                {percent}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* By model */}
            <div className="bg-brand-purple-deep/40 border border-brand-purple/20 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-brand-purple/20">
                <h2 className="text-sm font-semibold text-white">
                  按模型分类
                </h2>
              </div>

              {data.byModel.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  暂无数据
                </div>
              ) : (
                <div className="p-5 space-y-4">
                  {data.byModel.map((m) => (
                    <div
                      key={m.model}
                      className="bg-white/5 rounded-lg p-4"
                    >
                      <p className="text-sm font-medium text-white mb-2">
                        {m.model}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-gray-500">总 Token</p>
                          <p className="text-brand-gold font-medium">
                            {formatNumber(m.totalTokens)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">请求数</p>
                          <p className="text-white">{m.requests}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Prompt</p>
                          <p className="text-gray-300">
                            {formatNumber(m.promptTokens)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Completion</p>
                          <p className="text-gray-300">
                            {formatNumber(m.completionTokens)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
