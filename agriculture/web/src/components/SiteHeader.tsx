'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const isExplore = (path: string) => path === '/' || /^\/(wheat|maize|rice|born)(\/|$)/.test(path);

export default function SiteHeader() {
  const path = usePathname();
  const satellite = path.startsWith('/satellite');
  const link = (href: string, label: string, active: boolean) => (
    <Link href={href} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>{label}</Link>
  );
  return (
    <header className="site-header">
      <Link href="/" className="brand"><span className="brand-mark" aria-hidden="true" /><span>Agriculture <strong>Radar</strong></span></Link>
      <nav aria-label="Main navigation">
        {link('/wheat', 'Explore', isExplore(path))}
        {link('/satellite/', 'Satellite', satellite)}
        {link('/methodology/', 'Methodology', path.startsWith('/methodology'))}
      </nav>
      <span className="header-note">{satellite ? 'Satellite · experimental' : 'FAOSTAT · World Bank'}</span>
    </header>
  );
}
