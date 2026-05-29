"use client";

import { useCallback, useSyncExternalStore } from "react";

const TICK_MS = 1000;

const listeners = new Set<() => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;
let currentMs = 0;

function tick() {
  currentMs = Date.now();
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (listeners.size === 1 && typeof window !== "undefined") {
    currentMs = Date.now();
    intervalId = setInterval(tick, TICK_MS);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getServerSnapshot(): number {
  return 0;
}

export function useNow(bucketMs: number = TICK_MS): number {
  const getSnapshot = useCallback(() => {
    if (currentMs === 0) return 0;
    return Math.floor(currentMs / bucketMs) * bucketMs;
  }, [bucketMs]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
