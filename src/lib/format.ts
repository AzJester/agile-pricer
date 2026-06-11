export const fmt0 = (n: number): string =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

export const fmt2 = (n: number): string =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money0 = (n: number): string => '$' + fmt0(n);
export const money2 = (n: number): string => '$' + fmt2(n);

export const pct = (n: number, d = 1): string => ((Number.isFinite(n) ? n : 0) * 100).toFixed(d) + '%';

/** ISO date plus a month offset, rendered like "Aug 1, 2026". */
export function addMonths(iso: string, m: number): string {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  // Pin to day 1 before the month shift: setMonth from Jan 31 overflows into
  // March. Re-clamp the day to the target month's length afterwards.
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + Math.round(m || 0));
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fileSafe(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '_');
}
