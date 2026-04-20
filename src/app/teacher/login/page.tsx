"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TeacherLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/teacher/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push("/teacher");
      } else {
        setError(data.error || "登录失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-brand-purple-deep/60 backdrop-blur-sm border border-brand-purple/30 rounded-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-brand-purple/30 border border-brand-purple/40 mb-4">
              <span className="text-2xl">🎓</span>
            </div>
            <h1 className="text-lg font-bold text-white">CAIP Trainer</h1>
            <p className="text-xs text-gray-400 mt-1">教师管理端</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                账号
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入教师账号"
                className="w-full bg-white/5 border border-brand-purple/30 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-brand-magenta/50 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full bg-white/5 border border-brand-purple/30 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-brand-magenta/50 transition-colors"
                required
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700/30 rounded-lg p-2.5">
                <p className="text-xs text-red-400 text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full py-2.5 bg-brand-magenta hover:bg-brand-magenta/80 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "登录中..." : "登录"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-brand-purple/20 text-center">
            <a
              href="/login"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              学生登录入口 →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
