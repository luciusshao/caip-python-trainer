"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { clientEnv, clientFeatures } from "@/lib/client-env";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<
    null | { requiresVerification: boolean; emailSent: boolean }
  >(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("密码至少需要 6 个字符");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次密码不一致");
      return;
    }
    if (clientFeatures.turnstile && !turnstileToken) {
      setError("请完成人机验证");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName, turnstileToken }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess({
          requiresVerification: data.requiresEmailVerification,
          emailSent: data.emailSent ?? true,
        });
      } else {
        setError(data.error || "注册失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    const emailFailed = success.requiresVerification && !success.emailSent;
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark p-4">
        <div className="max-w-md w-full bg-brand-purple-deep/60 border border-brand-purple/30 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">{emailFailed ? "⚠️" : "✉️"}</div>
          <h1 className="text-xl font-bold text-white mb-2">注册成功</h1>
          {success.requiresVerification ? (
            emailFailed ? (
              <>
                <p className="text-sm text-gray-300 mb-2">
                  账号 <span className="text-brand-gold">{email}</span> 已创建，
                  但验证邮件暂时发送失败。
                </p>
                <p className="text-xs text-gray-400 mb-6">
                  请稍后通过&ldquo;忘记密码&rdquo;重新触发邮件，或联系管理员协助验证。
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-400 mb-4">
                  我们已发送验证邮件到 <span className="text-brand-gold">{email}</span>
                </p>
                <p className="text-xs text-gray-500 mb-6">
                  请查收邮件并点击链接完成验证后即可登录。
                </p>
              </>
            )
          ) : (
            <p className="text-sm text-gray-400 mb-6">
              你可以直接登录使用账号（当前开发环境未启用邮件验证）。
            </p>
          )}
          <button
            onClick={() => router.push("/login")}
            className="w-full py-2.5 bg-gradient-to-r from-brand-gold to-brand-gold-light text-brand-dark font-semibold rounded-lg text-sm"
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
        <h1 className="text-xl font-bold text-white text-center mb-1">注册账号</h1>
        <p className="text-xs text-gray-400 text-center mb-6">
          邮箱 + 密码注册，或使用第三方登录
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">显示名称（可选）</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="你希望怎么被称呼"
              className="w-full bg-white/5 border border-brand-purple/30 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-brand-gold/50 transition-colors"
            />
          </div>

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

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">密码（至少 6 位）</label>
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
            <label className="block text-xs text-gray-400 mb-1.5">确认密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {loading ? "注册中..." : "注册"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          已有账号？{" "}
          <Link href="/login" className="text-brand-gold hover:underline">
            去登录
          </Link>
        </p>
      </div>
    </div>
  );
}
