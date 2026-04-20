"use client";

import { useState } from "react";
import Link from "next/link";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { clientEnv, clientFeatures } from "@/lib/client-env";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (clientFeatures.turnstile && !turnstileToken) {
      setError("请完成人机验证");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, turnstileToken }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError(data.error || "请求失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark p-4">
        <div className="max-w-md w-full bg-brand-purple-deep/60 border border-brand-purple/30 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">📬</div>
          <h1 className="text-xl font-bold text-white mb-2">请查收邮箱</h1>
          <p className="text-sm text-gray-400 mb-6">
            如果 <span className="text-brand-gold">{email}</span> 已注册，我们已发送重置链接。
            链接 1 小时内有效。
          </p>
          <Link
            href="/login"
            className="inline-block text-xs text-gray-400 hover:text-brand-gold"
          >
            ← 返回登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark p-4">
      <div className="max-w-md w-full bg-brand-purple-deep/60 border border-brand-purple/30 rounded-2xl p-8">
        <h1 className="text-xl font-bold text-white text-center mb-1">忘记密码</h1>
        <p className="text-xs text-gray-400 text-center mb-6">
          输入注册邮箱，我们将发送重置链接
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full bg-white/5 border border-brand-purple/30 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-brand-gold/50 transition-colors"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-900/30 border border-red-700/30 p-2.5">
              <p className="text-xs text-red-400 text-center">{error}</p>
            </div>
          )}

          {clientFeatures.turnstile && (
            <TurnstileWidget
              siteKey={clientEnv.turnstileSiteKey}
              onToken={setTurnstileToken}
            />
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-brand-gold to-brand-gold-light text-brand-dark font-semibold rounded-lg text-sm disabled:opacity-50"
          >
            {loading ? "发送中..." : "发送重置链接"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          <Link href="/login" className="hover:text-brand-gold">
            ← 返回登录
          </Link>
        </p>
      </div>
    </div>
  );
}
