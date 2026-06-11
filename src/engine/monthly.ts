import { compute, makeEscFactor, num } from './compute';
import type { ComputeResult, Pursuit } from './types';

export interface MonthRow {
  /** 0-based month offset from PoP start. */
  idx: number;
  labor: number;
  loe: number;
  psupport: number;
  odc: number;
  fixed: number;
  total: number;
  cumulative: number;
  /** Delivery-team FTE demand implied by backlog sprints this month. */
  backlogFte: number;
  /** LOE + program-support FTE on staff this month. */
  loeFte: number;
  totalFte: number;
}

export interface MonthlyPhasing {
  months: MonthRow[];
  /** Sum of the monthly series; reconciles to the engine cost stack. */
  totals: { labor: number; loe: number; psupport: number; odc: number; fixed: number; total: number };
  grossup: number;
}

/**
 * Spread the cost stack across calendar months for expenditure curves and a
 * staffing plan. Spreads preserve engine totals exactly:
 * - Backlog labor (at the quoted confidence) spreads evenly across the months
 *   of its PI year (clamped to the period of performance).
 * - LOE / program support spread evenly across each line's months, starting
 *   at that line's contract-period start.
 * - ODC spreads each escalated year column (with handling) across that
 *   program year's months.
 * - Fixed milestone amounts land in the milestone's completion month.
 * Multiply by the gross-up to view at price instead of cost.
 */
export function monthlyPhasing(s: Pursuit, r: ComputeResult = compute(s)): MonthlyPhasing {
  const progMonths = Math.max(1, r.progMonths);
  const conf = s.control.confidence || 'P80';
  const wsMonth = num(s.control.workingSprintsYr) / 12; // sprints per team-month

  // Timeline can extend past the PoP if an LOE line or milestone runs longer.
  let horizon = progMonths;
  for (const l of [...s.loe, ...s.psupport]) {
    const ph = Math.min(Math.max(1, Math.round(num(l.phase)) || 1), r.periods.length);
    horizon = Math.max(horizon, (r.periods[ph - 1]?.startMonth ?? 0) + Math.ceil(Math.max(0, num(l.months))));
  }
  for (const m of r.msRows) horizon = Math.max(horizon, Math.round(num(m.monthOffset)) + 1);
  horizon = Math.ceil(horizon);

  const months: MonthRow[] = Array.from({ length: horizon }, (_, idx) => ({
    idx,
    labor: 0,
    loe: 0,
    psupport: 0,
    odc: 0,
    fixed: 0,
    total: 0,
    cumulative: 0,
    backlogFte: 0,
    loeFte: 0,
    totalFte: 0,
  }));

  // Backlog labor by PI year
  for (const row of r.rows) {
    const labor = conf === 'P80' ? row.lp80 : row.lp50;
    const sprints = conf === 'P80' ? row.sp80 : row.sp50;
    const start = Math.min((row.py - 1) * 12, progMonths - 1);
    const span = Math.max(1, Math.min(12, progMonths - start));
    const archFte = r.archMap[row.arch]?.fte ?? 0;
    for (let m = start; m < start + span; m++) {
      months[m].labor += labor / span;
      // sprints/month ÷ sprints a team runs per month = concurrent teams; × team FTE
      const teamsBusy = wsMonth > 0 ? sprints / span / wsMonth : 0;
      months[m].backlogFte += teamsBusy * archFte;
    }
  }

  // LOE and program support from each line's period start
  const spreadFteLine = (
    kind: 'loe' | 'psupport',
    line: { phase: number; months: number; fte: number },
    monthly: number,
    counted: boolean,
  ) => {
    const ph = Math.min(Math.max(1, Math.round(num(line.phase)) || 1), r.periods.length);
    const start = r.periods[ph - 1]?.startMonth ?? 0;
    // Fractional durations get a partial final month, so the spread sums to
    // monthly × months exactly — the same product compute() costs the line at.
    const mTot = Math.max(0, num(line.months));
    const n = Math.ceil(mTot);
    for (let k = 0, m = start; k < n && m < months.length; k++, m++) {
      const frac = Math.min(1, mTot - k);
      if (counted) months[m][kind] += monthly * frac;
      months[m].loeFte += num(line.fte) * frac;
    }
  };
  r.loeRows.forEach((l) => spreadFteLine('loe', l, l.monthly, true));
  r.psRows.forEach((l) => spreadFteLine('psupport', l, l.monthly * (r.includePS ? 1 : 0), r.includePS));

  // ODC: each escalated year column (with handling) across that program year
  {
    const escFactor = makeEscFactor(num(s.control.escalation), s.control.escalationByYear);
    const handling = 1 + num(s.control.gnaODC);
    for (const o of s.odc) {
      const yrs = o.years || [];
      for (let y = 0; y < r.yearsN; y++) {
        const amt = num(yrs[y]) * escFactor(y + 1) * handling;
        if (!amt) continue;
        const start = y * 12;
        const span = Math.max(1, Math.min(12, progMonths - start));
        for (let m = start; m < start + span && m < months.length; m++) months[m].odc += amt / span;
      }
    }
  }

  // Fixed amounts at milestone completion (whole-month index; fractional
  // offsets would index a hole in the array)
  for (const m of r.msRows) {
    const idx = Math.min(Math.max(0, Math.round(num(m.monthOffset))), months.length - 1);
    months[idx].fixed += m.fixed;
  }

  let cum = 0;
  for (const m of months) {
    m.total = m.labor + m.loe + m.psupport + m.odc + m.fixed;
    cum += m.total;
    m.cumulative = cum;
    m.totalFte = m.backlogFte + m.loeFte;
  }

  const sum = (k: keyof MonthRow) => months.reduce((a, m) => a + (m[k] as number), 0);
  return {
    months,
    totals: {
      labor: sum('labor'),
      loe: sum('loe'),
      psupport: sum('psupport'),
      odc: sum('odc'),
      fixed: sum('fixed'),
      total: sum('total'),
    },
    grossup: r.grossup,
  };
}
