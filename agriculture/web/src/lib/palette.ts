/**
 * Categorical colours for entities that recur across charts (here, the
 * countries that lead a crop). The same validated hues as Inflation Radar's
 * division palette, in the same fixed order — assigned by order of first
 * appearance, never cycled; anything past the eighth is shown as "Other".
 */
export const CATEGORICAL = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'] as const;
export const OTHER_COLOR = '#6f8794';

export function colorFor(order: readonly string[], id: string): string {
  const index = order.indexOf(id);
  return index === -1 || index >= CATEGORICAL.length ? OTHER_COLOR : CATEGORICAL[index];
}
