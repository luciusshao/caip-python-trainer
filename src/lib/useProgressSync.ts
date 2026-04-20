"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";

const DEBOUNCE_MS = 2000;

export function useProgressSync() {
  const hydrateFromServer = useAppStore((s) => s.hydrateFromServer);
  const getProgressSnapshot = useAppStore((s) => s.getProgressSnapshot);
  const hasSynced = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount: fetch server progress and hydrate store
  useEffect(() => {
    if (hasSynced.current) return;
    hasSynced.current = true;

    fetch("/api/student/progress")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        hydrateFromServer(data);
      })
      .catch((err) => {
        console.warn("Failed to fetch progress from server:", err);
      });
  }, [hydrateFromServer]);

  // Subscribe to store changes: debounced write to server
  useEffect(() => {
    const unsub = useAppStore.subscribe(() => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        const snapshot = getProgressSnapshot();
        fetch("/api/student/progress", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(snapshot),
        }).catch((err) => {
          console.warn("Failed to sync progress to server:", err);
        });
      }, DEBOUNCE_MS);
    });

    return () => {
      unsub();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [getProgressSnapshot]);
}
