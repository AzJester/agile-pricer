import { describe, expect, it } from 'vitest';
import { compute, escF, mean, mround, stdevSample } from './compute';
import { repairPursuit, looksLikePursuit } from './repair';
import { baselineSeed, blankSeed, calibratedSeed, demoSeed } from './seeds';
import { sensitivity } from './sensitivity';
import { simulate, triSample } from './simulate';

/**
 * Golden-master values from the validated reference workbook. These are the
 * same figures the original prototype's engine self-test asserted, so any
 * drift here means the port has diverged from the validated model.
 */
describe('golden master: reference baseline', () => {
  const r = compute(baselineSeed());

  it('total price matches the validated workbook', () => {
    expect(r.total).toBeCloseTo(27590172.95, 2);
  });
  it('gross-up matches', () => {
    expect(r.grossup).toBeCloseTo(1.183815, 5);
  });
  it('effective reserve matches', () => {
    expect(r.resPct).toBeCloseTo(0.076195, 5);
  });
  it('milestone 3 price matches', () => {
    expect(Math.abs(r.msRows[2].price - 4377000)).toBeLessThanOrEqual(1);
  });
  it('phase 1 split matches', () => {
    expect(Math.abs(r.phase1Price - 9485000)).toBeLessThanOrEqual(1);
  });
  it('all integrity checks pass', () => {
    expect(r.allOk).toBe(true);
  });
});

describe('integrity invariants hold across all seeds', () => {
  for (const [name, seed] of [
    ['baseline', baselineSeed],
    ['blank', blankSeed],
    ['calibrated', calibratedSeed],
    ['demo', demoSeed],
  ] as const) {
    it(`${name}: milestone prices, phases, BOE, and teaming tie to total`, () => {
      const r = compute(seed());
      expect(Math.abs(r.msPriceTotal - r.total)).toBeLessThanOrEqual(1);
      expect(Math.abs(r.phase1Price + r.phase2Price - r.total)).toBeLessThanOrEqual(1);
      expect(Math.abs(r.boeTotalPrice - r.total)).toBeLessThanOrEqual(1);
      expect(Math.abs(r.prime + r.subsSubtotal - r.total)).toBeLessThanOrEqual(1);
      expect(r.allOk).toBe(true);
    });
  }
});

describe('engine mechanics', () => {
  it('helpers: mean, stdev, escalation, mround', () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(stdevSample([2, 4, 6])).toBeCloseTo(2, 10);
    expect(stdevSample([5])).toBe(0);
    expect(escF(1, 0.03)).toBe(1);
    expect(escF(3, 0.03)).toBeCloseTo(1.0609, 6);
    expect(mround(1234, 1000)).toBe(1000);
    expect(mround(1500, 1000)).toBe(2000);
    expect(mround(1234, 0)).toBe(1234);
  });

  it('P50 cost is never above P80 cost', () => {
    for (const seed of [baselineSeed, blankSeed, calibratedSeed, demoSeed]) {
      const r = compute(seed());
      expect(r.costP50).toBeLessThanOrEqual(r.costP80);
    }
  });

  it('quoting at P50 lowers the base relative to P80', () => {
    const s = baselineSeed();
    const p80 = compute(s).base;
    s.control.confidence = 'P50';
    const p50 = compute(s).base;
    expect(p50).toBeLessThan(p80);
  });

  it('manual reserve overrides the spread/CoV reserve', () => {
    const s = baselineSeed();
    s.control.reserveMethod = 'Manual';
    s.control.manualReserve = 0.123;
    expect(compute(s).resPct).toBeCloseTo(0.123, 10);
  });

  it('automation factor reduces out-year sprints and labor', () => {
    const s = baselineSeed();
    const before = compute(s);
    s.control.automationCurve = { 2: 1.5, 3: 1.5 };
    const after = compute(s);
    expect(after.sumSprP50).toBeLessThan(before.sumSprP50);
    expect(after.costP50).toBeLessThan(before.costP50);
    expect(after.allOk).toBe(true);
  });

  it('surge profile scales funded capacity for that year only', () => {
    const s = baselineSeed();
    s.control.surgeProfile = { 1: 2 };
    const r = compute(s);
    const y1 = r.demand.byYear.find((y) => y.year === 1)!;
    const y2 = r.demand.byYear.find((y) => y.year === 2)!;
    expect(y1.funded).toBeCloseTo(s.control.workingSprintsYr * r.totalTeams * 2, 6);
    expect(y2.funded).toBeCloseTo(s.control.workingSprintsYr * r.totalTeams, 6);
  });

  it('ODC beyond the program year count is flagged as dropped', () => {
    const s = baselineSeed();
    s.control.baseMonths = 12;
    s.control.optionMonths = 0; // 1 program year
    const r = compute(s);
    expect(r.yearsN).toBe(1);
    expect(r.odcDropped).toBeGreaterThan(0);
    expect(r.flags.some((f) => f.msg.includes('beyond the program year count'))).toBe(true);
  });

  it('plug modes all reconcile milestone prices to total', () => {
    for (const plugMode of ['last', 'perPhase', 'largest'] as const) {
      const s = baselineSeed();
      s.control.plugMode = plugMode;
      const r = compute(s);
      expect(Math.abs(r.msPriceTotal - r.total)).toBeLessThanOrEqual(1);
    }
  });

  it('unmatched backlog milestone fails check 6', () => {
    const s = baselineSeed();
    s.backlog[0].milestone = 'No Such Milestone';
    const r = compute(s);
    const c6 = r.checks.find((c) => c.n === 6)!;
    expect(c6.ok).toBe(false);
  });

  it('excluding program support removes it from the priced total', () => {
    const s = demoSeed();
    const withPs = compute(s);
    expect(withPs.psTot).toBeGreaterThan(0);
    s.control.includePSupport = false;
    const withoutPs = compute(s);
    expect(withoutPs.psTot).toBe(0);
    expect(withoutPs.total).toBeLessThan(withPs.total);
  });

  it('handles an empty-ish pursuit without throwing', () => {
    const s = blankSeed();
    s.backlog = [];
    s.milestones = [];
    s.teaming = [];
    s.odc = [];
    const r = compute(s);
    expect(Number.isFinite(r.total)).toBe(true);
  });
});

describe('simulation', () => {
  it('triangular sampler stays in range and hits the mode region', () => {
    expect(triSample(10, 20, 30, 0)).toBeCloseTo(10, 6);
    expect(triSample(10, 20, 30, 0.9999999)).toBeCloseTo(30, 1);
    expect(triSample(10, 20, 30, 0.5)).toBeCloseTo(20, 1);
    expect(triSample(10, 20, 10)).toBe(10); // degenerate: hi <= lo
  });

  it('simulated distribution brackets the deterministic costs (includes program support)', () => {
    // Deterministic seedable PRNG so this test cannot flake.
    let state = 42;
    const rand = () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
    const s = demoSeed(); // has psupport > 0, exercising the fixed-base fix
    const r = compute(s);
    const mc = simulate(s, 4000, rand);
    expect(mc.min).toBeLessThan(mc.p50);
    expect(mc.p50).toBeLessThan(mc.p80);
    expect(mc.p80).toBeLessThan(mc.max);
    // The deterministic PERT P50 should sit inside the simulated spread.
    expect(r.costP50).toBeGreaterThan(mc.min);
    expect(r.costP50).toBeLessThan(mc.max);
    // Fixed base includes program support: every sample exceeds the non-labor stack.
    const fixedBase = r.loeTot + r.psTot + r.odcTot + r.fixedTot;
    expect(mc.min).toBeGreaterThan(fixedBase);
  });

  it('applies the automation curve so trials reconcile with compute()', () => {
    const s = demoSeed(); // automationCurve {2:1.15, 3:1.3}
    let state = 7;
    const rand = () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
    const withAuto = simulate(s, 2000, rand);
    const s2 = demoSeed();
    s2.control.automationCurve = {};
    state = 7;
    const withoutAuto = simulate(s2, 2000, rand);
    expect(withAuto.mean).toBeLessThan(withoutAuto.mean);
  });
});

describe('sensitivity', () => {
  it('ranks drivers by swing and keeps base consistent', () => {
    const s = baselineSeed();
    const res = sensitivity(s, 0.2);
    expect(res.base).toBeCloseTo(compute(s).total, 6);
    expect(res.drivers.length).toBe(6);
    for (let i = 1; i < res.drivers.length; i++) {
      expect(res.drivers[i - 1].swing).toBeGreaterThanOrEqual(res.drivers[i].swing);
    }
    // Velocity and story points are the dominant drivers in this model.
    const top2 = res.drivers.slice(0, 2).map((d) => d.driver);
    expect(top2.join(' ')).toMatch(/Velocity|Story points/);
  });
});

describe('repair / import validation', () => {
  it('accepts a valid pursuit and round-trips through repair unchanged in totals', () => {
    const s = baselineSeed();
    const repaired = repairPursuit(JSON.parse(JSON.stringify(s)));
    expect(compute(repaired).total).toBeCloseTo(compute(s).total, 2);
  });

  it('fills missing collections from the blank seed', () => {
    const repaired = repairPursuit({ name: 'Partial', control: { fee: 0.08 } });
    expect(repaired.name).toBe('Partial');
    expect(repaired.control.fee).toBe(0.08);
    expect(repaired.rates.length).toBeGreaterThan(0);
    expect(Number.isFinite(compute(repaired).total)).toBe(true);
  });

  it('rejects junk in looksLikePursuit', () => {
    expect(looksLikePursuit(null)).toBe(false);
    expect(looksLikePursuit('text')).toBe(false);
    expect(looksLikePursuit({})).toBe(false);
    expect(looksLikePursuit({ name: 'x', control: {}, backlog: [] })).toBe(true);
  });

  it('normalizes bad phases, samples, and maps', () => {
    const repaired = repairPursuit({
      name: 'Messy',
      control: { automationCurve: { '2': '1.2', bad: 'x' }, plugMode: 'bogus' },
      velocity: { samples: ['40', 'junk', 38] },
      loe: [{ fn: 'f', lcat: 'x', fte: 1, phase: 9, months: 1, rateYear: 1 }],
      backlog: [],
    });
    expect(repaired.control.automationCurve).toEqual({ 2: 1.2 });
    expect(repaired.control.plugMode).toBe('last');
    expect(repaired.velocity.samples).toEqual([40, 38]);
    expect(repaired.loe[0].phase).toBe(1);
  });
});
