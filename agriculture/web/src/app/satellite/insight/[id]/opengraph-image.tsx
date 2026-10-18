import { ImageResponse } from 'next/og';
import { headlines } from '@/lib/headlines';
import { loadGlobal } from '@/lib/satelliteServer';
import { number } from '@/lib/data';

export const alt = 'Satellite vegetation insight';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamicParams = true;
export const revalidate = 900;
// Pages are rendered on demand and cached, so a new headline gets its page without a deploy.
export async function generateStaticParams() {
  return [];
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadGlobal();
  const h = data && headlines(data).find(x => x.id === id);
  if (!data || !h) return new ImageResponse(<div style={{ display: 'flex' }}>Agriculture Radar</div>, size);
  const up = h.kind === 'record_high';
  const accent = up ? '#4fd1a5' : '#e0925a';
  const key = h.windowStart.slice(5);
  const series = data.observations.filter(o => o.region === id && o.windowStart.slice(5) === key).sort((a, b) => a.windowStart.localeCompare(b.windowStart));
  const lo = Math.min(...series.map(o => o.ndvi)) - 0.03, hi = Math.max(...series.map(o => o.ndvi)) + 0.03;
  const W = 1040, H = 150, PAD = 14;
  const x = (i: number) => PAD + (i / Math.max(1, series.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 70, background: '#0d1b24', color: '#f3f7f8', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', fontSize: 26, letterSpacing: 4, color: '#9fb3be', textTransform: 'uppercase' }}>Agriculture Radar · Satellite · experimental</div>
      <div style={{ display: 'flex', fontSize: 54, lineHeight: 1.2, fontWeight: 700, marginTop: 20, marginBottom: 30 }}>{h.text}</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <svg width={W} height={H + 10} viewBox={`0 0 ${W} ${H + 10}`}>
          <line x1="0" x2={W} y1={y(h.normal)} y2={y(h.normal)} stroke="#6f8794" strokeWidth="2" strokeDasharray="8 8" />
          <polyline fill="none" stroke="#9fb3be" strokeWidth="3" points={series.map((o, i) => `${x(i)},${y(o.ndvi)}`).join(' ')} />
          <circle cx={x(series.length - 1)} cy={y(h.ndvi)} r="11" fill={accent} />
        </svg>
        <div style={{ display: 'flex', marginTop: 14, fontSize: 28, color: '#c3d1d8' }}>NDVI {number(h.ndvi, 2)} vs normal {number(h.normal, 2)} ({up ? '+' : ''}{number(h.anomaly, 2)}) · vegetation, not yield</div>
      </div>
    </div>,
    size,
  );
}
