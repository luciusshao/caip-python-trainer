"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

export default function ProfilePage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/student/profile")
      .then((res) => res.json())
      .then((data) => {
        setDisplayName(data.displayName || "");
        setUsername(data.username || "");
        setEmail(data.email || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/student/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email }),
      });
      if (res.ok) {
        setMessage("保存成功");
      } else {
        setMessage("保存失败，请重试");
      }
    } catch {
      setMessage("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-dark flex items-center justify-center">
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-brand-purple-deep/60 backdrop-blur-sm border border-brand-purple/30 rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">👤</div>
            <h1 className="text-xl font-bold text-white">个人资料</h1>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                用户名（不可修改）
              </label>
              <input
                type="text"
                value={username}
                disabled
                className="w-full bg-white/5 border border-brand-purple/20 rounded-lg px-4 py-3 text-sm text-gray-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                显示名称
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-white/5 border border-brand-purple/30 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-brand-gold/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                邮箱（用于密码重置）
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-white/5 border border-brand-purple/30 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-brand-gold/50 transition-colors"
              />
            </div>

            {message && (
              <p
                className={`text-xs text-center ${
                  message.includes("成功") ? "text-green-400" : "text-red-400"
                }`}
              >
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-gradient-to-r from-brand-gold to-brand-gold-light text-brand-dark font-bold rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-brand-purple/20 space-y-3">
            <button
              onClick={() => router.push("/change-password")}
              className="w-full py-2.5 text-sm text-gray-400 hover:text-white border border-brand-purple/30 rounded-lg transition-colors"
            >
              修改密码
            </button>
            <button
              onClick={() => router.push("/")}
              className="w-full py-2.5 text-sm text-gray-400 hover:text-white border border-brand-purple/30 rounded-lg transition-colors"
            >
              ← 返回学习
            </button>
            <button
              onClick={handleLogout}
              className="w-full py-2.5 text-sm text-red-400 hover:text-red-300 border border-red-900/30 rounded-lg transition-colors"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
