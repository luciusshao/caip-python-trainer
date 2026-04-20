"use client";

import { useState, useEffect } from "react";

interface DashboardData {
  totalStudents: number;
  activeToday: number;
  avgStreak: number;
  avgCompletion: number;
  recentStudents: {
    id: string;
    displayName: string;
    username: string;
    lastLoginAt: string | null;
    completedModules: number;
  }[];
}

export default function TeacherDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teacher/dashboard")
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <p className="text-red-400">加载失败</p>
      </div>
    );
  }

  const stats = [
    { label: "学生总数", value: data.totalStudents, icon: "👥", color: "text-brand-gold" },
    { label: "今日活跃", value: data.activeToday, icon: "🟢", color: "text-green-400" },
    { label: "平均完成度", value: `${data.avgCompletion}%`, icon: "📊", color: "text-brand-magenta" },
    { label: "平均 Streak", value: data.avgStreak, icon: "🔥", color: "text-orange-400" },
  ];

  return (
    <div className="p-8">
      {/* Title */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">教学概览</h1>
        <p className="text-sm text-gray-400 mt-1">查看你的学生学习情况</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-brand-purple-deep/60 border border-brand-purple/30 rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{stat.icon}</span>
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Students */}
      <div className="bg-brand-purple-deep/40 border border-brand-purple/20 rounded-xl">
        <div className="px-5 py-4 border-b border-brand-purple/20">
          <h2 className="text-sm font-semibold text-white">最近活跃学生</h2>
        </div>
        {data.recentStudents.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            暂无学生数据
          </div>
        ) : (
          <div className="divide-y divide-brand-purple/10">
            {data.recentStudents.map((s) => (
              <div
                key={s.id}
                className="px-5 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm text-white">{s.displayName}</p>
                  <p className="text-xs text-gray-500">@{s.username}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-brand-gold">
                    {s.completedModules}/5 模块
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {s.lastLoginAt
                      ? new Date(s.lastLoginAt).toLocaleDateString("zh-CN")
                      : "未登录"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
