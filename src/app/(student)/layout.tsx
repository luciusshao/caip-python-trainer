"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const updateStreak = useAppStore((s) => s.updateStreak);

  useEffect(() => {
    updateStreak();
  }, [updateStreak]);

  return <>{children}</>;
}
