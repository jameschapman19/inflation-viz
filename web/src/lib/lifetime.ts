import { registry, seriesFor } from "./data";
import { birthYearRange, lifetimeFrom, type Lifetime, type Sources } from "./lifetimeCore";

export type { Lifetime } from "./lifetimeCore";

function sources(): Sources {
  const rpiId = registry.context.find((s) => s.unique_id === "GB.RPI")?.unique_id;
  if (!rpiId) throw new Error("The RPI series is missing from the registry");
  const byDate = (id: string) => new Map(seriesFor(id).map((p) => [p.ds, p.y]));
  return { cpi: byDate("GB.CPI"), rpi: byDate(rpiId) };
}

/** Every birth year a lifetime page exists for, oldest first. */
export function birthYears(): number[] {
  const { first, last } = birthYearRange(sources());
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

export const lifetimeFor = (birthYear: number): Lifetime => lifetimeFrom(sources(), birthYear);
