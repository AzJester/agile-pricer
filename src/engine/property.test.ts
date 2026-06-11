import fc from 'fast-check';
import { describe, it } from 'vitest';
import { compute } from './compute';
import { repairPursuit } from './repair';
import { blankSeed } from './seeds';
import type { Pursuit } from './types';

/**
 * Property-based invariants: for arbitrary (bounded) pursuit inputs the
 * engine must produce finite numbers and every reconciliation view must tie
 * to the same total.
 */

const money = fc.double({ min: 0, max: 5_000_000, noNaN: true });
const points = fc.double({ min: 1, max: 500, noNaN: true });
const smallInt = fc.integer({ min: 1, max: 3 });

const arbPursuit: fc.Arbitrary<Pursuit> = fc
  .record({
    nPeriods: smallInt,
    fee: fc.double({ min: 0, max: 0.2, noNaN: true }),
    escalation: fc.double({ min: 0, max: 0.08, noNaN: true }),
    velocity: fc.double({ min: 5, max: 80, noNaN: true }),
    capacityReserve: fc.double({ min: 0, max: 0.5, noNaN: true }),
    roundTo: fc.constantFrom(0, 100, 1000, 10000),
    plugMode: fc.constantFrom('last', 'perPhase', 'largest' as const),
    epics: fc.array(
      fc.record({ likely: points, spreadLo: fc.double({ min: 0.5, max: 1, noNaN: true }), spreadHi: fc.double({ min: 1, max: 2, noNaN: true }), phase: smallInt, py: smallInt }),
      { minLength: 1, maxLength: 8 },
    ),
    milestonesPerPeriod: fc.integer({ min: 1, max: 3 }),
    fixed: money,
    subCost: money,
  })
  .map((cfg) => {
    const s = blankSeed();
    s.control.periods = Array.from({ length: cfg.nPeriods }, (_, i) => ({
      label: i === 0 ? 'Base' : `Option ${i}`,
      months: 12,
      color: i % 2 ? 'O&M' : 'RDT&E',
    }));
    s.control.fee = cfg.fee;
    s.control.escalation = cfg.escalation;
    s.control.roundTo = cfg.roundTo;
    s.control.plugMode = cfg.plugMode;
    s.archetypes[0].velocity = cfg.velocity;
    s.velocity.capacityReserve = cfg.capacityReserve;
    s.milestones = [];
    for (let ph = 1; ph <= cfg.nPeriods; ph++) {
      for (let k = 0; k < cfg.milestonesPerPeriod; k++) {
        s.milestones.push({
          name: `MS ${ph}.${k}`,
          pi: `PI${ph}`,
          phase: ph,
          monthOffset: (ph - 1) * 12 + k * 3,
          fixed: k === 0 ? cfg.fixed : 0,
          kpi: '',
          threshold: '',
          gated: false,
        });
      }
    }
    s.backlog = cfg.epics.map((e, i) => {
      const ph = Math.min(e.phase, cfg.nPeriods);
      return {
        capability: `Cap ${i % 3}`,
        epic: `Epic ${i}`,
        pi: `PI${ph}`,
        piYear: Math.min(e.py, cfg.nPeriods),
        milestone: `MS ${ph}.0`,
        archetype: s.archetypes[0].name,
        low: e.likely * e.spreadLo,
        likely: e.likely,
        high: e.likely * e.spreadHi,
      };
    });
    s.teaming = cfg.subCost > 0 ? [{ party: 'Sub', subCost: cfg.subCost }] : [];
    return repairPursuit(s);
  });

describe('engine invariants (property-based)', () => {
  it('total is finite and non-negative; all views tie to it', () => {
    fc.assert(
      fc.property(arbPursuit, (s) => {
        const r = compute(s);
        if (!Number.isFinite(r.total) || r.total < 0) return false;
        if (Math.abs(r.msPriceTotal - r.total) > 1) return false;
        if (Math.abs(r.periodPrices.reduce((a, b) => a + b, 0) - r.total) > 1) return false;
        if (Math.abs(r.boeTotalPrice - r.total) > 1) return false;
        if (Math.abs(r.prime + r.subsSubtotal - r.total) > 1) return false;
        if (r.costP50 > r.costP80 + 1e-6) return false;
        return true;
      }),
      { numRuns: 200 },
    );
  });

  it('repair(JSON round-trip) never changes the computed total', () => {
    fc.assert(
      fc.property(arbPursuit, (s) => {
        const total = compute(s).total;
        const again = compute(repairPursuit(JSON.parse(JSON.stringify(s)))).total;
        return Math.abs(total - again) < 1e-6;
      }),
      { numRuns: 50 },
    );
  });
});
