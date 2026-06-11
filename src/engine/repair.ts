import { z } from 'zod';
import { blankSeed } from './seeds';
import type { PeriodDef, Pursuit } from './types';

export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Loose shape check used to reject files that are clearly not pursuits
 * before repair fills in anything missing.
 */
export const pursuitShape = z
  .object({
    name: z.string().optional(),
    control: z.record(z.unknown()).optional(),
    backlog: z.array(z.record(z.unknown())).optional(),
  })
  .passthrough();

export function looksLikePursuit(d: unknown): boolean {
  if (typeof d !== 'object' || d === null) return false;
  const o = d as Record<string, unknown>;
  if (!o.control && !o.backlog && !o.name) return false;
  return pursuitShape.safeParse(d).success;
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function asNumberMap(v: unknown): Record<number, number> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<number, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const key = Number(k);
    const n = Number(val);
    if (Number.isFinite(key) && Number.isFinite(n)) out[key] = n;
  }
  return out;
}

function asOptionalYearArray(v: unknown): (number | null)[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.map((x) => {
    if (x === null || x === undefined || x === '') return null;
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  });
  return out.some((x) => x !== null) ? out : undefined;
}

/**
 * Normalize arbitrary (possibly older-schema or hand-edited) pursuit data
 * into the current shape. Schema v1 (baseMonths/optionMonths + per-phase
 * colors) migrates to the v2 periods array.
 */
export function repairPursuit(d: unknown): Pursuit {
  const b = blankSeed();
  if (!d || typeof d !== 'object') return b;
  const src = d as Record<string, any>;

  const srcControl: Record<string, any> = typeof src.control === 'object' && src.control ? src.control : {};
  const control = { ...b.control, ...srcControl } as Record<string, any>;

  // v1 -> v2: baseMonths/optionMonths + colorPhase1/2 become the periods array.
  if (!Array.isArray(srcControl.periods) || !srcControl.periods.length) {
    const baseM = Number(srcControl.baseMonths);
    const optM = Number(srcControl.optionMonths);
    if (Number.isFinite(baseM) && baseM > 0) {
      const periods: PeriodDef[] = [{ label: 'Base', months: baseM, color: srcControl.colorPhase1 || 'RDT&E' }];
      if (Number.isFinite(optM) && optM > 0) {
        periods.push({ label: 'Option 1', months: optM, color: srcControl.colorPhase2 || 'O&M' });
      }
      control.periods = periods;
    } else {
      control.periods = deepClone(b.control.periods);
    }
  }
  control.periods = (control.periods as PeriodDef[])
    .map((p, i) => ({
      label: typeof p?.label === 'string' && p.label ? p.label : i === 0 ? 'Base' : `Option ${i}`,
      months: Number.isFinite(Number(p?.months)) && Number(p.months) > 0 ? Number(p.months) : 12,
      color: typeof p?.color === 'string' && p.color ? p.color : 'RDT&E',
    }))
    .slice(0, 12);
  if (!control.periods.length) control.periods = deepClone(b.control.periods);
  delete control.baseMonths;
  delete control.optionMonths;
  delete control.colorPhase1;
  delete control.colorPhase2;

  control.automationCurve = asNumberMap(control.automationCurve);
  control.surgeProfile = asNumberMap(control.surgeProfile);
  control.escalationByYear = asOptionalYearArray(control.escalationByYear);
  control.confidence = control.confidence === 'P50' ? 'P50' : 'P80';
  control.reserveMethod = control.reserveMethod === 'Manual' ? 'Manual' : 'Spread';
  control.odcPhasing = control.odcPhasing === 'row' ? 'row' : 'year';
  control.plugMode = ['last', 'perPhase', 'largest'].includes(control.plugMode) ? control.plugMode : 'last';
  control.includePSupport = control.includePSupport !== false;

  const nP = control.periods.length;
  const asPhase = (v: unknown) => Math.min(Math.max(1, Math.round(Number(v)) || 1), nP);

  const arr = <T>(key: keyof Pursuit, fallback: T[]): T[] =>
    Array.isArray(src[key]) ? (deepClone(src[key]) as T[]) : deepClone(fallback);

  const p: Pursuit = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name: typeof src.name === 'string' && src.name ? src.name : 'Imported Pursuit',
    control: control as Pursuit['control'],
    risk: {
      correlation: Number.isFinite(Number(src.risk?.correlation))
        ? Math.min(0.999, Math.max(0, Number(src.risk.correlation)))
        : 0,
      sampleVelocity: src.risk?.sampleVelocity === true,
    },
    rates: arr('rates', b.rates),
    archetypes: arr('archetypes', b.archetypes),
    velocity: {
      ...b.velocity,
      ...(typeof src.velocity === 'object' && src.velocity ? src.velocity : {}),
    },
    backlog: arr('backlog', b.backlog),
    loe: arr('loe', b.loe),
    psupport: arr('psupport', b.psupport),
    odc: arr('odc', b.odc),
    milestones: arr('milestones', b.milestones),
    teaming: arr('teaming', b.teaming),
    capacity: {
      ...b.capacity,
      ...(typeof src.capacity === 'object' && src.capacity ? src.capacity : {}),
    },
  };

  if (!Array.isArray(p.velocity.samples)) p.velocity.samples = [...b.velocity.samples];
  p.velocity.samples = p.velocity.samples.map(Number).filter(Number.isFinite);

  if (!Array.isArray(p.capacity.tiers)) p.capacity.tiers = deepClone(b.capacity.tiers);
  p.capacity.tiers.forEach((t) => {
    if (!t.teams || typeof t.teams !== 'object') t.teams = {};
  });
  p.capacity.hoursBasis = p.capacity.hoursBasis === 'paid' ? 'paid' : 'productive';

  p.rates.forEach((r) => {
    r.directByYear = asOptionalYearArray(r.directByYear);
  });
  p.archetypes.forEach((a) => {
    if (!a.hc || typeof a.hc !== 'object') a.hc = {};
  });
  p.loe.forEach((l) => (l.phase = asPhase(l.phase)));
  p.psupport.forEach((l) => (l.phase = asPhase(l.phase)));
  p.odc.forEach((o) => {
    o.phase = asPhase(o.phase);
    if (!Array.isArray(o.years)) o.years = [0];
    o.years = o.years.map((y) => (Number.isFinite(Number(y)) ? Number(y) : 0));
  });
  p.milestones.forEach((m) => {
    m.phase = asPhase(m.phase);
    m.gated = !!m.gated;
  });
  p.teaming.forEach((t) => {
    if (t.lines !== undefined && !Array.isArray(t.lines)) delete t.lines;
    if (Array.isArray(t.lines)) {
      t.lines = t.lines
        .filter((l) => l && typeof l === 'object')
        .map((l) => ({ role: String(l.role ?? ''), rate: Number(l.rate) || 0, hours: Number(l.hours) || 0 }));
    }
  });

  return p;
}
