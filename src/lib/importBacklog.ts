import type { BacklogItem } from '../engine';

/**
 * Delimited-text parsing for backlog import: Jira/Azure DevOps CSV exports
 * and clipboard paste from Excel (TSV). Handles quoted fields.
 */

export function parseDelimited(text: string): string[][] {
  const firstLine = text.slice(0, text.indexOf('\n') >= 0 ? text.indexOf('\n') : text.length);
  const delim = firstLine.includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

export type BacklogField = 'epic' | 'capability' | 'points' | 'pi' | 'milestone' | 'ignore';

/** Column-name heuristics for Jira / Azure DevOps / generic exports. */
export function guessColumn(header: string): BacklogField {
  const h = header.toLowerCase().trim();
  if (/story points|story point estimate|effort|size|points|estimate/.test(h)) return 'points';
  if (/^(summary|title|name|work item|epic name|item)$/.test(h) || /summary|title/.test(h)) return 'epic';
  if (/capability|feature|parent|epic link|area path|theme|component/.test(h)) return 'capability';
  if (/sprint|iteration|pi\b|increment|quarter/.test(h)) return 'pi';
  if (/milestone|release|fix version/.test(h)) return 'milestone';
  return 'ignore';
}

export interface ImportOptions {
  mapping: BacklogField[];
  hasHeader: boolean;
  /** low = likely × (1 − spreadLow) */
  spreadLow: number;
  /** high = likely × (1 + spreadHigh) */
  spreadHigh: number;
  defaultArchetype: string;
  defaultMilestone: string;
  defaultPiYear: number;
}

/** PI year heuristics from sprint/iteration labels ("PI3", "2027.1", "Sprint 28"). */
function piYearFrom(label: string, fallback: number): number {
  const pi = /pi\s*-?\s*(\d+)/i.exec(label);
  if (pi) return Math.max(1, parseInt(pi[1], 10));
  return fallback;
}

export function buildBacklogItems(rows: string[][], opts: ImportOptions): BacklogItem[] {
  const dataRows = opts.hasHeader ? rows.slice(1) : rows;
  const items: BacklogItem[] = [];
  for (const row of dataRows) {
    const get = (f: BacklogField) => {
      const idx = opts.mapping.indexOf(f);
      return idx >= 0 ? (row[idx] ?? '').trim() : '';
    };
    const epic = get('epic');
    const likely = parseFloat(get('points'));
    if (!epic || !Number.isFinite(likely) || likely <= 0) continue;
    const pi = get('pi');
    items.push({
      capability: get('capability') || 'Imported',
      epic,
      pi: pi || 'PI1',
      piYear: piYearFrom(pi, opts.defaultPiYear),
      milestone: get('milestone') || opts.defaultMilestone,
      archetype: opts.defaultArchetype,
      low: Math.round(likely * (1 - opts.spreadLow) * 10) / 10,
      likely,
      high: Math.round(likely * (1 + opts.spreadHigh) * 10) / 10,
    });
  }
  return items;
}
