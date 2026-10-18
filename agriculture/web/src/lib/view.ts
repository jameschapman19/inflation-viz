import type { Metric } from './types.ts';

export type View = { layer: Metric; year: number };

/**
 * The explorer's map layer and year live in the URL hash so every state is a
 * link: `#yield-1990`, `#change`, `#2000`. Anything unrecognised falls back to
 * the default (production, latest year) rather than failing.
 */
export function parseView(hash: string, years: readonly number[]): View {
  const latest = years[years.length - 1];
  const match = /^#(?:(production|yield|change)(?:-(\d{4}))?|(\d{4}))$/.exec(hash);
  const year = Number(match?.[2] ?? match?.[3] ?? latest);
  return { layer: (match?.[1] as Metric | undefined) ?? 'production', year: years.includes(year) ? year : latest };
}

/** The hash for a view, empty for the default one. */
export function viewHash(view: View, latest: number): string {
  if (view.layer === 'production') return view.year === latest ? '' : String(view.year);
  return view.year === latest ? view.layer : `${view.layer}-${view.year}`;
}
