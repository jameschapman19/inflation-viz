import type { Metadata } from 'next';
import './globals.css';
import './radar.css';
import './satellite.css';
import './explorer.css';
import '@/kit/kit.css';
import SiteHeader from '@/components/SiteHeader';
import { EMBED_SCRIPT } from '@/kit/embed';
import { EmbedCredit } from '@/kit/EmbedCredit';
import { ProductSwitcher } from '@/kit/ProductSwitcher';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000'),
  title: 'Agriculture Radar',
  description: 'Explore global wheat, maize, and rice production, yield histories, and benchmark prices. Every number links to its source.',
  icons: { icon: '/icon.svg' },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Embed mode (?embed=1) hides the site chrome; set before first paint so it never flashes. */}
        <script dangerouslySetInnerHTML={{ __html: EMBED_SCRIPT }} />
      </head>
      <body>
        <ProductSwitcher current="agriculture" />
        <SiteHeader />
        {children}
        <EmbedCredit product="Agriculture Radar" source="FAOSTAT, World Bank" />
      </body>
    </html>
  );
}
