import type { Archetype, LaborRate, Pursuit } from './types';

export const LCATS = [
  'Program Manager',
  'Scrum Master',
  'System Architect',
  'Sr Software Engineer',
  'Software Engineer',
  'DevSecOps Engineer',
  'Data/ML Engineer',
  'UI/UX Designer',
  'Test Engineer',
  'Security Engineer (cATO)',
  'Help Desk / Ops Tech',
];

const DIRECTS = [95, 80, 110, 95, 75, 90, 100, 78, 72, 92, 58];

export function hc(arr: number[]): Record<string, number> {
  const o: Record<string, number> = {};
  LCATS.forEach((l, i) => (o[l] = arr[i] ?? 0));
  return o;
}

type BacklogTuple = [string, string, string, number, string, string, number, number, number];

function backlogRows(rows: BacklogTuple[]) {
  return rows.map((r) => ({
    capability: r[0],
    epic: r[1],
    pi: r[2],
    piYear: r[3],
    milestone: r[4],
    archetype: r[5],
    low: r[6],
    likely: r[7],
    high: r[8],
  }));
}

/**
 * Reference baseline validated against the original workbook. The golden
 * test suite pins its computed totals — do not change these inputs without
 * updating the expected values deliberately.
 */
export function baselineSeed(): Pursuit {
  return {
    name: 'Reference Baseline (Framework & Mission Apps)',
    control: {
      scenario: 'Baseline',
      popStart: '2026-08-01',
      baseMonths: 12,
      optionMonths: 24,
      sprintLengthWeeks: 2,
      productiveHrs: 64,
      workingSprintsYr: 24,
      paidHrs: 80,
      fringe: 0.3,
      overhead: 0.45,
      gna: 0.12,
      gnaODC: 0.05,
      fee: 0.1,
      escalation: 0.03,
      subHandling: 0.05,
      subFee: 0,
      confidence: 'P80',
      reserveMethod: 'Spread',
      manualReserve: 0.06,
      ptw: 0,
      budgetCeiling: 60000000,
      roundTo: 1000,
      colorPhase1: 'RDT&E',
      colorPhase2: 'RDT&E',
      odcPhasing: 'year',
      plugMode: 'last',
      fixedBurden: 0,
      includePSupport: true,
      automationCurve: {},
      surgeProfile: {},
    },
    rates: LCATS.map((l, i) => ({
      lcat: l,
      direct: DIRECTS[i],
      rateBasis: 'actual',
      skill: 'Senior',
      source: 'Actual staff rate',
    })),
    archetypes: [
      { name: 'Platform', velocity: 40, teams: 1, hc: hc([0.5, 1, 1, 2, 3, 1, 1, 0.5, 2, 1, 0]) },
      { name: 'Mission', velocity: 42, teams: 1, hc: hc([0.5, 1, 1, 2, 3, 0.5, 1, 1, 2, 0.5, 0]) },
      { name: 'Delivery Squad', velocity: 38, teams: 1, hc: hc([0, 0, 0, 1, 2, 0, 0, 0, 1, 0, 0]) },
    ],
    velocity: { capacityReserve: 0.15, rampFactor: 0.8, samples: [36, 41, 39, 44, 38, 43] },
    backlog: backlogRows([
      ['Platform & Microservices Framework', 'Core microservices runtime', 'PI1', 1, 'Platform Increment 1', 'Platform', 120, 160, 220],
      ['Platform & Microservices Framework', 'Dashboard framework & UX library', 'PI1', 1, 'Platform Increment 1', 'Platform', 80, 110, 160],
      ['Platform & Microservices Framework', 'Semantic layer / agent exec env', 'PI2', 2, 'Platform Increment 2', 'Platform', 90, 130, 190],
      ['Target Discovery & Analytics', 'Target data management', 'PI1', 1, 'Mission MVP', 'Mission', 70, 100, 150],
      ['Target Discovery & Analytics', 'Discovery analytics', 'PI2', 2, 'Capability Release 1', 'Mission', 60, 90, 140],
      ['Mission Planning', 'Planning workflow', 'PI1', 1, 'Mission MVP', 'Mission', 90, 130, 180],
      ['Mission Planning', 'COA development & auto-TTP', 'PI2', 2, 'Capability Release 1', 'Mission', 80, 120, 170],
      ['Dynamic Mission Scheduling', 'Scheduling engine', 'PI2', 2, 'Capability Release 1', 'Mission', 70, 100, 150],
      ['Dynamic Mission Scheduling', 'Scheduling enhancements', 'PI3', 3, 'Capability Release 2', 'Mission', 50, 75, 110],
      ['Dynamic Battlespace Mgmt COP', 'Real-time COP/MAP', 'PI2', 2, 'Capability Release 1', 'Mission', 80, 120, 180],
      ['Dynamic Battlespace Mgmt COP', 'Battlespace mgmt improvements', 'PI3', 3, 'Capability Release 2', 'Mission', 60, 90, 130],
      ['Remote EW C2 Integration', 'EW C2 adapter framework', 'PI2', 2, 'Integration Gate', 'Platform', 80, 120, 170],
      ['Remote EW C2 Integration', 'Remote C2 end-to-end missions', 'PI3', 3, 'Capability Release 2', 'Mission', 90, 130, 190],
      ['Remote EW C2 Integration', 'M2M orchestration', 'PI3', 3, 'Capability Release 2', 'Platform', 60, 90, 140],
      ['AI/ML Services', 'MLOps pipeline', 'PI2', 2, 'Platform Increment 2', 'Platform', 70, 100, 150],
      ['AI/ML Services', 'Decision support / predictive', 'PI3', 3, 'Capability Release 2', 'Mission', 80, 120, 180],
      ['Security & cATO', 'cATO initial accreditation build', 'PI1', 1, 'PDR', 'Platform', 60, 90, 140],
      ['DevSecOps Platform', 'CI/CD, repos, scanning', 'PI1', 1, 'Platform Increment 1', 'Platform', 70, 100, 150],
      ['User Support & Training', 'Digital docs / help center', 'PI2', 2, 'Capability Release 1', 'Mission', 40, 60, 90],
      ['User Support & Training', 'Training env & curriculum', 'PI3', 3, 'Operational Support Gate', 'Mission', 50, 75, 110],
    ]),
    loe: [
      { fn: 'cATO continuous monitoring', lcat: 'Security Engineer (cATO)', fte: 1.5, phase: 1, months: 12, rateYear: 1 },
      { fn: 'cATO continuous monitoring', lcat: 'Security Engineer (cATO)', fte: 1.5, phase: 2, months: 24, rateYear: 2 },
      { fn: 'DevSecOps sustainment', lcat: 'DevSecOps Engineer', fte: 1, phase: 2, months: 24, rateYear: 2 },
      { fn: '24/7 Help Desk (post-acceptance)', lcat: 'Help Desk / Ops Tech', fte: 5, phase: 2, months: 18, rateYear: 3 },
      { fn: 'Tier-2 Ops on-call', lcat: 'Sr Software Engineer', fte: 0.5, phase: 2, months: 18, rateYear: 3 },
    ],
    psupport: [],
    odc: [
      { item: 'Cloud / Hosting', cat: 'Infrastructure', phase: 1, years: [600000, 800000, 900000] },
      { item: 'Software Licenses', cat: 'Licensing', phase: 1, years: [300000, 300000, 300000] },
      { item: 'Hardware / Lab', cat: 'Hardware', phase: 1, years: [400000, 150000, 150000] },
      { item: 'Travel', cat: 'ODC', phase: 1, years: [120000, 120000, 120000] },
      { item: 'Training Environment', cat: 'Training', phase: 1, years: [250000, 100000, 100000] },
      { item: 'Other ODC', cat: 'ODC', phase: 1, years: [150000, 150000, 150000] },
    ],
    milestones: [
      { name: 'Kick-off', pi: 'PI1', phase: 1, monthOffset: 0, fixed: 750000, kpi: '', threshold: '', gated: false },
      { name: 'Backlog & Roadmap Baseline', pi: 'PI1', phase: 1, monthOffset: 1, fixed: 300000, kpi: '', threshold: '', gated: false },
      { name: 'Platform Increment 1', pi: 'PI1', phase: 1, monthOffset: 4, fixed: 0, kpi: 'Platform availability', threshold: '99.5%', gated: true },
      { name: 'PDR', pi: 'PI1', phase: 1, monthOffset: 5, fixed: 150000, kpi: 'cATO readiness gate', threshold: 'Pass', gated: true },
      { name: 'Mission MVP', pi: 'PI1', phase: 1, monthOffset: 7, fixed: 0, kpi: 'Reduction in mission planning time', threshold: '30%', gated: true },
      { name: 'CDR', pi: 'PI2', phase: 1, monthOffset: 9, fixed: 100000, kpi: 'Design baseline approved', threshold: 'Pass', gated: true },
      { name: 'Platform Increment 2', pi: 'PI2', phase: 2, monthOffset: 11, fixed: 0, kpi: 'Decision-support accuracy uplift', threshold: 'Per RWG target', gated: true },
      { name: 'Integration Gate', pi: 'PI2', phase: 2, monthOffset: 12, fixed: 0, kpi: 'EW systems integrated', threshold: 'Per RWG target', gated: true },
      { name: 'Capability Release 1', pi: 'PI2', phase: 2, monthOffset: 14, fixed: 0, kpi: 'User satisfaction (survey)', threshold: 'Score >= 4/5', gated: true },
      { name: 'Capability Release 2', pi: 'PI3', phase: 2, monthOffset: 23, fixed: 0, kpi: 'EW systems supported (end state)', threshold: 'Hundreds', gated: true },
      { name: 'Operational Support Gate', pi: 'PI3', phase: 2, monthOffset: 33, fixed: 200000, kpi: 'Help desk response time', threshold: '<= 2 hrs', gated: true },
    ],
    teaming: [
      { party: 'Subcontractor 1', subCost: 2200000 },
      { party: 'Subcontractor 2', subCost: 700000 },
      { party: 'Subcontractor 3', subCost: 1100000 },
    ],
    capacity: {
      periodMonths: 12,
      optionYears: 3,
      reservePct: 0.05,
      hoursBasis: 'productive',
      vehicle: 'FFP w/ Priced Options',
      dividend: 'Reinvested capacity',
      colorDefault: 'RDT&E',
      slaNote:
        'Per option period: accepted release increments >= tier target; system availability >= 99.5%; critical defect escape <= agreed threshold; mean lead time within target. Payment tied to accepted increments, not hours.',
      mitigationNote:
        'Backlog, sprint artifacts and architecture docs delivered to the Government; data and IP rights per contract; modular design to enable recompete. Productivity gains reinvested as additional throughput within the funded capacity.',
      tiers: [
        { name: 'Sustainment', color: 'O&M', teams: { Platform: 1, Mission: 1 }, monthlyODC: 150000 },
        { name: 'Growth', color: 'RDT&E', teams: { Platform: 1, Mission: 2 }, monthlyODC: 250000 },
        { name: 'Acceleration', color: 'RDT&E', teams: { Platform: 2, Mission: 3 }, monthlyODC: 400000 },
        { name: 'Single Delivery Squad (full burden)', color: 'RDT&E', teams: { 'Delivery Squad': 1 }, monthlyODC: 0 },
      ],
    },
  };
}

export function blankSeed(): Pursuit {
  return {
    name: 'New Pursuit',
    control: {
      scenario: 'Baseline',
      popStart: new Date().toISOString().slice(0, 10),
      baseMonths: 12,
      optionMonths: 12,
      sprintLengthWeeks: 2,
      productiveHrs: 64,
      workingSprintsYr: 24,
      paidHrs: 80,
      fringe: 0.3,
      overhead: 0.45,
      gna: 0.12,
      gnaODC: 0.05,
      fee: 0.1,
      escalation: 0.03,
      subHandling: 0.05,
      subFee: 0,
      confidence: 'P80',
      reserveMethod: 'Spread',
      manualReserve: 0.06,
      ptw: 0,
      budgetCeiling: 10000000,
      roundTo: 1000,
      colorPhase1: 'RDT&E',
      colorPhase2: 'O&M',
      odcPhasing: 'year',
      plugMode: 'last',
      fixedBurden: 0,
      includePSupport: true,
      automationCurve: {},
      surgeProfile: {},
    },
    rates: LCATS.map((l, i) => ({ lcat: l, direct: DIRECTS[i], rateBasis: 'actual' })),
    archetypes: [{ name: 'Team A', velocity: 40, teams: 1, hc: hc([0.5, 1, 1, 2, 3, 1, 1, 0.5, 2, 1, 0]) }],
    velocity: { capacityReserve: 0.15, rampFactor: 0.8, samples: [40, 40, 40] },
    backlog: [
      { capability: 'Capability 1', epic: 'Epic 1', pi: 'PI1', piYear: 1, milestone: 'Increment 1', archetype: 'Team A', low: 60, likely: 90, high: 140 },
    ],
    loe: [],
    psupport: [],
    odc: [{ item: 'Cloud / Hosting', cat: 'Infrastructure', phase: 1, years: [0, 0, 0] }],
    milestones: [
      { name: 'Kick-off', pi: 'PI1', phase: 1, monthOffset: 0, fixed: 0, kpi: '', threshold: '', gated: false },
      { name: 'Increment 1', pi: 'PI1', phase: 1, monthOffset: 4, fixed: 0, kpi: '', threshold: '', gated: true },
    ],
    teaming: [],
    capacity: {
      periodMonths: 12,
      optionYears: 1,
      reservePct: 0.05,
      hoursBasis: 'productive',
      vehicle: 'FFP w/ Priced Options',
      dividend: 'Reinvested capacity',
      colorDefault: 'O&M',
      slaNote: 'Define acceptance per option period (accepted increments, availability/SLA, defect-escape, lead time).',
      mitigationNote: 'Backlog and artifacts delivered; data/IP rights per contract; modular design to enable recompete.',
      tiers: [{ name: 'Baseline Capacity', color: 'O&M', teams: { 'Team A': 1 }, monthlyODC: 0 }],
    },
  };
}

/**
 * Squad-based capacity calibrated to a past-performance cost basis (lighter
 * indirect, leaner team). A single 4-FTE delivery squad lands ~$873k/yr
 * priced, inside the $750k-$1M past-performance window.
 */
export function calibratedSeed(): Pursuit {
  const b = blankSeed();
  return {
    ...b,
    name: 'Squad Capacity — Calibrated to Past Performance',
    control: {
      ...b.control,
      scenario: 'Past-performance basis',
      popStart: '2026-08-01',
      baseMonths: 12,
      optionMonths: 24,
      fringe: 0.25,
      overhead: 0.15,
      gna: 0.08,
      budgetCeiling: 5000000,
      colorPhase1: 'RDT&E',
      colorPhase2: 'RDT&E',
    },
    rates: LCATS.map((l, i) => ({ lcat: l, direct: DIRECTS[i], rateBasis: 'survey' as const, source: 'Salary survey / HR3D' })),
    archetypes: [{ name: 'Delivery Squad', velocity: 38, teams: 1, hc: hc([0, 0, 0, 1, 2, 0, 0, 0, 1, 0, 0]) }],
    velocity: { capacityReserve: 0.15, rampFactor: 0.8, samples: [38, 40, 37] },
    backlog: [
      { capability: 'Continuous Delivery', epic: 'Feature set 1', pi: 'PI1', piYear: 1, milestone: 'Increment 1', archetype: 'Delivery Squad', low: 60, likely: 90, high: 140 },
      { capability: 'Continuous Delivery', epic: 'Feature set 2', pi: 'PI2', piYear: 2, milestone: 'Increment 2', archetype: 'Delivery Squad', low: 60, likely: 90, high: 140 },
    ],
    odc: [{ item: 'Cloud / Tooling', cat: 'Infrastructure', phase: 1, years: [0, 0, 0] }],
    milestones: [
      { name: 'Kick-off', pi: 'PI1', phase: 1, monthOffset: 0, fixed: 0, kpi: '', threshold: '', gated: false },
      { name: 'Increment 1', pi: 'PI1', phase: 1, monthOffset: 6, fixed: 0, kpi: 'Accepted increments this period', threshold: 'Per tier target', gated: true },
      { name: 'Increment 2', pi: 'PI2', phase: 2, monthOffset: 18, fixed: 0, kpi: 'Accepted increments this period', threshold: 'Per tier target', gated: true },
    ],
    capacity: {
      ...b.capacity,
      optionYears: 3,
      vehicle: 'OTA (Prototype/Production)',
      colorDefault: 'RDT&E',
      slaNote:
        'Per option period: accepted release increments >= tier target; availability per SLA; critical defect escape <= agreed threshold; lead time within target. Calibrated to past-performance throughput, not labor hours.',
      mitigationNote:
        'Backlog and artifacts delivered; data/IP rights per agreement; modular design to enable recompete. Indirect rates reflect the actual delivery cost basis, lighter than the full government-burdened program model.',
      tiers: [
        { name: 'Sustainment (1 squad)', color: 'O&M', teams: { 'Delivery Squad': 1 }, monthlyODC: 0 },
        { name: 'Growth (2 squads)', color: 'RDT&E', teams: { 'Delivery Squad': 2 }, monthlyODC: 8000 },
        { name: 'Acceleration (3 squads)', color: 'RDT&E', teams: { 'Delivery Squad': 3 }, monthlyODC: 15000 },
      ],
    },
  };
}

/** Showcase pursuit: every capability populated so a reviewer can see them in action. */
export function demoSeed(): Pursuit {
  const rb: Partial<LaborRate>[] = [
    { rateBasis: 'actual', skill: 'Senior', source: 'Actual incumbent rate' },
    { rateBasis: 'actual', skill: 'Senior', source: 'Actual incumbent rate' },
    { rateBasis: 'survey', skill: 'Principal', yoe: 15, degree: 'MS', location: 'National Capital Region', clearance: 'TS/SCI', source: 'ERI survey 2025' },
    { rateBasis: 'survey', skill: 'Senior', yoe: 10, degree: 'BS', location: 'Huntsville, AL', clearance: 'Secret', source: 'HR3D' },
    { rateBasis: 'survey', skill: 'Mid', yoe: 5, degree: 'BS', location: 'Huntsville, AL', clearance: 'Secret', source: 'HR3D' },
    { rateBasis: 'actual', skill: 'Senior', source: 'Actual incumbent rate' },
    { rateBasis: 'survey', skill: 'Senior', yoe: 8, degree: 'MS', location: 'Remote', clearance: 'Secret', source: 'Salary survey 2025' },
    { rateBasis: 'actual', skill: 'Mid', source: 'Actual incumbent rate' },
    { rateBasis: 'survey', skill: 'Mid', yoe: 6, degree: 'BS', location: 'Huntsville, AL', clearance: 'Secret', source: 'HR3D' },
    { rateBasis: 'actual', skill: 'Senior', source: 'Actual incumbent rate' },
    { rateBasis: 'survey', skill: 'Junior', yoe: 2, degree: 'AA', location: 'Huntsville, AL', clearance: 'None', source: 'HR3D' },
  ];
  const rates: LaborRate[] = LCATS.map((l, i) => ({ lcat: l, direct: DIRECTS[i], ...rb[i] }));
  rates.push({ lcat: 'Program Control Analyst', direct: 85, rateBasis: 'survey', skill: 'Senior', yoe: 9, degree: 'BS', location: 'Huntsville, AL', clearance: 'Secret', source: 'HR3D' });
  rates.push({ lcat: 'Contracts Specialist', direct: 90, rateBasis: 'actual', skill: 'Senior', source: 'Actual incumbent rate' });
  rates.push({ lcat: 'Business Mgmt Analyst', direct: 80, rateBasis: 'survey', skill: 'Mid', yoe: 6, degree: 'BS', location: 'Remote', clearance: 'Secret', source: 'HR3D' });
  const archetypes: Archetype[] = [
    { name: 'Platform Squad', velocity: 40, teams: 2, hc: hc([0.5, 1, 1, 2, 3, 1, 0, 0.5, 2, 0.5, 0]) },
    { name: 'Apps Squad', velocity: 42, teams: 2, hc: hc([0.5, 1, 0.5, 2, 3, 0.5, 1, 1, 2, 0.5, 0]) },
  ];
  return {
    name: 'Feature Showcase — Software Factory',
    control: {
      scenario: 'Showcase',
      popStart: '2026-10-01',
      baseMonths: 12,
      optionMonths: 24,
      sprintLengthWeeks: 2,
      productiveHrs: 64,
      workingSprintsYr: 24,
      paidHrs: 80,
      fringe: 0.3,
      overhead: 0.45,
      gna: 0.12,
      gnaODC: 0.05,
      fee: 0.1,
      escalation: 0.03,
      subHandling: 0.05,
      subFee: 0.05,
      confidence: 'P80',
      reserveMethod: 'Spread',
      manualReserve: 0.06,
      ptw: 0,
      budgetCeiling: 45000000,
      roundTo: 1000,
      colorPhase1: 'RDT&E',
      colorPhase2: 'O&M',
      odcPhasing: 'year',
      plugMode: 'perPhase',
      fixedBurden: 0.08,
      includePSupport: true,
      automationCurve: { 2: 1.15, 3: 1.3 },
      surgeProfile: { 1: 1.2, 3: 0.75 },
    },
    rates,
    archetypes,
    velocity: { capacityReserve: 0.15, rampFactor: 0.8, samples: [38, 41, 43, 39, 42, 40] },
    backlog: [
      { capability: 'Platform Foundation', epic: 'Core services', pi: 'PI1', piYear: 1, milestone: 'Platform MVP', archetype: 'Platform Squad', low: 140, likely: 190, high: 260 },
      { capability: 'Platform Foundation', epic: 'UX framework', pi: 'PI1', piYear: 1, milestone: 'Platform MVP', archetype: 'Apps Squad', low: 90, likely: 130, high: 180 },
      { capability: 'Security & cATO', epic: 'cATO build', pi: 'PI1', piYear: 1, milestone: 'cATO Gate', archetype: 'Platform Squad', low: 80, likely: 110, high: 150 },
      { capability: 'Mission Apps', epic: 'Planning workflow', pi: 'PI2', piYear: 2, milestone: 'Capability Release 1', archetype: 'Apps Squad', low: 100, likely: 140, high: 200 },
      { capability: 'Mission Apps', epic: 'Discovery analytics', pi: 'PI2', piYear: 2, milestone: 'Capability Release 1', archetype: 'Platform Squad', low: 80, likely: 120, high: 170 },
      { capability: 'Data Services', epic: 'MLOps pipeline', pi: 'PI2', piYear: 2, milestone: 'Capability Release 1', archetype: 'Platform Squad', low: 70, likely: 100, high: 150 },
      { capability: 'Mission Apps', epic: 'COA automation', pi: 'PI3', piYear: 3, milestone: 'Capability Release 2', archetype: 'Apps Squad', low: 90, likely: 130, high: 190 },
      { capability: 'Sustainment', epic: 'Enhancements & ops', pi: 'PI3', piYear: 3, milestone: 'Operational Support Gate', archetype: 'Apps Squad', low: 60, likely: 90, high: 130 },
    ],
    loe: [
      { fn: 'cATO continuous monitoring', lcat: 'Security Engineer (cATO)', fte: 1, phase: 2, months: 24, rateYear: 2 },
      { fn: 'DevSecOps sustainment', lcat: 'DevSecOps Engineer', fte: 1, phase: 2, months: 24, rateYear: 2 },
    ],
    psupport: [
      { role: 'Program Manager (PMO)', lcat: 'Program Manager', fte: 0.5, phase: 1, months: 36, rateYear: 1 },
      { role: 'Program Control Analyst / Finance', lcat: 'Program Control Analyst', fte: 1, phase: 1, months: 36, rateYear: 1 },
      { role: 'Contracts / Subcontracts', lcat: 'Contracts Specialist', fte: 0.25, phase: 1, months: 36, rateYear: 1 },
      { role: 'Business Management & Reporting', lcat: 'Business Mgmt Analyst', fte: 0.25, phase: 2, months: 24, rateYear: 2 },
    ],
    odc: [
      { item: 'Cloud / Hosting', cat: 'Infrastructure', basis: '~$25k/mo x 36 mo', phase: 1, years: [300000, 320000, 340000] },
      { item: 'Software Licenses', cat: 'Licensing', basis: '120 seats x ~$2.5k/yr', phase: 1, years: [300000, 300000, 300000] },
      { item: 'Hardware / Lab', cat: 'Hardware', basis: 'lab refresh + test rigs', phase: 1, years: [250000, 80000, 80000] },
      { item: 'Travel', cat: 'Travel', basis: '~8 trips/yr x ~$3k', phase: 1, years: [120000, 120000, 120000] },
      { item: 'Training Environment', cat: 'Training', basis: 'env + curriculum dev', phase: 1, years: [150000, 60000, 60000] },
      { item: 'cATO / Accreditation', cat: 'Certification & Accreditation', basis: 'assessor + scan tooling', phase: 1, years: [200000, 80000, 80000] },
      { item: 'Data egress / storage', cat: 'Data', basis: 'egress + storage tiers', phase: 1, years: [60000, 70000, 80000] },
    ],
    milestones: [
      { name: 'Kick-off', pi: 'PI1', phase: 1, monthOffset: 0, fixed: 400000, kpi: '', threshold: '', gated: false },
      { name: 'Platform MVP', pi: 'PI1', phase: 1, monthOffset: 5, fixed: 0, kpi: 'Platform availability', threshold: '99.5%', gated: true },
      { name: 'cATO Gate', pi: 'PI1', phase: 1, monthOffset: 8, fixed: 120000, kpi: 'cATO authorization', threshold: 'ATO granted', gated: true },
      { name: 'Capability Release 1', pi: 'PI2', phase: 2, monthOffset: 14, fixed: 0, kpi: 'User satisfaction', threshold: '>= 4/5', gated: true },
      { name: 'Capability Release 2', pi: 'PI3', phase: 2, monthOffset: 26, fixed: 0, kpi: 'Mission tasks automated', threshold: 'Per RWG target', gated: true },
      { name: 'Operational Support Gate', pi: 'PI3', phase: 2, monthOffset: 34, fixed: 150000, kpi: 'Help desk response', threshold: '<= 2 hrs', gated: true },
    ],
    teaming: [{ party: 'Niche EW Subcontractor', subCost: 1200000 }],
    capacity: {
      periodMonths: 12,
      optionYears: 3,
      reservePct: 0.05,
      hoursBasis: 'productive',
      vehicle: 'FFP w/ Priced Options',
      dividend: 'Reinvested capacity',
      colorDefault: 'O&M',
      slaNote:
        'Per option period: accepted release increments >= tier target; availability >= 99.5%; defect escape <= threshold; lead time within target. Payment tied to accepted increments.',
      mitigationNote:
        'Backlog, sprint artifacts and architecture docs delivered; data/IP rights per contract; modular design to enable recompete. AI-driven throughput reinvested within funded capacity.',
      tiers: [
        { name: 'Sustainment', color: 'O&M', teams: { 'Platform Squad': 1, 'Apps Squad': 1 }, monthlyODC: 60000 },
        { name: 'Surge', color: 'RDT&E', teams: { 'Platform Squad': 2, 'Apps Squad': 2 }, monthlyODC: 120000 },
      ],
    },
  };
}
