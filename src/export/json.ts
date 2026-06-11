import type { Pursuit } from '../engine';
import { fileSafe } from '../lib/format';
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
  const lines = text.split(/\r?\n/).filter((x) => x.trim());
  if (!lines.length) return [];
  const hasHeader = /lcat|labor|direct/i.test(lines[0]);
  const out: { lcat: string; direct: number }[] = [];
  for (const ln of hasHeader ? lines.slice(1) : lines) {
    const parts = ln.split(',');
    if (parts.length < 2) continue;
    const lcat = parts[0].replace(/^"|"$/g, '').trim();
    const direct = parseFloat(parts[1]);
    if (!lcat || !Number.isFinite(direct)) continue;
    out.push({ lcat, direct });
  }
  return out;
}
