import { compute, num } from './compute';
import type { Pursuit, SensitivityResult } from './types';

function clone<T>(s: T): T {
  return JSON.parse(JSON.stringify(s)) as T;
}

/**
 * One-at-a-time driver sweep: flex each driver by ±pct and rank the
 * resulting total-price swing.
 */
export function sensitivity(s: Pursuit, pct = 0.2): SensitivityResult {
  const baseTotal = compute(s).total;
  const drivers: SensitivityResult['drivers'] = [];
  const run = (label: string, mut: (x: Pursuit, f: number) => void) => {
    const lo = clone(s);
    const hi = clone(s);
    mut(lo, 1 - pct);
    mut(hi, 1 + pct);
    const tl = compute(lo).total;
    const th = compute(hi).total;
    drivers.push({ driver: label, low: tl, high: th, base: baseTotal, swing: Math.abs(th - tl) });
  };
  const p = Math.round(pct * 100);
  run(`Velocity ±${p}%`, (x, f) => x.archetypes.forEach((a) => (a.velocity = num(a.velocity) * f)));
  run(`Story points ±${p}%`, (x, f) =>
    x.backlog.forEach((b) => {
      b.low = num(b.low) * f;
      b.likely = num(b.likely) * f;
      b.high = num(b.high) * f;
    }),
  );
  run(`Capacity reserve ±${p}%`, (x, f) => {
    x.velocity.capacityReserve = num(x.velocity.capacityReserve) * f;
  });
  run(`Escalation ±${p}%`, (x, f) => {
    x.control.escalation = num(x.control.escalation) * f;
  });
  run(`Fee ±${p}%`, (x, f) => {
    x.control.fee = num(x.control.fee) * f;
  });
  run(`Labor wrap (fringe/OH/G&A) ±${p}%`, (x, f) => {
    x.control.fringe = num(x.control.fringe) * f;
    x.control.overhead = num(x.control.overhead) * f;
    x.control.gna = num(x.control.gna) * f;
  });
  drivers.sort((a, b) => b.swing - a.swing);
  return { base: baseTotal, pct, drivers };
}
