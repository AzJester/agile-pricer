import { compute, mean, num, stdevSample } from './compute';
import type { Pursuit, SimulationResult } from './types';

/** Inverse-CDF sample from a triangular distribution. */
export function triSample(lo: number, mode: number, hi: number, u: number = Math.random()): number {
  if (hi <= lo) return lo;
  const fc = (mode - lo) / (hi - lo);
  return u < fc ? lo + Math.sqrt(u * (hi - lo) * (mode - lo)) : hi - Math.sqrt((1 - u) * (hi - lo) * (hi - mode));
}

/** Standard normal CDF (Abramowitz & Stegun 7.1.26, |err| < 1.5e-7). */
export function normCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}

/** One standard normal draw (Box-Muller). */
function normal(rand: () => number): number {
  let u1 = rand();
  if (u1 <= 1e-12) u1 = 1e-12;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rand());
}

/** Default seed for reproducible production runs (arbitrary fixed value). */
export const DEFAULT_SIM_SEED = 0x5eed1234;

/** Small, fast seeded PRNG (mulberry32) so quoted percentiles can be regenerated. */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Monte Carlo over the backlog's three-point estimates. Non-backlog cost
 * (LOE, program support, ODC, fixed) is deterministic, matching compute().
 *
 * With `risk.correlation` = ρ > 0, epic outcomes share a common factor per
 * trial (one-factor Gaussian copula): u_i = Φ(√ρ·Z + √(1−ρ)·Z_i), which
 * gives the entered ρ as the *pairwise* latent correlation (the loading is
 * √ρ because pairwise correlation is the loading squared). Independent
 * sampling (ρ = 0) understates tail risk because epic overruns are usually
 * driven by the same team and the same unknowns.
 *
 * With `risk.sampleVelocity`, each trial also draws a velocity multiplier
 * from N(1, CoV) (floored at 0.2), so velocity uncertainty enters the
 * distribution instead of living only in the reserve heuristic.
 *
 * Without a custom RNG the run is seeded (DEFAULT_SIM_SEED) and therefore
 * reproducible; the seed used is reported on the result.
 */
export function simulate(s: Pursuit, iters?: number, rand?: () => number, seed = DEFAULT_SIM_SEED): SimulationResult {
  const reportedSeed = rand ? null : seed;
  const rng = rand ?? mulberry32(seed);
  const n = Math.max(200, Math.min(20000, iters || 3000));
  const R = compute(s);
  const c = s.control;
  const capRes = num(s.velocity.capacityReserve);
  const ramp = num(s.velocity.rampFactor);
  const autoCurve = c.automationCurve || {};
  const rho = Math.min(0.999, Math.max(0, num(s.risk?.correlation)));
  const load = Math.sqrt(rho);
  const loadC = Math.sqrt(1 - rho);
  const sampleVel = s.risk?.sampleVelocity === true && R.cov > 0;
  // Per-PI-year escalated cost per team-sprint, recovered from the engine's
  // own rows (lp50 = sp50 × escalated cps) so trials price labor identically
  // to compute(), including FPRA rate tables and per-year escalation.
  const cpsOfRow = R.rows.map((row) => (row.sp50 > 0 ? row.lp50 / row.sp50 : 0));
  // Includes program support so trials reconcile with the deterministic cost stack.
  const fixedBase = R.loeTot + R.psTot + R.odcTot + R.fixedTot;
  const samples = new Array<number>(n);
  for (let it = 0; it < n; it++) {
    const z = rho > 0 ? normal(rng) : 0;
    const velMult = sampleVel ? Math.max(0.2, 1 + R.cov * normal(rng)) : 1;
    let capLabor = 0;
    for (let bi = 0; bi < s.backlog.length; bi++) {
      const b = s.backlog[bi];
      const lo = num(b.low);
      const li = num(b.likely);
      const hi = num(b.high);
      const u = rho > 0 ? normCdf(load * z + loadC * normal(rng)) : rng();
      const pts = triSample(lo, li, hi, u);
      const a = R.archMap[b.archetype] || { vel: 0, cps: 0 };
      const py = num(b.piYear) || 1;
      const rm = py === 1 ? ramp : 1;
      let autoF = num(autoCurve[py]);
      if (!(autoF > 0)) autoF = 1;
      const denom = a.vel * rm * autoF * velMult;
      const eff = capRes < 1 ? pts / (1 - capRes) : 0;
      const spr = denom ? eff / denom : 0;
      capLabor += spr * cpsOfRow[bi];
    }
    samples[it] = capLabor + fixedBase;
  }
  samples.sort((x, y) => x - y);
  // Linearly interpolated order statistic (the floor-index variant biases
  // high by up to one rank at small n).
  const pct = (p: number) => {
    const pos = ((samples.length - 1) * p) / 100;
    const lo = Math.floor(pos);
    const hi = Math.min(samples.length - 1, lo + 1);
    return samples[lo] + (samples[hi] - samples[lo]) * (pos - lo);
  };
  return {
    iters: n,
    seed: reportedSeed,
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
