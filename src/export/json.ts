import type { Pursuit } from '../engine';
import { fileSafe } from '../lib/format';
import { parseDelimited } from '../lib/importBacklog';
import type { IndirectRateSet, PursuitEntry } from '../state/store';
import { downloadText } from './download';

export function exportPursuitJson(p: Pursuit) {
  downloadText(JSON.stringify(p, null, 2), 'application/json', fileSafe(p.name) + '.json');
}

export function exportPortfolioJson(pursuits: PursuitEntry[], rateLibrary: IndirectRateSet[]) {
  downloadText(
    JSON.stringify({ pursuits, rateLibrary }, null, 2),
    'application/json',
    'Astrion_Pricing_Portfolio.json',
  );
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

/** Parse "LCAT,Direct" CSV rows (header optional). */
export function parseRatesCsv(text: string): { lcat: string; direct: number }[] {
  // The quote-aware parser handles LCATs like "Engineer, Senior"; a naive
  // split(',') silently dropped them.
  const rows = parseDelimited(text);
  if (!rows.length) return [];
  // Header detection by shape, not name: a data row's second column is a
  // number. Matching on "direct|labor" ate the first row of a headerless
  // file whose first LCAT happened to contain those words.
  const isHeader = rows[0].length >= 2 && !Number.isFinite(parseFloat(rows[0][1]));
  const out: { lcat: string; direct: number }[] = [];
  for (const row of isHeader ? rows.slice(1) : rows) {
    if (row.length < 2) continue;
    const lcat = (row[0] ?? '').trim();
    const direct = parseFloat(row[1]);
    if (!lcat || !Number.isFinite(direct)) continue;
    out.push({ lcat, direct });
  }
  return out;
}
