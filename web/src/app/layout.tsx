import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "./radar.css";
import { EmbedCredit } from "@/components/EmbedCredit";
import { Nav } from "@/components/Nav";
import { meta } from "@/lib/data";

export const metadata: Metadata = {
  title: "Inflation Radar (UK)",
  description: "UK inflation, traced to its source.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const generatedAt = new Date(meta.generatedAt).toUTCString();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Embed mode (?embed=1) hides the site chrome; set before first paint so it never flashes. */}
        <script dangerouslySetInnerHTML={{ __html: `if(/[?&]embed=1(&|$)/.test(location.search))document.documentElement.dataset.embed="1"` }} />
      </head>
      <body>
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
        <EmbedCredit />
      </body>
    </html>
  );
}
