import type { DivisionColor } from "./colors";
import { childColor, divisionColor } from "./colors";
import type { InflationBand } from "./data";
import { bandForRate, forecast, forecastFor, hasForecast, registry, series } from "./data";

export const ROOT_ID = "root";

export interface ReplayChild {
  id: string;
  name: string;
  color: DivisionColor;
  /** Whether this child has a replay node of its own to drill into. */
  drillable: boolean;
}

/** One level of the basket: a parent's total and how its children split it,
 * month by month over the span where every child has data. */
export interface ReplayNode {
  id: string;
  name: string;
  parent: string | null;
  children: ReplayChild[];
  /** Inclusive range of indices into `ReplayData.dates` this node covers. */
  from: number;
  to: number;
  /** Parent total (ppt, or the headline % at the root) for months `from..to`. */
  total: number[];
  /** `[month - from][child]` ppt contribution, in `children` order. */
  values: number[][];
  /** `total - sum(values)` per month: chain-linking and rounding. Null at the root. */
  residual: number[] | null;
  /** Whether `total` is an ONS-published figure or derived as weight x rate. */
  totalPublished: boolean;
}

export interface ReplayData {
  rootId: string;
  /** First of each month, ISO date strings, actuals followed by projections. */
  dates: string[];
  /** Index of the first projected month, or null when no forecast is published. */
  projectedFrom: number | null;
  /** Index of the last month with ONS data. */
  lastActual: number;
  /** Banding of the root headline rate against the 2% target, per month. */
  bands: InflationBand[];
  nodes: Record<string, ReplayNode>;
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

function indexByDate(uniqueId: string, rows: Map<string, Map<string, number>>): Map<string, number> {
  const found = rows.get(uniqueId);
  if (!found) throw new Error(`series.json has no rows for ${uniqueId}`);
  return found;
}

function groupSeries(): Map<string, Map<string, number>> {
  const grouped = new Map<string, Map<string, number>>();
  for (const row of series) {
    let byDate = grouped.get(row.unique_id);
    if (!byDate) grouped.set(row.unique_id, (byDate = new Map()));
    byDate.set(row.ds, row.y);
  }
  return grouped;
}

export function buildReplayData(): ReplayData {
  const grouped = groupSeries();

  const divisions = [...registry.divisions].sort((a, b) => (a.coicop ?? "").localeCompare(b.coicop ?? ""));
  const divisionSeries = divisions.map((d) => indexByDate(d.unique_id, grouped));
  const headlineActual = indexByDate("GB.CPI", grouped);

  // Contributions start later than the headline, and every division must be
  // present for a month to be drawable.
  const dates = [...headlineActual.keys()].filter((ds) => divisionSeries.every((m) => m.has(ds))).sort();
  const lastActual = dates.length - 1;

  // Sub-division rates and weights, keyed by coicop.
  const rateOf = new Map(registry.subdivisions.map((s) => [s.coicop as string, indexByDate(s.unique_id, grouped)]));
  const weightOf = new Map(registry.subdivisionWeights.map((w) => [w.coicop as string, indexByDate(w.unique_id, grouped)]));
  const divisionContribution = new Map(divisions.map((d, i) => [d.coicop as string, divisionSeries[i]]));

  /** A sub-division's ppt contribution: last year's basket weight (per mille
   * of all spending) times its 12-month rate. ONS publishes no contributions
   * below division level; `null` when either input is missing that month. */
  function derived(coicop: string, ds: string): number | null {
    const rate = rateOf.get(coicop)?.get(ds);
    const weight = weightOf.get(coicop)?.get(`${Number(ds.slice(0, 4)) - 1}-01-01`);
    return rate === undefined || weight === undefined ? null : (weight * rate) / 1000;
  }

  const childrenOf = new Map<string, string[]>();
  for (const s of registry.subdivisions) {
    const parent = s.parent_coicop as string;
    childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), s.coicop as string]);
  }
  const nameOf = new Map<string, string>([
    ...divisions.map((d) => [d.coicop as string, d.division_name as string] as const),
    ...registry.subdivisions.map((s) => [s.coicop as string, s.division_name ?? s.name] as const),
  ]);
  const parentOf = new Map(registry.subdivisions.map((s) => [s.coicop as string, s.parent_coicop as string]));
  for (const d of divisions) parentOf.set(d.coicop as string, ROOT_ID);

  const nodes: Record<string, ReplayNode> = {};

  function build(id: string, name: string, childIds: string[], totalAt: (ds: string) => number | null, published: boolean) {
    const childValue = (c: string, ds: string) =>
      divisionContribution.get(c)?.get(ds) ?? derived(c, ds);

    // Longest run of consecutive months, ending at the last actual month,
    // where the total and every child have a value.
    let from = lastActual + 1;
    while (from > 0) {
      const ds = dates[from - 1];
      if (totalAt(ds) === null || childIds.some((c) => childValue(c, ds) === null)) break;
      from--;
    }
    if (from > lastActual) return;

    const months = dates.slice(from, lastActual + 1);
    const total = months.map((ds) => totalAt(ds) as number);
    const values = months.map((ds) => childIds.map((c) => childValue(c, ds) as number));
    nodes[id] = {
      id,
      name,
      parent: id === ROOT_ID ? null : parentOf.get(id) ?? ROOT_ID,
      children: [],
      from,
      to: lastActual,
      total: total.map(round3),
      values: values.map((row) => row.map(round3)),
      residual: id === ROOT_ID ? null : total.map((t, i) => round3(t - values[i].reduce((a, b) => a + b, 0))),
      totalPublished: published,
    };
  }

  build(
    ROOT_ID,
    "All items",
    divisions.map((d) => d.coicop as string),
    (ds) => headlineActual.get(ds) ?? null,
    true,
  );
  for (const d of divisions) {
    const kids = childrenOf.get(d.coicop as string) ?? [];
    if (kids.length > 0) {
      build(d.coicop as string, d.division_name as string, kids, (ds) => divisionContribution.get(d.coicop as string)?.get(ds) ?? null, true);
    }
  }
  for (const [parent, kids] of childrenOf) {
    if (nodes[parent] || divisionContribution.has(parent)) continue;
    build(parent, nameOf.get(parent) ?? parent, kids, (ds) => derived(parent, ds), false);
  }

  // Wire up children now that every node's existence (drillability) is known.
  for (const node of Object.values(nodes)) {
    const ids = node.id === ROOT_ID ? divisions.map((d) => d.coicop as string) : (childrenOf.get(node.id) as string[]);
    node.children = ids.map((c, i) => ({
      id: c,
      name: nameOf.get(c) ?? c,
      color:
        node.id === ROOT_ID
          ? { light: divisionColor(c, "light"), dark: divisionColor(c, "dark") }
          : { light: childColor(c, i, ids.length, "light"), dark: childColor(c, i, ids.length, "dark") },
      drillable: c in nodes,
    }));
  }

  const root = nodes[ROOT_ID];
  let projectedFrom: number | null = null;
  if (hasForecast() && forecast.coverage.missing.length === 0) {
    const total = new Map(forecastFor(forecast.totalUniqueId as string).map((p) => [p.ds, p.yhat]));
    const perDivision = divisions.map((d) => new Map(forecastFor(d.unique_id).map((p) => [p.ds, p.yhat])));
    projectedFrom = dates.length;
    for (const ds of [...total.keys()].sort()) {
      const at = (m: Map<string, number>, what: string) => {
        const v = m.get(ds);
        if (v === undefined) throw new Error(`${what} has no forecast for ${ds}`);
        return v;
      };
      dates.push(ds);
      root.total.push(round3(at(total, forecast.totalUniqueId as string)));
      root.values.push(perDivision.map((m, i) => round3(at(m, divisions[i].unique_id))));
    }
    root.to = dates.length - 1;
  }

  return {
    rootId: ROOT_ID,
    dates,
    projectedFrom,
    lastActual,
    bands: root.total.map(bandForRate),
    nodes,
  };
}
