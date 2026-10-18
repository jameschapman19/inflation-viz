'use client';
import { useEffect, useRef } from 'react';
import { X, ExternalLink, Database } from 'lucide-react';
import type { Manifest, Observation, Crop } from '@/lib/types';
import { number, releaseDate } from '@/lib/data';
export default function SourceDialog({ manifest, provider, crop, country, year, observation, onClose }: { manifest: Manifest; provider: 'faostat' | 'worldbank'; crop: Crop; country: string; year: number; observation?: Observation; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const release = manifest.releases[provider];
  const c = manifest.commodities[crop];
  return <dialog ref={ref} className="source-dialog" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-labelledby="source-title">
    <div className="dialog-heading"><span className="eyebrow"><Database size={15}/> Source record</span><button className="icon-button" onClick={onClose} aria-label="Close source details" autoFocus><X size={20}/></button></div>
    <h2 id="source-title">{provider === 'faostat' ? `${c.name} · ${manifest.countries[country]?.provider_name ?? country}` : c.benchmark_name}</h2>
    <p>{release.provider_name}</p>
    <dl className="source-facts"><div><dt>Reference period</dt><dd>{provider === 'faostat' ? year : 'Monthly observations, 1960 onwards'}</dd></div><div><dt>Provider publication</dt><dd>{releaseDate(release.published_at)}</dd></div><div><dt>First retrieved</dt><dd>{releaseDate(release.first_seen_at)}</dd></div><div><dt>Dataset release</dt><dd className="mono">{release.provider_release_id}</dd></div><div><dt>Licence</dt><dd><a href={release.license_url} target="_blank" rel="noreferrer">{release.license}</a></dd></div></dl>
    {provider === 'faostat' && <><h3>Selected observations</h3>{observation ? <table className="source-table"><thead><tr><th>Metric</th><th>Normalized value</th><th>Provider flag</th></tr></thead><tbody>{(['production', 'area', 'yield'] as const).map(metric => <tr key={metric}><td>{metric === 'area' ? 'Harvested area' : metric[0].toUpperCase() + metric.slice(1)}</td><td>{observation[metric] == null ? 'Unavailable' : `${number(observation[metric]!, 4)} ${metric === 'production' ? 't' : metric === 'area' ? 'ha' : 't/ha'}`}</td><td>{observation.flags[metric] ? `${observation.flags[metric]} · ${manifest.flags[observation.flags[metric]] ?? 'Provider flag'}` : 'Unavailable'}</td></tr>)}</tbody></table> : <p>No observation is reported for this crop, country, and year.</p>}<p className="muted">Production is in tonnes and harvested area in hectares. Yield in kg/ha is divided by 1,000 to display tonnes per hectare. {c.production_basis}. CSV downloads retain original values, units, and flags.</p></>}
    {provider === 'worldbank' && <><h3>Benchmark specification</h3><p>{c.benchmark_description ?? c.benchmark_name}</p><p className="muted">Nominal USD per metric tonne. This is a traded benchmark, not a local farm-gate or retail price. Missing values are omitted. Historical grade and specification changes remain in the provider series.</p></>}
    <h3>Raw-file SHA-256</h3><p className="hash">{release.raw_file_hash}</p>
    <div className="dialog-actions"><a className="button primary" href={release.source_url} target="_blank" rel="noreferrer">Provider dataset <ExternalLink size={15}/></a><a className="button" href={release.download_url} target="_blank" rel="noreferrer">Original provider file <ExternalLink size={15}/></a></div>
  </dialog>;
}
