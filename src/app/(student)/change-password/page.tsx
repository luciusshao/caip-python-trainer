"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("新密码至少需要 6 个字符");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/student/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (res.ok) {
        router.push("/");
      } else {
        setError(data.error || "修改失败，请重试");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-brand-purple-deep/60 backdrop-blur-sm border border-brand-purple/30 rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">🔐</div>
            <h1 className="text-xl font-bold text-white">修改密码</h1>
            <p className="text-sm text-gray-400 mt-2">
              首次登录需要修改初始密码
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                当前密码
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="请输入当前密码"
                className="w-full bg-white/5 border border-brand-purple/30 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-brand-gold/50 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                新密码
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少 6 个字符"
                className="w-full bg-white/5 border border-brand-purple/30 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-brand-gold/50 transition-colors"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                确认新密码
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
                className="w-full bg-white/5 border border-brand-purple/30 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-brand-gold/50 transition-colors"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700/30 rounded-lg p-3">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-brand-gold to-brand-gold-light text-brand-dark font-bold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "修改中..." : "确认修改"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
