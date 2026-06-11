import { z } from 'zod';
import { blankSeed } from './seeds';
import type { Phase, Pursuit } from './types';

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

function asPhase(v: unknown): Phase {
  return Number(v) === 2 ? 2 : 1;
}

/**
 * Normalize arbitrary (possibly older-schema or hand-edited) pursuit data
 * into the current shape. Missing collections fall back to the blank seed;
 * unknown extra fields are dropped by construction in the UI but preserved
 * on rows we map over.
 */
export function repairPursuit(d: unknown): Pursuit {
  const b = blankSeed();
  if (!d || typeof d !== 'object') return b;
  const src = d as Record<string, any>;

  const control = { ...b.control, ...(typeof src.control === 'object' && src.control ? src.control : {}) };
  control.automationCurve = asNumberMap(control.automationCurve);
  control.surgeProfile = asNumberMap(control.surgeProfile);
  control.confidence = control.confidence === 'P50' ? 'P50' : 'P80';
  control.reserveMethod = control.reserveMethod === 'Manual' ? 'Manual' : 'Spread';
  control.odcPhasing = control.odcPhasing === 'row' ? 'row' : 'year';
  control.plugMode = ['last', 'perPhase', 'largest'].includes(control.plugMode) ? control.plugMode : 'last';
  control.includePSupport = control.includePSupport !== false;

  const arr = <T>(key: keyof Pursuit, fallback: T[]): T[] =>
    Array.isArray(src[key]) ? (deepClone(src[key]) as T[]) : deepClone(fallback);

  const p: Pursuit = {
    name: typeof src.name === 'string' && src.name ? src.name : 'Imported Pursuit',
    control,
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

  return p;
}
