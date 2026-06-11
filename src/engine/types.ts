/**
 * Core data model for a pricing pursuit. All monetary inputs are Year-1
 * dollars unless noted; the engine applies escalation.
 */

export type Confidence = 'P50' | 'P80';
export type ReserveMethod = 'Spread' | 'Manual';
export type OdcPhasing = 'year' | 'row';
export type PlugMode = 'last' | 'perPhase' | 'largest';
export type ColorOfMoney = 'RDT&E' | 'O&M' | 'Procurement' | 'Mixed';
export type RateBasis = 'actual' | 'survey' | '';
export type HoursBasis = 'productive' | 'paid';
export type Phase = 1 | 2;

export interface ControlInputs {
  scenario: string;
  /** Period-of-performance start, ISO date (YYYY-MM-DD). Drives milestone dates. */
  popStart: string;
  baseMonths: number;
  optionMonths: number;
  sprintLengthWeeks: number;
  /** Productive hours per sprint per FTE, net of leave and ceremonies. */
  productiveHrs: number;
  workingSprintsYr: number;
  /** Paid (full payroll) hours per sprint per FTE; capacity tiers can price on this basis. */
  paidHrs: number;
  fringe: number;
  overhead: number;
  gna: number;
  /** Material handling / G&A applied to ODC. */
  gnaODC: number;
  fee: number;
  escalation: number;
  subHandling: number;
  /** Optional fee applied on sub cost + handling. */
  subFee: number;
  confidence: Confidence;
  reserveMethod: ReserveMethod;
  manualReserve: number;
  /** Price-to-win adjustment applied after fee. */
  ptw: number;
  budgetCeiling: number;
  /** Whole-dollar rounding applied to milestone prices. */
  roundTo: number;
  colorPhase1: ColorOfMoney;
  colorPhase2: ColorOfMoney;
  odcPhasing: OdcPhasing;
  plugMode: PlugMode;
  /** Indirect burden applied to fixed milestone amounts. */
  fixedBurden: number;
  includePSupport: boolean;
  /** PI year -> productivity multiplier (>1 means fewer sprints needed that year). */
  automationCurve: Record<number, number>;
  /** PI year -> funded-capacity multiplier for that year. */
  surgeProfile: Record<number, number>;
}

export interface LaborRate {
  lcat: string;
  direct: number;
  rateBasis?: RateBasis;
  skill?: string;
  yoe?: number;
  degree?: string;
  location?: string;
  clearance?: string;
  source?: string;
}

export interface Archetype {
  name: string;
  /** Steady-state velocity, points per sprint. */
  velocity: number;
  /** Number of teams staffed with this shape. */
  teams: number;
  /** LCAT -> headcount on one team. */
  hc: Record<string, number>;
}

export interface VelocityInputs {
  /** Share of velocity reserved for defects/refactor (not new scope). */
  capacityReserve: number;
  /** First-PI-year velocity multiplier for ramping teams. */
  rampFactor: number;
  /** Historical sprint velocities; drives the CoV behind the reserve. */
  samples: number[];
}

export interface BacklogItem {
  capability: string;
  epic: string;
  pi: string;
  piYear: number;
  /** Must match a Milestone name for labor to map to a payable event. */
  milestone: string;
  archetype: string;
  low: number;
  likely: number;
  high: number;
}

export interface LoeLine {
  fn: string;
  lcat: string;
  fte: number;
  phase: Phase;
  months: number;
  rateYear: number;
}

export interface PSupportLine {
  role: string;
  lcat: string;
  fte: number;
  phase: Phase;
  months: number;
  rateYear: number;
}

export interface OdcLine {
  item: string;
  cat: string;
  basis?: string;
  phase: Phase;
  /** Year-1 dollars per program year (index 0 = year 1). */
  years: number[];
}

export interface Milestone {
  name: string;
  pi: string;
  phase: Phase;
  monthOffset: number;
  /** Fixed/management dollars attached to this milestone. */
  fixed: number;
  kpi: string;
  threshold: string;
  gated: boolean;
}

export interface TeamingPartner {
  party: string;
  subCost: number;
}

export interface CapacityTier {
  name: string;
  color: ColorOfMoney | string;
  /** Archetype name -> team count in this tier. */
  teams: Record<string, number>;
  monthlyODC: number;
}

export interface CapacityInputs {
  periodMonths: number;
  optionYears: number;
  reservePct: number;
  hoursBasis: HoursBasis;
  vehicle: string;
  dividend: string;
  colorDefault: ColorOfMoney | string;
  slaNote: string;
  mitigationNote: string;
  tiers: CapacityTier[];
}

export interface Pursuit {
  name: string;
  control: ControlInputs;
  rates: LaborRate[];
  archetypes: Archetype[];
  velocity: VelocityInputs;
  backlog: BacklogItem[];
  loe: LoeLine[];
  psupport: PSupportLine[];
  odc: OdcLine[];
  milestones: Milestone[];
  teaming: TeamingPartner[];
  capacity: CapacityInputs;
}

/* ------------------------------ results ------------------------------ */

export interface ArchetypeDerived {
  vel: number;
  teams: number;
  /** Loaded Year-1 cost of one team for one sprint. */
  cps: number;
  fte: number;
}

export interface BacklogDerived {
  cap: string;
  ms: string;
  py: number;
  arch: string;
  exp: number;
  sd: number;
  effP50: number;
  effP80: number;
  sp50: number;
  sp80: number;
  lp50: number;
  lp80: number;
  autoF: number;
}

export interface LoeDerived extends LoeLine {
  monthly: number;
  cost: number;
}

export interface PSupportDerived extends PSupportLine {
  monthly: number;
  cost: number;
}

export interface OdcDerived extends OdcLine {
  escTotal: number;
  withH: number;
}

export interface TeamingDerived extends TeamingPartner {
  handling: number;
  feeOnSub: number;
  price: number;
  share: number;
}

export interface MilestoneRow {
  name: string;
  pi: string;
  phase: Phase;
  monthOffset: number;
  fixed: number;
  labor: number;
  loeAlloc: number;
  psAlloc: number;
  odcAlloc: number;
  cost: number;
  price: number;
  primeShare: number;
  subShares: number[];
  kpi: string;
  threshold: string;
  gated: boolean;
}

export interface BoeCapability {
  element: string;
  epics: number;
  exp: number;
  sd: number;
  effPts: number;
  sprints: number;
  labor: number;
  totalCost: number;
  price: number;
}

export interface BoeExtra {
  element: string;
  totalCost: number;
  price: number;
}

export interface TierDerived {
  name: string;
  color: string;
  teamCount: number;
  fte: number;
  monthlyODC: number;
  costPeriod: number;
  pricePeriod: number;
  annualRunRate: number;
  termCost: number;
  termPrice: number;
  years: { year: number; annualCost: number; annualPrice: number }[];
  perFtePriced: number;
  grossup: number;
}

export interface CapacityDerived {
  periodMonths: number;
  periodsPerYear: number;
  optionYears: number;
  reservePct: number;
  wsPeriod: number;
  hoursBasis: HoursBasis;
  paidHrs: number;
  vehicle: string;
  dividend: string;
  colorDefault: string;
  slaNote: string;
  mitigationNote: string;
  tiers: TierDerived[];
}

export interface FundingRow {
  fy: number;
  total: number;
  cumulative: number;
  /** Per color-of-money amounts keyed by color name. */
  byColor: Record<string, number>;
}

export interface FundingDerived {
  rows: FundingRow[];
  colors: string[];
  colorPhase1: string;
  colorPhase2: string;
}

export interface DemandYear {
  year: number;
  needed: number;
  funded: number;
  surge: number;
  util: number;
  points: number;
}

export interface DemandDerived {
  neededP50: number;
  neededP80: number;
  needed: number;
  funded: number;
  gap: number;
  gapCost: number;
  byYear: DemandYear[];
}

export interface IntegrityCheck {
  n: number;
  label: string;
  val: number;
  ok: boolean;
}

export interface AdvisoryFlag {
  sev: 'warn' | 'bad';
  msg: string;
}

export interface ComputeResult {
  loaded: Record<string, number>;
  archMap: Record<string, ArchetypeDerived>;
  totalTeams: number;
  wsPoP: number;
  totalCapacity: number;
  blendedCps: number;
  cov: number;
  rows: BacklogDerived[];
  capLaborP50: Record<string, number>;
  capLaborP80: Record<string, number>;
  capSubP50: number;
  capSubP80: number;
  loeRows: LoeDerived[];
  loeTot: number;
  loeP1: number;
  loeP2: number;
  psRows: PSupportDerived[];
  psTot: number;
  psP1: number;
  psP2: number;
  includePS: boolean;
  odcRows: OdcDerived[];
  odcTot: number;
  odcP1: number;
  odcP2: number;
  yearsN: number;
  fixedTot: number;
  fixedRaw: number;
  fixedBurden: number;
  costP50: number;
  costP80: number;
  base: number;
  spread: number;
  resPct: number;
  resD: number;
  fee: number;
  subtotal: number;
  total: number;
  grossup: number;
  util: number;
  capFlag: string;
  sumSprP50: number;
  sumSprP80: number;
  demand: DemandDerived;
  ceiling: number;
  budgetVar: number;
  budgetStatus: string;
  teaming: TeamingDerived[];
  subsSubtotal: number;
  prime: number;
  primeShare: number;
  msRows: MilestoneRow[];
  phase1Price: number;
  phase2Price: number;
  msPriceTotal: number;
  boeCaps: BoeCapability[];
  boeExtra: BoeExtra[];
  boeTotalPrice: number;
  checks: IntegrityCheck[];
  allOk: boolean;
  progMonths: number;
  capacity: CapacityDerived;
  odcPhasing: OdcPhasing;
  odcDropped: number;
  plugMode: PlugMode;
  funding: FundingDerived;
  flags: AdvisoryFlag[];
  automationCurve: Record<number, number>;
}

export interface SimulationResult {
  iters: number;
  mean: number;
  std: number;
  p10: number;
  p50: number;
  p80: number;
  p90: number;
  min: number;
  max: number;
  deterministicP50: number;
  deterministicP80: number;
  samples: number[];
}

export interface SensitivityDriver {
  driver: string;
  low: number;
  high: number;
  base: number;
  swing: number;
}

export interface SensitivityResult {
  base: number;
  pct: number;
  drivers: SensitivityDriver[];
}
