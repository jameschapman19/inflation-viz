/** Shared number formatting for chart tooltips, axis labels, and stat
 * tiles — one place decides how many decimals each kind of value gets,
 * instead of every call site picking its own precision (or, for chart
 * tooltips until now, showing a raw unrounded float).
 *
 * Decimal counts here match each value's own existing convention
 * elsewhere on the site (e.g. a headline 12-month rate already reads to
 * 1 decimal on the homepage's own stat tile; a division's ppt
 * contribution already reads to 2 on its own page) — this module doesn't
 * invent new precision, it just makes it consistent everywhere that
 * value appears.
 */

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatPpt(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}ppt`;
}

export function formatWeight(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}‰`;
}

/** A bare decimal, no unit suffix — for a table cell whose column header
 * already states the unit (e.g. "Weight (‰)"), where repeating it on
 * every row would just be noise.
 */
export function formatDecimal(value: number, decimals = 1): string {
  return value.toFixed(decimals);
}
