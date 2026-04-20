"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { clientEnv, clientFeatures } from "@/lib/client-env";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const missingParams = !token || !email;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("密码至少需要 6 个字符");
      return;
    }
    if (password !== confirm) {
      setError("两次密码不一致");
      return;
    }
    if (clientFeatures.turnstile && !turnstileToken) {
      setError("请完成人机验证");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, newPassword: password, turnstileToken }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || "重置失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  if (missingParams) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark p-4">
        <div className="max-w-md w-full bg-brand-purple-deep/60 border border-brand-purple/30 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-white mb-2">链接无效</h1>
          <p className="text-sm text-gray-400 mb-6">请检查邮件中的链接是否完整。</p>
          <Link
            href="/forgot-password"
            className="inline-block px-6 py-2.5 bg-gradient-to-r from-brand-gold to-brand-gold-light text-brand-dark font-semibold rounded-lg text-sm"
          >
            重新申请
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark p-4">
        <div className="max-w-md w-full bg-brand-purple-deep/60 border border-brand-purple/30 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-xl font-bold text-white mb-2">密码已重置</h1>
          <p className="text-sm text-gray-400 mb-6">请使用新密码登录。</p>
          <button
            onClick={() => router.push("/login")}
            className="px-6 py-2.5 bg-gradient-to-r from-brand-gold to-brand-gold-light text-brand-dark font-semibold rounded-lg text-sm"
          >
            去登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark p-4">
      <div className="max-w-md w-full bg-brand-purple-deep/60 border border-brand-purple/30 rounded-2xl p-8">
        <h1 className="text-xl font-bold text-white text-center mb-1">设置新密码</h1>
        <p className="text-xs text-gray-400 text-center mb-6">
          账号：<span className="text-brand-gold">{email}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">新密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-white/5 border border-brand-purple/30 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-brand-gold/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">确认新密码</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              className="w-full bg-white/5 border border-brand-purple/30 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-brand-gold/50 transition-colors"
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
            {loading ? "重置中..." : "重置密码"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-dark" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
