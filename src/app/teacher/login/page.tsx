"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy redirect: /teacher/login is kept for bookmarks but now forwards
 * to the unified /login. Post-login, role-based routing sends teachers to /teacher.
 */
export default function TeacherLoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login?callbackUrl=/teacher");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-dark text-gray-400 text-sm">
      正在跳转到统一登录页...
    </div>
  );
}
