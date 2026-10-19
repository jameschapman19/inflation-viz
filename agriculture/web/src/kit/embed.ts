// GENERATED from packages/web-kit/src — edit there, then run: node scripts/sync-web-kit.mjs
/**
 * Inline script for `<head>`: `?embed=1` marks the document before first
 * paint, and `kit.css` then hides the site chrome. Pair it with
 * `suppressHydrationWarning` on `<html>`.
 */
export const EMBED_SCRIPT = `if(/[?&]embed=1(&|$)/.test(location.search))document.documentElement.dataset.embed="1"`;
