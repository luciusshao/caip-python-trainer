"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useProgressSync } from "@/lib/useProgressSync";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const updateStreak = useAppStore((s) => s.updateStreak);

  // Sync progress with server (fetch on mount, debounced write on change)
  useProgressSync();

  useEffect(() => {
    updateStreak();
  }, [updateStreak]);

  return <>{children}</>;
}
