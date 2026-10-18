// GENERATED from packages/web-kit/src — edit there, then run: node scripts/sync-web-kit.mjs
"use client";

import { usePathname } from "next/navigation";

/** Attribution line shown only in embed mode (see `html[data-embed]` in
 * kit.css), where the header and footer are hidden. `product` names the
 * product the embedded page belongs to. */
export function EmbedCredit({ product, source }: { product: string; source: string }) {
  const pathname = usePathname();
  return (
    <p className="embed-credit">
      <a href={pathname} target="_blank" rel="noopener">
        {product}
      </a>{" "}
      · Data: {source}
    </p>
  );
}
