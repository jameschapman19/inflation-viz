// GENERATED from packages/web-kit/src — edit there, then run: node scripts/sync-web-kit.mjs
"use client";

import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { currentHash } from "./hash";

const subscribe = () => () => {};
const canShare = () => typeof navigator.share === "function";

type Status = "idle" | "copied" | "failed";

/**
 * Copy the link, share it with the device's share sheet where there is one,
 * and download the page's share card. The link is built from where the page is
 * now, including a hash change still waiting to reach the URL, and without
 * `?embed=1`. `card` says the page has its own `opengraph-image`, which the
 * download button links to.
 */
export function ShareBar({ title, card = false, filename }: { title: string; card?: boolean; filename: string }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>("idle");
  const nativeShare = useSyncExternalStore(subscribe, canShare, () => false);

  const link = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("embed");
    return `${url.origin}${url.pathname}${url.search}${currentHash()}`;
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(link());
      setStatus("copied");
    } catch {
      // Clipboard access can be refused (permissions, an insecure context): say so rather than pretend.
      setStatus("failed");
    }
    window.setTimeout(() => setStatus("idle"), 2500);
  }

  return (
    <div className="share-bar">
      <button type="button" onClick={copy}>
        Copy link
      </button>
      {nativeShare && (
        <button type="button" onClick={() => navigator.share({ title, url: link() })}>
          Share
        </button>
      )}
      {card && (
        <a href={`${pathname.replace(/\/$/, "")}/opengraph-image`} download={`${filename}.png`}>
          Download card
        </a>
      )}
      <span className="share-status" role="status" aria-live="polite">
        {status === "copied" ? "Link copied" : status === "failed" ? "Couldn't copy — use the address bar" : ""}
      </span>
    </div>
  );
}
