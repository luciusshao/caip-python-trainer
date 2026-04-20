"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
  { href: "/teacher", icon: "📊", label: "Overview" },
  { href: "/teacher/students", icon: "👥", label: "Students" },
  { href: "/teacher/courses", icon: "📚", label: "Courses" },
  { href: "/teacher/token-usage", icon: "🔥", label: "Token Usage" },
  { href: "/teacher/settings", icon: "⚙️", label: "Settings" },
];

export default function TeacherSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push("/login");
  };

  return (
    <aside className="w-56 bg-brand-purple-deep/80 border-r border-brand-purple/30 flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-brand-purple/20">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎓</span>
          <div>
            <p className="text-sm font-bold text-white">CAIP Trainer</p>
            <p className="text-[10px] text-gray-500">Teacher Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/teacher"
              ? pathname === "/teacher"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive
                  ? "bg-brand-magenta/20 text-white font-medium border border-brand-magenta/30"
                  : "text-gray-400 hover:text-white hover:bg-brand-purple/20"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-brand-purple/20">
        <button
          onClick={handleLogout}
          className="w-full px-3 py-2 text-xs text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-900/20 transition-all text-left flex items-center gap-2"
        >
          <span>🚪</span> Logout
        </button>
      </div>
    </aside>
  );
}
