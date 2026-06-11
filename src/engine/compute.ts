import type {
  AdvisoryFlag,
  ArchetypeDerived,
  BacklogDerived,
  BoeCapability,
  BoeExtra,
  ComputeResult,
  DemandYear,
  FundingRow,
  IntegrityCheck,
  LoeDerived,
  MilestoneRow,
  OdcDerived,
  PSupportDerived,
  Pursuit,
  TeamingDerived,
  TierDerived,
} from './types';

/** Average paid hours per month used to cost FTE-month lines (LOE, program support). */
export const MONTHLY_HOURS = 173.2;
/** z-score for the 80th percentile of a normal distribution. */
export const Z_P80 = 0.84;

export function mean(a: number[]): number {
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
}

export function stdevSample(a: number[]): number {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));
}

/** Compound escalation factor for a PI year (year 1 = no escalation). */
export function escF(piYear: number, esc: number): number {
  return Math.pow(1 + esc, Math.max(0, (piYear || 1) - 1));
}

/** Round to the nearest multiple (Excel MROUND). A multiple of 0 returns v unchanged. */
export function mround(v: number, m: number): number {
  if (!m) return v;
  return Math.round(v / m) * m;
}

export function num(x: unknown): number {
  const n = typeof x === 'number' ? x : parseFloat(String(x));
  return Number.isFinite(n) ? n : 0;
}

export function compute(s: Pursuit): ComputeResult {
  const c = s.control;
  const esc = num(c.escalation);
  const fringe = num(c.fringe);
  const oh = num(c.overhead);
  const gna = num(c.gna);
  const progMonths = num(c.baseMonths) + num(c.optionMonths);
  const conf = c.confidence || 'P80';

  // Rates -> loaded Year-1 hourly
  const loaded: Record<string, number> = {};
  for (const r of s.rates) {
    loaded[r.lcat] = num(r.direct) * (1 + fringe) * (1 + oh) * (1 + gna);
  }

  // Archetypes -> cost per team-sprint (Yr1), velocity, team counts
  const archMap: Record<string, ArchetypeDerived> = {};
  for (const a of s.archetypes) {
    let cps = 0;
    let fte = 0;
    for (const r of s.rates) {
      const h = num((a.hc || {})[r.lcat]);
      cps += h * (loaded[r.lcat] || 0);
      fte += h;
    }
    cps *= num(c.productiveHrs);
    archMap[a.name] = { vel: num(a.velocity), teams: num(a.teams), cps, fte };
  }
  const totalTeams = s.archetypes.reduce((t, a) => t + num(a.teams), 0);
  const wsPoP = (num(c.workingSprintsYr) * progMonths) / 12;
  const totalCapacity = wsPoP * totalTeams;
  const blendedCps = totalTeams
    ? s.archetypes.reduce((t, a) => t + archMap[a.name].cps * num(a.teams), 0) / totalTeams
    : 0;

  // Velocity coefficient of variation from historical samples
  const cov = mean(s.velocity.samples)
    ? stdevSample(s.velocity.samples) / mean(s.velocity.samples)
    : 0;
  const capRes = num(s.velocity.capacityReserve);
  const ramp = num(s.velocity.rampFactor);

  // Per-backlog row: points -> effective points -> sprints -> escalated labor
  const rows: BacklogDerived[] = [];
  const capLaborP50: Record<string, number> = {};
  const capLaborP80: Record<string, number> = {};
  const msLaborP50: Record<string, number> = {};
  const msLaborP80: Record<string, number> = {};
  const capExp: Record<string, number> = {};
  const capSd: Record<string, number> = {};
  const capEpics: Record<string, number> = {};
  const capEffP50: Record<string, number> = {};
  const capEffP80: Record<string, number> = {};
  const capSprP50: Record<string, number> = {};
  const capSprP80: Record<string, number> = {};
  const sprByYearP50: Record<number, number> = {};
  const sprByYearP80: Record<number, number> = {};
  const ptsByYear: Record<number, number> = {};
  let sumSprP50 = 0;
  let sumSprP80 = 0;
  const autoCurve = c.automationCurve || {};

  for (const b of s.backlog) {
    const lo = num(b.low);
    const li = num(b.likely);
    const hi = num(b.high);
    const exp = (lo + 4 * li + hi) / 6; // PERT expected
    const sd = (hi - lo) / 6;
    const a = archMap[b.archetype] || { vel: 0, cps: 0, teams: 0, fte: 0 };
    const py = num(b.piYear) || 1;
    let autoF = num(autoCurve[py]);
    if (!(autoF > 0)) autoF = 1; // >1 = productivity uplift (AI), fewer sprints
    const effP50 = capRes < 1 ? exp / (1 - capRes) : 0;
    const effP80 = capRes < 1 ? (exp + Z_P80 * sd) / (1 - capRes) : 0;
    const rm = py === 1 ? ramp : 1;
    const denom = a.vel * rm * autoF;
    const sp50 = denom ? effP50 / denom : 0;
    const sp80 = denom ? effP80 / denom : 0;
    const cpse = a.cps * escF(py, esc);
    const lp50 = sp50 * cpse;
    const lp80 = sp80 * cpse;
    sumSprP50 += sp50;
    sumSprP80 += sp80;
    sprByYearP50[py] = (sprByYearP50[py] || 0) + sp50;
    sprByYearP80[py] = (sprByYearP80[py] || 0) + sp80;
    ptsByYear[py] = (ptsByYear[py] || 0) + exp;
    const cap = b.capability || '';
    const ms = b.milestone || '';
    capLaborP50[cap] = (capLaborP50[cap] || 0) + lp50;
    capLaborP80[cap] = (capLaborP80[cap] || 0) + lp80;
    msLaborP50[ms] = (msLaborP50[ms] || 0) + lp50;
    msLaborP80[ms] = (msLaborP80[ms] || 0) + lp80;
    capExp[cap] = (capExp[cap] || 0) + exp;
    capSd[cap] = (capSd[cap] || 0) + sd;
    capEpics[cap] = (capEpics[cap] || 0) + 1;
    capEffP50[cap] = (capEffP50[cap] || 0) + effP50;
    capEffP80[cap] = (capEffP80[cap] || 0) + effP80;
    capSprP50[cap] = (capSprP50[cap] || 0) + sp50;
    capSprP80[cap] = (capSprP80[cap] || 0) + sp80;
    rows.push({ cap, ms, py, arch: b.archetype, exp, sd, effP50, effP80, sp50, sp80, lp50, lp80, autoF });
  }
  const capSubP50 = Object.values(capLaborP50).reduce((a, b) => a + b, 0);
  const capSubP80 = Object.values(capLaborP80).reduce((a, b) => a + b, 0);

  // Persistent LOE
  let loeTot = 0;
  let loeP1 = 0;
  let loeP2 = 0;
  const loeRows: LoeDerived[] = [];
  for (const l of s.loe) {
    const rate = loaded[l.lcat] || 0;
    const monthly = num(l.fte) * rate * MONTHLY_HOURS * escF(num(l.rateYear), esc);
    const cost = monthly * num(l.months);
    loeTot += cost;
    if (num(l.phase) === 1) loeP1 += cost;
    else loeP2 += cost;
    loeRows.push({ ...l, monthly, cost });
  }

  // Program-support labor (PM office, finance, contracts) — distinct from sprint teams and ops LOE
  const includePS = c.includePSupport !== false;
  let psTot = 0;
  let psP1 = 0;
  let psP2 = 0;
  const psRows: PSupportDerived[] = [];
  for (const p of s.psupport || []) {
    const rate = loaded[p.lcat] || 0;
    const monthly = num(p.fte) * rate * MONTHLY_HOURS * escF(num(p.rateYear), esc);
    const cost = monthly * num(p.months) * (includePS ? 1 : 0);
    psTot += cost;
    if (num(p.phase) === 1) psP1 += cost;
    else psP2 += cost;
    psRows.push({ ...p, monthly, cost });
  }

  // ODC: year columns escalated by year index, plus material handling
  const yearsN = Math.max(1, Math.ceil(progMonths / 12));
  const odcPhasing = c.odcPhasing === 'row' ? 'row' : 'year';
  const odcRows: OdcDerived[] = [];
  let odcEsc = 0;
  let odcYr1 = 0;
  let odcP1raw = 0;
  let odcDropped = 0;
  for (const o of s.odc) {
    let escTotal = 0;
    const yrs = o.years || [];
    for (let y = 0; y < yearsN; y++) {
      const v = num(yrs[y]);
      escTotal += v * Math.pow(1 + esc, y);
      if (y === 0) odcYr1 += v;
      if (num(o.phase) === 1) odcP1raw += v * Math.pow(1 + esc, y);
    }
    for (let y = yearsN; y < yrs.length; y++) {
      if (num(yrs[y]) !== 0) odcDropped += num(yrs[y]);
    }
    const withH = escTotal * (1 + num(c.gnaODC));
    odcEsc += escTotal;
    odcRows.push({ ...o, escTotal, withH });
  }
  const odcTot = odcEsc * (1 + num(c.gnaODC));
  const odcP1 = (odcPhasing === 'row' ? odcP1raw : odcYr1) * (1 + num(c.gnaODC));
  const odcP2 = odcTot - odcP1;

  const fixedBurden = num(c.fixedBurden);
  const fixedRaw = s.milestones.reduce((t, m) => t + num(m.fixed), 0);
  const fixedTot = fixedRaw * (1 + fixedBurden);

  // Cost-to-price stack
  const costP50 = capSubP50 + loeTot + psTot + odcTot + fixedTot;
  const costP80 = capSubP80 + loeTot + psTot + odcTot + fixedTot;
  const base = conf === 'P80' ? costP80 : costP50;
  const spread = costP50 ? (costP80 - costP50) / costP50 : 0;
  const resPct = c.reserveMethod === 'Manual' ? num(c.manualReserve) : Math.max(spread, cov);
  const resD = base * resPct;
  const fee = (base + resD) * num(c.fee);
  const subtotal = base + resD + fee;
  const total = subtotal * (1 + num(c.ptw));
  const grossup = base ? total / base : 0;
  const util = totalCapacity ? sumSprP50 / totalCapacity : 0;
  const capFlag =
    util < 0.7
      ? 'UNDER-SCOPED: backlog fills <70% of staffed capacity'
      : util > 1.05
        ? 'OVER-SUBSCRIBED: backlog exceeds capacity'
        : 'OK';
  const ceiling = num(c.budgetCeiling);
  const budgetVar = ceiling - total;
  const budgetStatus =
    total > ceiling
      ? 'OVER BUDGET'
      : total < 0.7 * ceiling
        ? 'WELL UNDER: review scope/capacity vs target'
        : 'WITHIN RANGE';

  // Teaming
  const subH = num(c.subHandling);
  const subFee = num(c.subFee);
  const teaming: TeamingDerived[] = s.teaming.map((t) => {
    const handling = num(t.subCost) * subH;
    const feeOnSub = (num(t.subCost) + handling) * subFee;
    const price = num(t.subCost) + handling + feeOnSub;
    return { ...t, handling, feeOnSub, price, share: total ? price / total : 0 };
  });
  const subsSubtotal = teaming.reduce((a, t) => a + t.price, 0);
  const prime = total - subsSubtotal;
  const primeShare = total ? prime / total : 0;

  // Milestone mapping: backlog labor by name; LOE/PS/ODC allocated pro-rata within phase
  const laborCol = conf === 'P80' ? msLaborP80 : msLaborP50;
  const phaseLabor: Record<number, number> = { 1: 0, 2: 0 };
  for (const m of s.milestones) {
    phaseLabor[num(m.phase)] += laborCol[m.name] || 0;
  }
  const plugMode = c.plugMode === 'perPhase' || c.plugMode === 'largest' ? c.plugMode : 'last';
  const msCost = s.milestones.map((m) => {
    const ph = num(m.phase) as 1 | 2;
    const g = laborCol[m.name] || 0;
    const loeAlloc = phaseLabor[ph] ? ((ph === 1 ? loeP1 : loeP2) * g) / phaseLabor[ph] : 0;
    const psAlloc = phaseLabor[ph] ? ((ph === 1 ? psP1 : psP2) * g) / phaseLabor[ph] : 0;
    const odcAlloc = phaseLabor[ph] ? ((ph === 1 ? odcP1 : odcP2) * g) / phaseLabor[ph] : 0;
    const fx = num(m.fixed) * (1 + fixedBurden);
    return { m, ph, g, loeAlloc, psAlloc, odcAlloc, fixed: fx, cost: fx + g + loeAlloc + psAlloc + odcAlloc };
  });
  const prices = msCost.map((x) => mround(x.cost * grossup, num(c.roundTo)));
  if (plugMode === 'last') {
    if (prices.length) {
      const others = prices.slice(0, -1).reduce((a, b) => a + b, 0);
      prices[prices.length - 1] = total - others;
    }
  } else if (plugMode === 'largest') {
    const resid = total - prices.reduce((a, b) => a + b, 0);
    let li = 0;
    let lv = -Infinity;
    prices.forEach((p, i) => {
      if (p > lv) {
        lv = p;
        li = i;
      }
    });
    if (prices.length) prices[li] += resid;
  } else {
    // perPhase: each phase ties to its own cost*grossup; the last milestone in the phase carries that phase's residual
    for (const ph of [1, 2]) {
      const idx = msCost.map((x, i) => (x.ph === ph ? i : -1)).filter((i) => i >= 0);
      if (!idx.length) continue;
      const phaseTarget = idx.reduce((a, i) => a + msCost[i].cost, 0) * grossup;
      const last = idx[idx.length - 1];
      let others = 0;
      for (const i of idx) if (i !== last) others += prices[i];
      prices[last] = phaseTarget - others;
    }
  }
  const msRows: MilestoneRow[] = msCost.map((x, i) => ({
    name: x.m.name,
    pi: x.m.pi,
    phase: x.ph,
    monthOffset: num(x.m.monthOffset),
    fixed: x.fixed,
    labor: x.g,
    loeAlloc: x.loeAlloc,
    psAlloc: x.psAlloc,
    odcAlloc: x.odcAlloc,
    cost: x.cost,
    price: prices[i],
    primeShare: prices[i] * primeShare,
    subShares: teaming.map((t) => prices[i] * (total ? t.price / total : 0)),
    kpi: x.m.kpi,
    threshold: x.m.threshold,
    gated: x.m.gated,
  }));
  const phase1Price = msRows.filter((r) => r.phase === 1).reduce((a, r) => a + r.price, 0);
  const phase2Price = msRows.filter((r) => r.phase === 2).reduce((a, r) => a + r.price, 0);
  const msPriceTotal = msRows.reduce((a, r) => a + r.price, 0);
  const minMsPrice = msRows.length ? Math.min(...msRows.map((r) => r.price)) : 0;

  // Basis of estimate
  const boeCaps: BoeCapability[] = Object.keys(capLaborP80).map((cap) => {
    const labor = conf === 'P80' ? capLaborP80[cap] : capLaborP50[cap];
    return {
      element: cap,
      epics: capEpics[cap],
      exp: capExp[cap],
      sd: capSd[cap],
      effPts: conf === 'P80' ? capEffP80[cap] : capEffP50[cap],
      sprints: conf === 'P80' ? capSprP80[cap] : capSprP50[cap],
      labor,
      totalCost: labor,
      price: labor * grossup,
    };
  });
  const boeExtra: BoeExtra[] = [
    { element: 'Persistent LOE (cATO + 24/7 Ops)', totalCost: loeTot, price: loeTot * grossup },
    { element: 'Program Support (PM office, finance, contracts, BM)', totalCost: psTot, price: psTot * grossup },
    { element: 'ODC (escalated + handling)', totalCost: odcTot, price: odcTot * grossup },
    {
      element: 'Program Mgmt & Mobilization (fixed' + (fixedBurden > 0 ? ' + burden' : '') + ')',
      totalCost: fixedTot,
      price: fixedTot * grossup,
    },
  ];
  const boeTotalPrice =
    boeCaps.reduce((a, b) => a + b.price, 0) + boeExtra.reduce((a, b) => a + b.price, 0);

  // Capacity subscription tiers (additive; does not affect milestone pricing/total)
  const cap = s.capacity;
  const periodMonths = num(cap.periodMonths) || 12;
  const optionYears = Math.max(1, Math.round(num(cap.optionYears) || 1));
  const subRes = num(cap.reservePct);
  const feePct = num(c.fee);
  const periodsPerYear = periodMonths > 0 ? 12 / periodMonths : 1;
  const wsPeriod = (num(c.workingSprintsYr) * periodMonths) / 12;
  const hoursBasis = cap.hoursBasis === 'paid' ? 'paid' : 'productive';
  const paidHrs = num(c.paidHrs) || 80;
  const hoursMult = hoursBasis === 'paid' && num(c.productiveHrs) ? paidHrs / num(c.productiveHrs) : 1;
  const tierRows: TierDerived[] = (cap.tiers || []).map((t) => {
    let teamCount = 0;
    let perSprintCost = 0;
    let tierFte = 0;
    for (const a of s.archetypes) {
      const n = num((t.teams || {})[a.name]);
      teamCount += n;
      perSprintCost += n * (archMap[a.name]?.cps ?? 0) * hoursMult;
      tierFte += n * (archMap[a.name]?.fte ?? 0);
    }
    const laborPeriod = perSprintCost * wsPeriod; // Yr1 basis
    const odcPeriod = num(t.monthlyODC) * periodMonths * (1 + num(c.gnaODC));
    const costPeriod = laborPeriod + odcPeriod;
    const rD = costPeriod * subRes;
    const fe = (costPeriod + rD) * feePct;
    const pricePeriod = costPeriod + rD + fe; // mirrors program reserve+fee shape
    const annualRunRate = pricePeriod * periodsPerYear; // Yr1
    let termCost = 0;
    let termPrice = 0;
    const years: TierDerived['years'] = [];
    for (let y = 1; y <= optionYears; y++) {
      const f = Math.pow(1 + esc, y - 1);
      const ac = costPeriod * periodsPerYear * f;
      const ap = pricePeriod * periodsPerYear * f;
      years.push({ year: y, annualCost: ac, annualPrice: ap });
      termCost += ac;
      termPrice += ap;
    }
    return {
      name: t.name,
      color: t.color || '',
      teamCount,
      fte: tierFte,
      monthlyODC: num(t.monthlyODC),
      costPeriod,
      pricePeriod,
      annualRunRate,
      termCost,
      termPrice,
      years,
      perFtePriced: tierFte ? annualRunRate / tierFte : 0,
      grossup: costPeriod ? pricePeriod / costPeriod : 0,
    };
  });
  const capacityOut = {
    periodMonths,
    periodsPerYear,
    optionYears,
    reservePct: subRes,
    wsPeriod,
    hoursBasis: hoursBasis as 'paid' | 'productive',
    paidHrs,
    vehicle: cap.vehicle || '',
    dividend: cap.dividend || '',
    colorDefault: String(cap.colorDefault || ''),
    slaNote: cap.slaNote || '',
    mitigationNote: cap.mitigationNote || '',
    tiers: tierRows,
  };

  // Funding by federal fiscal year (Oct-Sep) and color of money (reads off the milestone schedule)
  const ps = new Date((c.popStart || '2026-01-01') + 'T00:00:00');
  const colP1 = c.colorPhase1 || 'RDT&E';
  const colP2 = c.colorPhase2 || 'RDT&E';
  const fundByFY: Record<number, { total: number; byColor: Record<string, number> }> = {};
  for (const r of msRows) {
    const d = new Date(ps);
    d.setMonth(d.getMonth() + r.monthOffset);
    const fy = d.getMonth() >= 9 ? d.getFullYear() + 1 : d.getFullYear();
    const color = r.phase === 1 ? colP1 : colP2;
    fundByFY[fy] = fundByFY[fy] || { total: 0, byColor: {} };
    fundByFY[fy].byColor[color] = (fundByFY[fy].byColor[color] || 0) + r.price;
    fundByFY[fy].total += r.price;
  }
  const fundingColors = [...new Set(msRows.map((r) => (r.phase === 1 ? colP1 : colP2)))];
  const fundingRows: FundingRow[] = Object.keys(fundByFY)
    .map(Number)
    .sort((a, b) => a - b)
    .map((fy) => ({ fy, total: fundByFY[fy].total, byColor: fundByFY[fy].byColor, cumulative: 0 }));
  let cum = 0;
  for (const f of fundingRows) {
    cum += f.total;
    f.cumulative = cum;
  }
  const funding = { rows: fundingRows, colors: fundingColors, colorPhase1: colP1, colorPhase2: colP2 };

  // Demand (sprints needed) vs funded capacity, overall and by PI year
  const surge = c.surgeProfile || {};
  const demandYears = [...new Set([...Object.keys(sprByYearP50), ...Object.keys(ptsByYear)].map(Number))].sort(
    (a, b) => a - b,
  );
  const wsYear = num(c.workingSprintsYr);
  const demandByYear: DemandYear[] = demandYears.map((y) => {
    let sf = num(surge[y]);
    if (!(sf > 0)) sf = 1;
    const funded = wsYear * totalTeams * sf;
    const needed = conf === 'P80' ? sprByYearP80[y] || 0 : sprByYearP50[y] || 0;
    return { year: y, needed, funded, surge: sf, util: funded ? needed / funded : 0, points: ptsByYear[y] || 0 };
  });
  const demandSprints = conf === 'P80' ? sumSprP80 : sumSprP50;
  const demand = {
    neededP50: sumSprP50,
    neededP80: sumSprP80,
    needed: demandSprints,
    funded: totalCapacity,
    gap: totalCapacity - demandSprints,
    gapCost: (totalCapacity - demandSprints) * blendedCps,
    byYear: demandByYear,
  };

  // Sanity-band advisory flags
  const flags: AdvisoryFlag[] = [];
  if (util > 0 && util < 0.7)
    flags.push({
      sev: 'warn',
      msg:
        'Capacity utilization is ' +
        Math.round(util * 100) +
        '%, under 70%. Staffed capacity exceeds the backlog. Bid to demand, or treat the gap as deliberate buffer/margin.',
    });
  if (util > 1.05)
    flags.push({
      sev: 'bad',
      msg: 'Capacity utilization is ' + Math.round(util * 100) + '%, over 105%. The backlog exceeds staffed capacity.',
    });
  if (resPct > 0 && resPct < 0.03)
    flags.push({
      sev: 'warn',
      msg: 'Effective reserve is ' + (resPct * 100).toFixed(1) + '%, thin for a fixed-price agile bid.',
    });
  if (total > ceiling && ceiling > 0)
    flags.push({
      sev: 'bad',
      msg: 'Total price exceeds the budget ceiling by $' + Math.round(total - ceiling).toLocaleString('en-US') + '.',
    });
  if (odcDropped > 0)
    flags.push({
      sev: 'warn',
      msg:
        '$' +
        Math.round(odcDropped).toLocaleString('en-US') +
        ' of entered ODC sits beyond the program year count and is not counted. Extend the period of performance or remove those year columns.',
    });
  if (minMsPrice < 0)
    flags.push({ sev: 'bad', msg: 'A milestone price is negative. Review the rounding plug mode or milestone cost inputs.' });
  if (!s.velocity.samples || s.velocity.samples.length < 2)
    flags.push({
      sev: 'warn',
      msg: 'Velocity has fewer than two historical samples. The estimate rests on a single-point velocity with no basis behind it.',
    });
  const noBasis = (s.rates || []).filter((r) => !r.rateBasis).length;
  if (noBasis > 0)
    flags.push({
      sev: 'warn',
      msg:
        noBasis +
        ' labor rate' +
        (noBasis > 1 ? 's have' : ' has') +
        ' no documented basis (actual vs survey). Tag each rate so the build is defensible.',
    });
  for (const t of tierRows) {
    if (t.fte > 0) {
      const pf = t.perFtePriced;
      if (pf < 150000)
        flags.push({
          sev: 'warn',
          msg: 'Tier "' + t.name + '" prices at $' + Math.round(pf).toLocaleString('en-US') + '/FTE/yr, below a typical band.',
        });
      else if (pf > 400000)
        flags.push({
          sev: 'warn',
          msg: 'Tier "' + t.name + '" prices at $' + Math.round(pf).toLocaleString('en-US') + '/FTE/yr, above a typical band.',
        });
    }
  }

  // Integrity checks: reconciliations that must hold for the price to be trustworthy
  const round0 = (v: number) => Math.round(v);
  const backlogMs = [...new Set(s.backlog.map((b) => b.milestone))];
  const unmatched = backlogMs.filter((m) => !s.milestones.some((x) => x.name === m)).length;
  const rowLaborP50 = rows.reduce((a, r) => a + r.lp50, 0);
  const checks: IntegrityCheck[] = [
    {
      n: 1,
      label: 'Milestone prices tie to Total Price',
      val: round0(msPriceTotal - total),
      ok: Math.abs(round0(msPriceTotal - total)) <= 1,
    },
    {
      n: 2,
      label: 'Phase split ties to Total Price',
      val: round0(phase1Price + phase2Price - total),
      ok: Math.abs(round0(phase1Price + phase2Price - total)) <= 1,
    },
    {
      n: 3,
      label: 'BOE total ties to Total Price',
      val: round0(boeTotalPrice - total),
      ok: Math.abs(round0(boeTotalPrice - total)) <= 1,
    },
    {
      n: 4,
      label: 'Capability labor = backlog row labor (P50)',
      val: round0(capSubP50 - rowLaborP50),
      ok: Math.abs(round0(capSubP50 - rowLaborP50)) <= 1,
    },
    {
      n: 5,
      label: 'Teaming prime + subs = Total Price',
      val: round0(prime + subsSubtotal - total),
      ok: Math.abs(round0(prime + subsSubtotal - total)) <= 1,
    },
    { n: 6, label: 'Every backlog milestone exists in Milestones', val: unmatched, ok: unmatched === 0 },
    {
      n: 7,
      label: 'Backlog labor mapped fully to milestones',
      val: round0(
        Object.values(laborCol).reduce((a, b) => a + b, 0) - (conf === 'P80' ? capSubP80 : capSubP50),
      ),
      ok:
        Math.abs(
          round0(Object.values(laborCol).reduce((a, b) => a + b, 0) - (conf === 'P80' ? capSubP80 : capSubP50)),
        ) <= 1,
    },
    {
      n: 8,
      label: 'Teaming shares + prime sum to 100%',
      val: +(primeShare + teaming.reduce((a, t) => a + t.share, 0)).toFixed(4),
      ok: Math.abs(primeShare + teaming.reduce((a, t) => a + t.share, 0) - 1) <= 0.001,
    },
    { n: 9, label: 'No negative milestone price (plug sane)', val: round0(minMsPrice), ok: minMsPrice >= 0 },
    {
      n: 10,
      label: 'Velocity inputs > 0',
      val: s.archetypes.length ? Math.min(...s.archetypes.map((a) => num(a.velocity))) : 0,
      ok: s.archetypes.length > 0 && s.archetypes.every((a) => num(a.velocity) > 0),
    },
    { n: 11, label: 'Reserve % between 0 and 100%', val: +resPct.toFixed(4), ok: resPct >= 0 && resPct < 1 },
    {
      n: 12,
      label: 'Capacity tiers priced where teams are staffed',
      val: tierRows.filter((t) => t.teamCount > 0 && !(t.pricePeriod > 0)).length,
      ok: tierRows.every((t) => t.teamCount === 0 || t.pricePeriod > 0),
    },
    {
      n: 13,
      label: 'Subscription reserve % between 0 and 100%',
      val: +subRes.toFixed(4),
      ok: subRes >= 0 && subRes < 1,
    },
  ];
  const allOk = checks.every((c) => c.ok);

  return {
    loaded,
    archMap,
    totalTeams,
    wsPoP,
    totalCapacity,
    blendedCps,
    cov,
    rows,
    capLaborP50,
    capLaborP80,
    capSubP50,
    capSubP80,
    loeRows,
    loeTot,
    loeP1,
    loeP2,
    psRows,
    psTot,
    psP1,
    psP2,
    includePS,
    odcRows,
    odcTot,
    odcP1,
    odcP2,
    yearsN,
    fixedTot,
    fixedRaw,
    fixedBurden,
    costP50,
    costP80,
    base,
    spread,
    resPct,
    resD,
    fee,
    subtotal,
    total,
    grossup,
    util,
    capFlag,
    sumSprP50,
    sumSprP80,
    demand,
    ceiling,
    budgetVar,
    budgetStatus,
    teaming,
    subsSubtotal,
    prime,
    primeShare,
    msRows,
    phase1Price,
    phase2Price,
    msPriceTotal,
    boeCaps,
    boeExtra,
    boeTotalPrice,
    checks,
    allOk,
    progMonths,
    capacity: capacityOut,
    odcPhasing,
    odcDropped,
    plugMode,
    funding,
    flags,
    automationCurve: autoCurve,
  };
}
