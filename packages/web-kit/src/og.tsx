import type { ReactNode } from "react";

export interface OgTheme {
  background: string;
  text: string;
  secondary: string;
  muted: string;
}

export const OG_DARK: OgTheme = { background: "#1a1a19", text: "#f0efec", secondary: "#c3c2b7", muted: "#898781" };

/** The 1200×630 share-card layout used by every Radar product: an eyebrow, an
 * optional hero, a flexible body (usually stripes or a sparkline) and a
 * footer. Returns JSX for `ImageResponse` — every element is `display: flex`,
 * as satori requires. */
export function OgCard({
  eyebrow,
  hero,
  subtitle,
  children,
  footerLeft,
  footerRight,
  theme = OG_DARK,
}: {
  eyebrow: string;
  hero?: ReactNode;
  subtitle?: string;
  children?: ReactNode;
  footerLeft: string;
  footerRight: string;
  theme?: OgTheme;
}) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: theme.background, color: theme.text, padding: 56 }}>
      <div style={{ display: "flex", fontSize: 34, color: theme.secondary }}>{eyebrow}</div>
      {hero && <div style={{ display: "flex", alignItems: "baseline", marginTop: 8 }}>{hero}</div>}
      {subtitle && <div style={{ display: "flex", fontSize: 30, color: theme.secondary, marginTop: 14 }}>{subtitle}</div>}
      <div style={{ display: "flex", flex: 1, marginTop: 30 }}>{children}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: theme.muted, marginTop: 18 }}>
        <span>{footerLeft}</span>
        <span>{footerRight}</span>
      </div>
    </div>
  );
}
