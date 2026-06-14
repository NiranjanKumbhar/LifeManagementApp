/**
 * The occurrence of an annual date (from a YYYY-MM-DD birthday/anniversary) that
 * falls within [from, to] inclusive, as YYYY-MM-DD — or null if none does.
 */
export function occurrenceInRange(iso: string, from: string, to: string): string | null {
  const [, month, day] = iso.split('-');
  const fromYear = Number(from.slice(0, 4));
  const toYear = Number(to.slice(0, 4));
  for (let year = fromYear; year <= toYear; year++) {
    const candidate = `${String(year).padStart(4, '0')}-${month}-${day}`;
    if (candidate >= from && candidate <= to) return candidate;
  }
  return null;
}
