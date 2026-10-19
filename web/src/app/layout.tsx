import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "./radar.css";
import { EMBED_SCRIPT } from "@/kit/embed";
import { EmbedCredit } from "@/kit/EmbedCredit";
import { ProductSwitcher } from "@/kit/ProductSwitcher";
import "@/kit/kit.css";
import { Nav } from "@/components/Nav";
import { meta } from "@/lib/data";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  // Share-image URLs must be absolute; Vercel provides the production host.
  metadataBase: new URL(SITE_URL),
  title: "Inflation Radar (UK)",
  description: "UK inflation, traced to its source.",
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const generatedAt = new Date(meta.generatedAt).toUTCString();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Embed mode (?embed=1) hides the site chrome; set before first paint so it never flashes. */}
        <script dangerouslySetInnerHTML={{ __html: EMBED_SCRIPT }} />
      </head>
      <body>
        <ProductSwitcher current="inflation" />
        <header className="site-header">
          <Link className="brand" href="/">
            <span className="brand-mark" />
            Inflation Radar <span className="brand-region">UK</span>
          </Link>
          <Nav />
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <p>
            Built entirely from official, openly-licensed statistics. Every figure on this site
            links to its source — see <Link href="/methodology">Methodology &amp; sources</Link>.
          </p>
          <p className="muted">
            Contains public sector information licensed under the{" "}
            <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/">
              Open Government Licence v3.0
            </a>
            . Site generated {generatedAt}.
          </p>
        </footer>
        <EmbedCredit product="Inflation Radar UK" source="ONS, Open Government Licence v3.0" />
      </body>
    </html>
  );
}
