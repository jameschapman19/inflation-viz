"use client";

import { useState } from "react";

/** Collapsible iframe snippet for a page in embed mode. Built on open, so the
 * code carries the real origin and the current URL hash. */
export function EmbedCode({ path, height, title }: { path: string; height: number; title: string }) {
  const [code, setCode] = useState("");
  return (
    <details
      className="embed-code"
      onToggle={(event) => {
        if (event.currentTarget.open) {
          const { origin, hash } = window.location;
          setCode(
            `<iframe src="${origin}${path}?embed=1${hash}" title="${title}" width="100%" height="${height}" style="border:0" loading="lazy"></iframe>`,
          );
        }
      }}
    >
      <summary>Embed this</summary>
      <textarea readOnly rows={3} value={code} onFocus={(event) => event.currentTarget.select()} aria-label="Embed code" />
    </details>
  );
}
