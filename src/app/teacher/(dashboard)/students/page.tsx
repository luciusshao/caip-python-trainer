"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface StudentItem {
  id: string;
  username: string | null;
  displayName: string;
  email: string | null;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  completedModules: number;
  completionPercent: number;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchStudents = useCallback(async () => {
    const params = search ? `?q=${encodeURIComponent(search)}` : "";
    const res = await fetch(`/api/teacher/students${params}`);
    if (res.ok) {
      const data = await res.json();
      setStudents(data);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">学生管理</h1>
          <p className="text-sm text-gray-400 mt-1">
            共 {students.length} 名学生
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索学生姓名或账号..."
          className="w-full max-w-sm bg-white/5 border border-brand-purple/30 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-brand-magenta/50"
        />
      </div>

      {/* Student Table */}
      {loading ? (
        <p className="text-gray-500">加载中...</p>
      ) : students.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-3xl mb-2">👥</p>
          <p>暂无学生</p>
        </div>
      ) : (
        <div className="bg-brand-purple-deep/40 border border-brand-purple/20 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-brand-purple/20 text-xs text-gray-400">
                <th className="text-left px-5 py-3">姓名</th>
                <th className="text-left px-5 py-3">邮箱 / 账号</th>
                <th className="text-left px-5 py-3">最后登录</th>
                <th className="text-left px-5 py-3">进度</th>
                <th className="text-right px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-purple/10">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-brand-purple/10 transition">
                  <td className="px-5 py-3">
                    <p className="text-sm text-white">{s.displayName}</p>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-400">
                    {s.email || s.username || "—"}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {s.lastLoginAt
                      ? new Date(s.lastLoginAt).toLocaleDateString("zh-CN")
                      : "未登录"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-brand-purple/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-gold rounded-full"
                          style={{
                            width: `${Math.min(
                              (s.completedModules / 5) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">
                        {s.completedModules}/5
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/teacher/students/${s.id}`}
                      className="text-xs text-brand-gold hover:underline"
                    >
                      详情
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
