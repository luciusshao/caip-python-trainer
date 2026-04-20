"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");

  const messages = {
    ok: {
      icon: "✅",
      title: "邮箱验证成功",
      desc: "你的账号已激活，现在可以登录了。",
    },
    expired: {
      icon: "⌛",
      title: "验证链接已过期",
      desc: "请重新注册或申请新的验证邮件。",
    },
    invalid: {
      icon: "❌",
      title: "验证链接无效",
      desc: "请检查邮件中的链接是否完整。",
    },
    error: {
      icon: "⚠️",
      title: "验证失败",
      desc: "服务器错误，请稍后重试。",
    },
  } as const;

  const msg = status && status in messages
    ? messages[status as keyof typeof messages]
    : {
        icon: "✉️",
        title: "等待验证",
        desc: "请查收邮箱并点击验证链接。",
      };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark p-4">
      <div className="max-w-md w-full bg-brand-purple-deep/60 border border-brand-purple/30 rounded-2xl p-8 text-center">
        <div className="text-5xl mb-4">{msg.icon}</div>
        <h1 className="text-xl font-bold text-white mb-2">{msg.title}</h1>
        <p className="text-sm text-gray-400 mb-6">{msg.desc}</p>
        <Link
          href="/login"
          className="inline-block px-6 py-2.5 bg-gradient-to-r from-brand-gold to-brand-gold-light text-brand-dark font-semibold rounded-lg text-sm"
        >
          去登录
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-dark" />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
