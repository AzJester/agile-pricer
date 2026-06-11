import { z } from 'zod';
import { blankSeed } from './seeds';
import type { PeriodDef, Pursuit } from './types';

export const CURRENT_SCHEMA_VERSION = 2;

let idCounter = 0;
/** Stable per-row id for editing UIs (React keys survive row reorder/delete). */
export function newRowId(): string {
  return 'r' + Date.now().toString(36) + (idCounter++).toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ---------------------- field-level coercion schemas ---------------------- */

/** Finite number; anything uncoercible (NaN, Infinity, objects) becomes the default. */
const zNum = (def = 0) => z.coerce.number().finite().catch(def);
/** Finite number clamped to a minimum. */
const zNumMin = (def: number, min: number) => zNum(def).transform((v) => Math.max(min, v));
/** String; non-strings become the default rather than "[object Object]". */
const zStr = (def = '') => z.string().catch(def);
const zOptStr = () => z.string().optional().catch(undefined);
const zBool = (def = false) => z.preprocess((v) => (v === undefined ? def : !!v), z.boolean());
const zId = z.string().min(1).catch(() => newRowId());

/** Optional per-year override array: blanks stay null, junk becomes null. */
const zYearArray = z
  .preprocess(
    (v) => (Array.isArray(v) ? v : undefined),
    z
      .array(
        z.preprocess((x) => {
          if (x === null || x === undefined || x === '') return null;
          const n = Number(x);
          return Number.isFinite(n) ? n : null;
        }, z.number().nullable()),
      )
      .optional(),
  )
  .transform((arr) => (arr && arr.some((x) => x !== null) ? arr : undefined))
  .catch(undefined);

/** Record of finite numbers keyed by finite numeric keys; junk entries drop. */
const zNumberMap = z
  .preprocess((v) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: Record<number, number> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const key = Number(k);
      const n = Number(val);
      if (Number.isFinite(key) && Number.isFinite(n)) out[key] = n;
    }
    return out;
  }, z.record(z.string(), z.number()))
  .catch({});

/** Headcount-style map: string keys, finite non-negative values. */
const zHcMap = z
  .preprocess((v) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: Record<string, number> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const n = Number(val);
      out[k] = Number.isFinite(n) ? Math.max(0, n) : 0;
    }
    return out;
  }, z.record(z.string(), z.number()))
  .catch({});

/* --------------------------- row-level schemas --------------------------- */

const zBacklogItem = z
  .object({
    id: zId,
    capability: zStr(''),
    epic: zStr(''),
    pi: zStr(''),
    piYear: zNumMin(1, 0),
    milestone: zStr(''),
    archetype: zStr(''),
    low: zNumMin(0, 0),
    likely: zNumMin(0, 0),
    high: zNumMin(0, 0),
  })
  .passthrough()
  // Inverted three-points silently flip P80 below P50; normalize the order.
  .transform((b) => {
    const [low, likely, high] = [b.low, b.likely, b.high].sort((x, y) => x - y);
    return { ...b, low, likely, high };
  });

const zRate = z
  .object({
    id: zId,
    lcat: zStr(''),
    direct: zNumMin(0, 0),
    directByYear: zYearArray,
    rateBasis: z.enum(['actual', 'survey', '']).catch(''),
    skill: zOptStr(),
    yoe: zNum(0).optional().catch(undefined),
    degree: zOptStr(),
    location: zOptStr(),
    clearance: zOptStr(),
    source: zOptStr(),
  })
  .passthrough();

const zArchetype = z
  .object({
    id: zId,
    name: zStr(''),
    velocity: zNumMin(0, 0),
    teams: zNumMin(0, 0),
    hc: zHcMap,
  })
  .passthrough();

const zLoeLine = z
  .object({
    id: zId,
    fn: zStr(''),
    lcat: zStr(''),
    fte: zNumMin(0, 0),
    phase: zNum(1),
    months: zNumMin(0, 0),
    rateYear: zNumMin(1, 0),
  })
  .passthrough();

const zPsLine = z
  .object({
    id: zId,
    role: zStr(''),
    lcat: zStr(''),
    fte: zNumMin(0, 0),
    phase: zNum(1),
    months: zNumMin(0, 0),
    rateYear: zNumMin(1, 0),
  })
  .passthrough();

const zOdcLine = z
  .object({
    id: zId,
    item: zStr(''),
    cat: zStr(''),
    basis: zOptStr(),
    phase: zNum(1),
    years: z.preprocess((v) => (Array.isArray(v) ? v : [0]), z.array(zNum(0))),
  })
  .passthrough();

const zMilestone = z
  .object({
    id: zId,
    name: zStr(''),
    pi: zStr(''),
    phase: zNum(1),
    // Fractional offsets index past the end of the monthly grid; whole months only.
    monthOffset: zNum(0).transform((v) => Math.max(0, Math.round(v))),
    fixed: zNum(0),
    kpi: zStr(''),
    threshold: zStr(''),
    gated: zBool(false),
  })
  .passthrough();

const zSubLine = z
  .object({
    id: zId,
    role: zStr(''),
    rate: zNumMin(0, 0),
    hours: zNumMin(0, 0),
  })
  .passthrough();

const zTeaming = z
  .object({
    id: zId,
    party: zStr(''),
    subCost: zNumMin(0, 0),
    lines: z.preprocess((v) => (Array.isArray(v) ? v.filter(isRecord) : undefined), z.array(zSubLine).optional()),
  })
  .passthrough();

const zTier = z
  .object({
    id: zId,
    name: zStr(''),
    color: zStr(''),
    teams: zHcMap,
    monthlyODC: zNumMin(0, 0),
  })
  .passthrough();

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Parse an array key: non-arrays use the (id-stamped) fallback, non-record
 * elements drop, and record elements coerce field-by-field — never throws.
 */
function parseRows<T extends { id?: string }>(
  schema: { parse: (v: unknown) => unknown },
  v: unknown,
  fallback: () => T[],
): T[] {
  if (!Array.isArray(v)) return stampIds(fallback());
  return v.filter(isRecord).map((row) => schema.parse(row) as T);
}

/**
 * Loose shape check used to reject files that are clearly not pursuits
 * before repair fills in anything missing.
 */
export const pursuitShape = z
  .object({
    name: z.string().optional(),
    control: z.record(z.unknown()).optional(),
    backlog: z.array(z.unknown()).optional(),
  })
  .passthrough();

export function looksLikePursuit(d: unknown): boolean {
  if (typeof d !== 'object' || d === null) return false;
  const o = d as Record<string, unknown>;
  if (!o.control && !o.backlog && !o.name) return false;
  return pursuitShape.safeParse(d).success;
}

/** True when the file claims a schema newer than this app understands. */
export function isNewerSchema(d: unknown): boolean {
  if (!isRecord(d)) return false;
  const v = Number(d.schemaVersion);
  return Number.isFinite(v) && v > CURRENT_SCHEMA_VERSION;
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * Normalize arbitrary (possibly older-schema, hand-edited, or corrupted)
 * pursuit data into the current shape. Total by construction: any input —
 * including non-record array elements and uncoercible field values — yields
 * a computable Pursuit rather than a throw. Schema v1 (baseMonths/
 * optionMonths + per-phase colors) migrates to the v2 periods array.
 */
export function repairPursuit(d: unknown): Pursuit {
  const b = blankSeed();
  if (!d || typeof d !== 'object') return b;
  const src = d as Record<string, unknown>;

  const srcControl: Record<string, unknown> = isRecord(src.control) ? src.control : {};
  const control = { ...b.control, ...srcControl } as Record<string, unknown>;

  // v1 -> v2: baseMonths/optionMonths + colorPhase1/2 become the periods array.
  if (!Array.isArray(srcControl.periods) || !srcControl.periods.length) {
    const baseM = Number(srcControl.baseMonths);
    const optM = Number(srcControl.optionMonths);
    if (Number.isFinite(baseM) && baseM > 0) {
      const periods: PeriodDef[] = [{ label: 'Base', months: baseM, color: String(srcControl.colorPhase1 || 'RDT&E') }];
      if (Number.isFinite(optM) && optM > 0) {
        periods.push({ label: 'Option 1', months: optM, color: String(srcControl.colorPhase2 || 'O&M') });
      }
      control.periods = periods;
    } else {
      control.periods = deepClone(b.control.periods);
    }
  }
  control.periods = (control.periods as unknown[])
    .filter(isRecord)
    .map((p, i) => ({
      id: typeof p.id === 'string' && p.id ? p.id : newRowId(),
      label: typeof p.label === 'string' && p.label ? p.label : i === 0 ? 'Base' : `Option ${i}`,
      months: Number.isFinite(Number(p.months)) && Number(p.months) > 0 ? Number(p.months) : 12,
      color: typeof p.color === 'string' && p.color ? p.color : 'RDT&E',
    }))
    .slice(0, 12);
  if (!(control.periods as PeriodDef[]).length) {
    control.periods = deepClone(b.control.periods).map((p) => ({ ...p, id: newRowId() }));
  }
  delete control.baseMonths;
  delete control.optionMonths;
  delete control.colorPhase1;
  delete control.colorPhase2;

  // Coerce the numeric control fields so junk degrades to the blank-seed
  // defaults instead of flowing into the engine as 0-via-num().
  const numericControls: [key: string, min: number | null][] = [
    ['sprintLengthWeeks', 0],
    ['productiveHrs', 0],
    ['workingSprintsYr', 0],
    ['paidHrs', 0],
    ['fringe', 0],
    ['overhead', 0],
    ['gna', 0],
    ['gnaODC', 0],
    ['fee', 0],
    ['escalation', null],
    ['subHandling', 0],
    ['subFee', 0],
    ['manualReserve', 0],
    ['ptw', null],
    ['budgetCeiling', 0],
    ['roundTo', 0],
    ['fixedBurden', 0],
  ];
  for (const [key, min] of numericControls) {
    const def = (b.control as unknown as Record<string, number>)[key];
    const v = zNum(def).parse(control[key]);
    control[key] = min === null ? v : Math.max(min, v);
  }
  control.scenario = zStr(b.control.scenario).parse(control.scenario);
  control.popStart =
    typeof control.popStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(control.popStart)
      ? control.popStart
      : b.control.popStart;
  control.automationCurve = zNumberMap.parse(control.automationCurve);
  control.surgeProfile = zNumberMap.parse(control.surgeProfile);
  control.escalationByYear = zYearArray.parse(control.escalationByYear);
  control.confidence = control.confidence === 'P50' ? 'P50' : 'P80';
  control.reserveMethod = control.reserveMethod === 'Manual' ? 'Manual' : 'Spread';
  control.odcPhasing = control.odcPhasing === 'row' ? 'row' : 'year';
  control.plugMode = ['last', 'perPhase', 'largest'].includes(control.plugMode as string) ? control.plugMode : 'last';
  control.includePSupport = control.includePSupport !== false;

  const nP = (control.periods as PeriodDef[]).length;
  const asPhase = (v: unknown) => Math.min(Math.max(1, Math.round(Number(v)) || 1), nP);

  const srcVelocity: Record<string, unknown> = isRecord(src.velocity) ? src.velocity : {};
  const srcRisk: Record<string, unknown> = isRecord(src.risk) ? src.risk : {};
  const srcCapacity: Record<string, unknown> = isRecord(src.capacity) ? src.capacity : {};

  const p: Pursuit = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name: typeof src.name === 'string' && src.name ? src.name : 'Imported Pursuit',
    control: control as unknown as Pursuit['control'],
    risk: {
      correlation: Math.min(0.999, Math.max(0, zNum(0).parse(srcRisk.correlation))),
      sampleVelocity: srcRisk.sampleVelocity === true,
    },
    rates: parseRows(zRate, src.rates, () => deepClone(b.rates)),
    archetypes: parseRows(zArchetype, src.archetypes, () => deepClone(b.archetypes)),
    velocity: {
      ...b.velocity,
      ...(srcVelocity as Partial<Pursuit['velocity']>),
      // ≥1 zeroes every backlog row via the 1/(1−reserve) gross-up.
      capacityReserve: Math.min(0.95, zNumMin(b.velocity.capacityReserve, 0).parse(srcVelocity.capacityReserve)),
      rampFactor: zNumMin(b.velocity.rampFactor, 0).parse(srcVelocity.rampFactor),
      samples: ((Array.isArray(srcVelocity.samples) ? srcVelocity.samples : b.velocity.samples) as unknown[])
        .map(Number)
        .filter(Number.isFinite),
    },
    backlog: parseRows(zBacklogItem, src.backlog, () => deepClone(b.backlog)),
    loe: parseRows(zLoeLine, src.loe, () => deepClone(b.loe)),
    psupport: parseRows(zPsLine, src.psupport, () => deepClone(b.psupport)),
    odc: parseRows(zOdcLine, src.odc, () => deepClone(b.odc)),
    milestones: parseRows(zMilestone, src.milestones, () => deepClone(b.milestones)),
    teaming: parseRows(zTeaming, src.teaming, () => deepClone(b.teaming)),
    capacity: {
      ...b.capacity,
      ...(srcCapacity as Partial<Pursuit['capacity']>),
      periodMonths: zNumMin(b.capacity.periodMonths, 0).parse(srcCapacity.periodMonths),
      optionYears: zNumMin(b.capacity.optionYears, 0).parse(srcCapacity.optionYears),
      reservePct: zNumMin(b.capacity.reservePct, 0).parse(srcCapacity.reservePct),
      hoursBasis: srcCapacity.hoursBasis === 'paid' ? 'paid' : 'productive',
      tiers: parseRows(zTier, srcCapacity.tiers, () => deepClone(b.capacity.tiers)),
    },
  };

  p.loe.forEach((l) => (l.phase = asPhase(l.phase)));
  p.psupport.forEach((l) => (l.phase = asPhase(l.phase)));
  p.odc.forEach((o) => (o.phase = asPhase(o.phase)));
  p.milestones.forEach((m) => (m.phase = asPhase(m.phase)));
  p.teaming.forEach((t) => {
    if (Array.isArray(t.lines) && !t.lines.length) delete t.lines;
  });

  return p;
}

function stampIds<T extends { id?: string }>(rows: T[]): T[] {
  for (const row of rows) if (!row.id) row.id = newRowId();
  return rows;
}
