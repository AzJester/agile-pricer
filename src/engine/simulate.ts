import { compute, escF, mean, num, stdevSample } from './compute';
import type { Pursuit, SimulationResult } from './types';

/** Inverse-CDF sample from a triangular distribution. */
export function triSample(lo: number, mode: number, hi: number, u: number = Math.random()): number {
  if (hi <= lo) return lo;
  const fc = (mode - lo) / (hi - lo);
  return u < fc ? lo + Math.sqrt(u * (hi - lo) * (mode - lo)) : hi - Math.sqrt((1 - u) * (hi - lo) * (hi - mode));
}

/**
 * Monte Carlo over the backlog's three-point estimates. Non-backlog cost
 * (LOE, program support, ODC, fixed) is deterministic, matching compute().
 */
export function simulate(s: Pursuit, iters?: number, rand: () => number = Math.random): SimulationResult {
  const n = Math.max(200, Math.min(20000, iters || 3000));
  const R = compute(s);
  const c = s.control;
  const esc = num(c.escalation);
  const capRes = num(s.velocity.capacityReserve);
  const ramp = num(s.velocity.rampFactor);
  const autoCurve = c.automationCurve || {};
  // Includes program support so trials reconcile with the deterministic cost stack.
  const fixedBase = R.loeTot + R.psTot + R.odcTot + R.fixedTot;
  const samples = new Array<number>(n);
  for (let it = 0; it < n; it++) {
    let capLabor = 0;
    for (const b of s.backlog) {
      const lo = num(b.low);
      const li = num(b.likely);
      const hi = num(b.high);
      const pts = triSample(lo, li, hi, rand());
      const a = R.archMap[b.archetype] || { vel: 0, cps: 0 };
      const py = num(b.piYear) || 1;
      const rm = py === 1 ? ramp : 1;
      let autoF = num(autoCurve[py]);
      if (!(autoF > 0)) autoF = 1;
      const denom = a.vel * rm * autoF;
      const eff = capRes < 1 ? pts / (1 - capRes) : 0;
      const spr = denom ? eff / denom : 0;
      capLabor += spr * a.cps * escF(py, esc);
    }
    samples[it] = capLabor + fixedBase;
  }
  samples.sort((x, y) => x - y);
  const pct = (p: number) => samples[Math.min(samples.length - 1, Math.floor((p / 100) * samples.length))];
  return {
    iters: n,
    mean: mean(samples),
    std: stdevSample(samples),
    p10: pct(10),
    p50: pct(50),
    p80: pct(80),
    p90: pct(90),
    min: samples[0],
    max: samples[samples.length - 1],
    deterministicP50: R.costP50,
    deterministicP80: R.costP80,
    samples,
  };
}
