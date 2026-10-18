/** Labels for `StripeTicks`: the year on each January whose year is a multiple
 * of `every`, null elsewhere. */
export function yearTicks(dates: string[], every: number): (string | null)[] {
  return dates.map((ds) => (ds.slice(5, 7) === "01" && Number(ds.slice(0, 4)) % every === 0 ? ds.slice(0, 4) : null));
}
