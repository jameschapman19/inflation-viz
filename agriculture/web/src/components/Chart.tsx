'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { number, period } from '@/lib/data';
import type { Point } from '@/lib/types';
type FuturePoint = { date: string; point: number; lo: number; hi: number };
export default function Chart({ points, unit, color = 'var(--amber)', annual = false, future = [], label, height = 190 }: { points: Point[]; unit: string; color?: string; annual?: boolean; future?: FuturePoint[]; label: string; height?: number }) {
  const id = useId().replaceAll(':', '');
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(660);
  useEffect(() => { const element = ref.current; if (!element) return; const observer = new ResizeObserver(entries => setWidth(Math.max(200, entries[0].contentRect.width))); observer.observe(element); return () => observer.disconnect(); }, []);
  if (!points.length) return <div ref={ref} className="chart-empty">No observations available for this period.</div>;
  const left = 54, right = 14, top = 15, bottom = height - 30;
  const all = [...points.map(p => p.value), ...future.flatMap(p => [p.lo, p.hi])];
  const low = Math.max(0, Math.min(...all) * 0.85), high = Math.max(...all) * 1.1 || 1;
  const firstTime = new Date(points[0].date).getTime();
  const lastDate = future.at(-1)?.date ?? points.at(-1)!.date;
  const lastTime = new Date(lastDate).getTime();
  const x = (date: string) => left + (new Date(date).getTime() - firstTime) / (lastTime - firstTime || 1) * (width - left - right);
  const y = (v: number) => bottom - (v - low) / (high - low || 1) * (bottom - top);
  const segments: Point[][] = [];
  points.forEach((point, index) => {
    const previous = points[index - 1];
    const gap = previous ? (new Date(point.date).getTime() - new Date(previous.date).getTime()) / 86400000 : 0;
    if (!previous || gap > (annual ? 370 : 35)) segments.push([]);
    segments.at(-1)!.push(point);
  });
  const line = (ps: Point[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${x(p.date)},${y(p.value)}`).join(' ');
  const forecastLine = future.length ? line([points.at(-1)!, ...future.map(p => ({ date: p.date, value: p.point }))]) : '';
  const band = future.length ? [...future.map(p => `${x(p.date)},${y(p.hi)}`), ...[...future].reverse().map(p => `${x(p.date)},${y(p.lo)}`)].join(' ') : '';
  const axis = (v: number) => v >= 1e6 ? `${number(v / 1e6, 1)}M` : v >= 1e3 ? `${number(v / 1e3, 1)}K` : number(v, 1);
  const selected = hover != null ? points[hover] : null;
  return <div ref={ref} className="chart-wrap">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} onPointerLeave={() => setHover(null)} onPointerMove={event => {
      const box = event.currentTarget.getBoundingClientRect();
      const atX = (event.clientX - box.left) / box.width * width;
      let nearest = 0;
      points.forEach((p, i) => { if (Math.abs(x(p.date) - atX) < Math.abs(x(points[nearest].date) - atX)) nearest = i; });
      setHover(nearest);
    }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".16"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      {[0, 1, 2, 3].map(i => { const value = low + (high - low) * i / 3; return <g key={i}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="var(--radar-grid)" strokeDasharray="3 4"/><text x={left - 10} y={y(value) + 4} textAnchor="end" className="axis">{axis(value)}</text></g>; })}
      {segments.map((segment, i) => <g key={i}><path d={`${line(segment)} L${x(segment.at(-1)!.date)},${bottom} L${x(segment[0].date)},${bottom} Z`} fill={`url(#${id})`}/><path d={line(segment)} fill="none" stroke={color} strokeWidth="2.3" strokeLinejoin="round"/></g>)}
      {future.length > 0 && <><polygon points={band} fill="var(--teal)" fillOpacity=".18"/><path d={forecastLine} fill="none" stroke="var(--teal)" strokeWidth="2" strokeDasharray="5 4"/><line x1={x(points.at(-1)!.date)} x2={x(points.at(-1)!.date)} y1={top} y2={bottom} stroke="var(--teal)" strokeOpacity=".5" strokeDasharray="3 4"/></>}
      {[points[0].date, points[Math.floor(points.length / 2)].date, lastDate].map((date, i) => <text key={i} x={x(date)} y={height - 8} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} className="axis">{annual ? date.slice(0, 4) : period(date)}</text>)}
      {selected && <><line x1={x(selected.date)} x2={x(selected.date)} y1={top} y2={bottom} stroke="#dce7ed" strokeOpacity=".45"/><circle cx={x(selected.date)} cy={y(selected.value)} r="4" fill={color} stroke="#10232d" strokeWidth="2"/></>}
    </svg>
    <div className="chart-reading" aria-live="polite">{selected ? <>{annual ? selected.date.slice(0, 4) : period(selected.date)} <strong>{number(selected.value, 2)} {unit}</strong></> : <span>Move over the chart to inspect observations</span>}</div>
  </div>;
}
