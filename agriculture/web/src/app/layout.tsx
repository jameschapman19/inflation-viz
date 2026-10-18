import type { Metadata } from 'next';
import './globals.css';
import './radar.css';
import './satellite.css';
export const metadata: Metadata = { metadataBase: new URL(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000'), title: 'Agriculture Radar', description: 'Explore global wheat, maize, and rice production, yield histories, and benchmark prices. Every number links to its source.', icons: { icon: '/icon.svg' } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
