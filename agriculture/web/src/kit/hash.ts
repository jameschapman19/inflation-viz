// GENERATED from packages/web-kit/src — edit there, then run: node scripts/sync-web-kit.mjs
"use client";

import { useSyncExternalStore } from "react";

const subscribe = (callback: () => void) => {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
};

/**
 * The URL hash (including the leading `#`) as external state. The server
 * snapshot is empty, so the first client render matches the server's; once
 * mounted, the real hash applies. Pair with `setHash` so every state of a
 * page is a shareable link.
 */
export function useHash(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash, () => "");
}

/** Replaces the hash without adding history entries and notifies `useHash`. */
export function setHash(value: string): void {
  window.history.replaceState(null, "", value ? `#${value}` : window.location.pathname + window.location.search);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
