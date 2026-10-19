"use client";

import { useSyncExternalStore } from "react";

// State changes are applied to `pending` at once so the UI stays responsive,
// while the actual `history.replaceState` is throttled: browsers rate-limit it
// (Safari throws after about 100 calls in 30 seconds), and Next's router
// mirrors each call with one of its own, so a 30-second replay at one step
// every half second would otherwise hit the limit. The first write goes out
// at once and later ones at most once a second; the last always follows.
const FLUSH_MS = 1000;
let pending: string | null = null;
let timer: number | null = null;
let lastFlush = 0;
const listeners = new Set<() => void>();

function flush() {
  timer = null;
  lastFlush = Date.now();
  if (pending === null) return;
  window.history.replaceState(null, "", pending || window.location.pathname + window.location.search);
  pending = null;
}

function subscribe(callback: () => void) {
  // A real hashchange (back/forward, an edited URL) supersedes anything pending.
  const onHashChange = () => {
    pending = null;
    callback();
  };
  window.addEventListener("hashchange", onHashChange);
  listeners.add(callback);
  return () => {
    window.removeEventListener("hashchange", onHashChange);
    listeners.delete(callback);
  };
}

/**
 * The URL hash (including the leading `#`) as external state. The server
 * snapshot is empty, so the first client render matches the server's; once
 * mounted, the real hash applies. Pair with `setHash` so every state of a
 * page is a shareable link.
 */
export function useHash(): string {
  return useSyncExternalStore(subscribe, () => pending ?? window.location.hash, () => "");
}

/** The hash as the page currently shows it, including a change still waiting to be written to the URL. */
export function currentHash(): string {
  return pending ?? window.location.hash;
}

/** Sets the hash without adding history entries. Subscribers update at once; the URL follows shortly after. */
export function setHash(value: string): void {
  pending = value ? `#${value}` : "";
  listeners.forEach((listener) => listener());
  if (timer === null) timer = window.setTimeout(flush, Math.max(0, FLUSH_MS - (Date.now() - lastFlush)));
}
