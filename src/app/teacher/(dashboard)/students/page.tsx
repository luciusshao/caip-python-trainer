"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface StudentItem {
  id: string;
  username: string;
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
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [createError, setCreateError] = useState("");
  const [createdInfo, setCreatedInfo] = useState<{
    username: string;
    password: string;
  } | null>(null);
  const [resetInfo, setResetInfo] = useState<{
    username: string;
    password: string;
  } | null>(null);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    try {
      const res = await fetch("/api/teacher/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: newName, username: newUsername }),
      });
      const data = await res.json();
      if (res.ok) {
        setCreatedInfo({
          username: data.username,
          password: data.initialPassword,
        });
        setNewName("");
        setNewUsername("");
        setShowCreate(false);
        fetchStudents();
      } else {
        setCreateError(data.error || "创建失败");
      }
    } catch {
      setCreateError("网络错误");
    }
  };

  const handleResetPassword = async (id: string, username: string) => {
    if (!confirm(`确定要重置 ${username} 的密码吗？`)) return;
    try {
      const res = await fetch(`/api/teacher/students/${id}/reset-password`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setResetInfo({ username, password: data.newPassword });
        fetchStudents();
      }
    } catch {
      alert("重置失败");
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">学生管理</h1>
          <p className="text-sm text-gray-400 mt-1">
            共 {students.length} 名学生
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-brand-magenta hover:bg-brand-magenta/80 text-white text-sm font-semibold rounded-lg transition-all"
        >
          + 创建学生
        </button>
      </div>

      {/* Password info banners */}
      {createdInfo && (
        <div className="mb-4 bg-green-900/30 border border-green-700/30 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-green-400">
              学生 <strong>{createdInfo.username}</strong> 创建成功
            </p>
            <p className="text-xs text-gray-400 mt-1">
              初始密码：
              <code className="bg-black/30 px-2 py-0.5 rounded text-brand-gold">
                {createdInfo.password}
              </code>
              （请妥善保存，仅显示一次）
            </p>
          </div>
          <button
            onClick={() => setCreatedInfo(null)}
            className="text-gray-500 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {resetInfo && (
        <div className="mb-4 bg-yellow-900/30 border border-yellow-700/30 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-yellow-400">
              <strong>{resetInfo.username}</strong> 密码已重置
            </p>
            <p className="text-xs text-gray-400 mt-1">
              新密码：
              <code className="bg-black/30 px-2 py-0.5 rounded text-brand-gold">
                {resetInfo.password}
              </code>
              （请妥善保存，仅显示一次）
            </p>
          </div>
          <button
            onClick={() => setResetInfo(null)}
            className="text-gray-500 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

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

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-brand-purple-deep border border-brand-purple/40 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">创建学生</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  姓名
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="学生姓名"
                  className="w-full bg-white/5 border border-brand-purple/30 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  账号
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="登录账号（唯一）"
                  className="w-full bg-white/5 border border-brand-purple/30 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  required
                />
              </div>
              {createError && (
                <p className="text-xs text-red-400">{createError}</p>
              )}
              <p className="text-[10px] text-gray-500">
                系统将自动生成初始密码，学生首次登录需修改
              </p>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-brand-magenta text-white text-sm rounded-lg"
                >
                  创建
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setCreateError("");
                  }}
                  className="flex-1 py-2 border border-brand-purple/30 text-gray-400 text-sm rounded-lg"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Table */}
      {loading ? (
        <p className="text-gray-500">加载中...</p>
      ) : students.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-3xl mb-2">👥</p>
          <p>暂无学生，点击&ldquo;创建学生&rdquo;开始</p>
        </div>
      ) : (
        <div className="bg-brand-purple-deep/40 border border-brand-purple/20 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-brand-purple/20 text-xs text-gray-400">
                <th className="text-left px-5 py-3">姓名</th>
                <th className="text-left px-5 py-3">账号</th>
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
                    {s.mustChangePassword && (
                      <span className="text-[10px] text-yellow-400">
                        待改密码
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-400">
                    {s.username}
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
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/teacher/students/${s.id}`}
                        className="text-xs text-brand-gold hover:underline"
                      >
                        详情
                      </Link>
                      <button
                        onClick={() =>
                          handleResetPassword(s.id, s.username)
                        }
                        className="text-xs text-gray-500 hover:text-yellow-400 transition"
                      >
                        重置密码
                      </button>
                    </div>
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
