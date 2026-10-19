// GENERATED from packages/web-kit/src — edit there, then run: node scripts/sync-web-kit.mjs
"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** "?embed=1" while the page is in embed mode, else "". Append it to in-app links so an embedded page stays embedded. */
export function useEmbedSearch(): string {
  return useSyncExternalStore(subscribe, () => (/[?&]embed=1(&|$)/.test(window.location.search) ? "?embed=1" : ""), () => "");
}
