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
    s.control.periods = [{ label: 'Base', months: 12, color: 'RDT&E' }]; // 1 program year
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

  it('correlation widens the cost distribution', () => {
    const mkRand = () => {
      let state = 99;
      return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
      };
    };
    const indep = baselineSeed();
    indep.risk = { correlation: 0, sampleVelocity: false };
    const corr = baselineSeed();
    corr.risk = { correlation: 0.9, sampleVelocity: false };
    const a = simulate(indep, 3000, mkRand());
    const b = simulate(corr, 3000, mkRand());
    expect(b.std).toBeGreaterThan(a.std * 1.5);
    // Means stay close: correlation changes spread, not the central estimate.
    expect(Math.abs(b.mean - a.mean) / a.mean).toBeLessThan(0.05);
  });

  it('velocity sampling adds spread beyond point sampling alone', () => {
    const mkRand = () => {
      let state = 7;
      return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
      };
    };
    const off = baselineSeed();
    off.risk = { correlation: 0, sampleVelocity: false };
    const on = baselineSeed();
    on.risk = { correlation: 0, sampleVelocity: true };
    const a = simulate(off, 3000, mkRand());
    const b = simulate(on, 3000, mkRand());
    expect(b.std).toBeGreaterThan(a.std);
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

describe('contract periods (N-period generalization)', () => {
  it('three periods reconcile and price per period', () => {
    const s = baselineSeed();
    s.control.periods = [
      { label: 'Base', months: 12, color: 'RDT&E' },
      { label: 'Option 1', months: 12, color: 'RDT&E' },
      { label: 'Option 2', months: 12, color: 'O&M' },
    ];
    // Move the last two milestones into period 3.
    s.milestones[s.milestones.length - 1].phase = 3;
    s.milestones[s.milestones.length - 2].phase = 3;
    // Point some option-year LOE at period 3.
    s.loe[3].phase = 3;
    s.loe[4].phase = 3;
    const r = compute(s);
    expect(r.periods.length).toBe(3);
    expect(r.periodPrices.length).toBe(3);
    expect(r.periodPrices.every((p) => p > 0)).toBe(true);
    expect(Math.abs(r.periodPrices.reduce((a, b) => a + b, 0) - r.total)).toBeLessThanOrEqual(1);
    expect(r.allOk).toBe(true);
    // Funding colors include the O&M of period 3.
    expect(r.funding.colors).toContain('O&M');
  });

  it('perPhase plug ties each of three periods to its own cost basis', () => {
    const s = baselineSeed();
    s.control.plugMode = 'perPhase';
    s.control.periods = [
      { label: 'Base', months: 12, color: 'RDT&E' },
      { label: 'Option 1', months: 12, color: 'RDT&E' },
      { label: 'Option 2', months: 12, color: 'O&M' },
    ];
    s.milestones[s.milestones.length - 1].phase = 3;
    const r = compute(s);
    expect(Math.abs(r.msPriceTotal - r.total)).toBeLessThanOrEqual(1);
  });
});

describe('escalation and rate tables', () => {
  it('escalationByYear of all-equal steps matches the single rate exactly', () => {
    const s1 = baselineSeed();
    const s2 = baselineSeed();
    s2.control.escalationByYear = [0.03, 0.03, 0.03];
    expect(compute(s2).total).toBeCloseTo(compute(s1).total, 6);
  });

  it('a higher out-year escalation step raises out-year cost only', () => {
    const s = baselineSeed();
    s.control.escalationByYear = [0.03, 0.1, null];
    const r = compute(s);
    const base = compute(baselineSeed());
    expect(r.total).toBeGreaterThan(base.total);
  });

  it('FPRA directByYear overrides escalated direct for that year', () => {
    const s = baselineSeed();
    // Pin Sr Software Engineer at a flat $95 for all three years (no escalation).
    const sr = s.rates.find((r) => r.lcat === 'Sr Software Engineer')!;
    sr.directByYear = [95, 95, 95];
    const r = compute(s);
    const base = compute(baselineSeed());
    // Out-year labor priced with the flat table is cheaper than escalated.
    expect(r.costP50).toBeLessThan(base.costP50);
    expect(r.allOk).toBe(true);
  });
});

describe('bottom-up subcontractor lines', () => {
  it('lines override the manual sub cost', () => {
    const s = baselineSeed();
    s.teaming[0].lines = [
      { role: 'EW Engineer', rate: 210, hours: 5000 },
      { role: 'Test', rate: 150, hours: 2000 },
    ];
    const r = compute(s);
    expect(r.teaming[0].fromLines).toBe(true);
    expect(r.teaming[0].effectiveSubCost).toBeCloseTo(210 * 5000 + 150 * 2000, 6);
    expect(Math.abs(r.prime + r.subsSubtotal - r.total)).toBeLessThanOrEqual(1);
  });
});

describe('monthly phasing', () => {
  it('monthly spread reconciles exactly to the engine cost stack', async () => {
    const { monthlyPhasing } = await import('./monthly');
    for (const seed of [baselineSeed, demoSeed]) {
      const s = seed();
      const r = compute(s);
      const m = monthlyPhasing(s, r);
      const conf = s.control.confidence === 'P80' ? r.capSubP80 : r.capSubP50;
      expect(m.totals.labor).toBeCloseTo(conf, 4);
      expect(m.totals.loe).toBeCloseTo(r.loeTot, 4);
      expect(m.totals.psupport).toBeCloseTo(r.psTot, 4);
      expect(m.totals.odc).toBeCloseTo(r.odcTot, 4);
      expect(m.totals.fixed).toBeCloseTo(r.fixedTot, 4);
      expect(m.totals.total).toBeCloseTo(r.base, 3);
    }
  });

  it('staffing FTE is positive while teams are working', async () => {
    const { monthlyPhasing } = await import('./monthly');
    const m = monthlyPhasing(baselineSeed());
    expect(m.months[0].totalFte).toBeGreaterThan(0);
    expect(Math.max(...m.months.map((x) => x.backlogFte))).toBeGreaterThan(0);
  });
});

describe('repair / import validation', () => {
  it('migrates v1 shape (baseMonths/optionMonths/colorPhase) to periods', () => {
    const v1 = {
      name: 'Old Pursuit',
      control: {
        baseMonths: 12,
        optionMonths: 24,
        colorPhase1: 'RDT&E',
        colorPhase2: 'O&M',
        fee: 0.1,
      },
      backlog: [],
    };
    const p = repairPursuit(v1);
    expect(p.schemaVersion).toBe(2);
    expect(p.control.periods).toEqual([
      { label: 'Base', months: 12, color: 'RDT&E' },
      { label: 'Option 1', months: 24, color: 'O&M' },
    ]);
    expect((p.control as unknown as Record<string, unknown>).baseMonths).toBeUndefined();
  });

  it('v1 baseline JSON computes the same golden total after migration', () => {
    const s = baselineSeed();
    // Reconstruct the v1 control shape.
    const v1 = JSON.parse(JSON.stringify(s)) as Record<string, any>;
    delete v1.schemaVersion;
    delete v1.risk;
    v1.control.baseMonths = 12;
    v1.control.optionMonths = 24;
    v1.control.colorPhase1 = 'RDT&E';
    v1.control.colorPhase2 = 'RDT&E';
    delete v1.control.periods;
    const migrated = repairPursuit(v1);
    expect(compute(migrated).total).toBeCloseTo(27590172.95, 2);
  });

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
    // Out-of-range phases clamp to the highest period.
    expect(repaired.loe[0].phase).toBe(2);
  });
});
