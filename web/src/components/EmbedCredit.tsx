"use client";

import { usePathname } from "next/navigation";

/** Attribution line shown only in embed mode (see `html[data-embed]` in
 * globals.css), where the site header and footer are hidden. */
export function EmbedCredit() {
  const pathname = usePathname();
  return (
    <p className="embed-credit">
      <a href={pathname} target="_blank" rel="noopener">
        Inflation Radar UK
      </a>{" "}
      · Data: ONS, Open Government Licence v3.0
    </p>
  );
}
