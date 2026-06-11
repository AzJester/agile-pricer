import type { ComputeResult, Pursuit } from '../engine';
import { addMonths, fileSafe } from '../lib/format';
import { downloadBlob } from './download';

const MONEY = '#,##0.00';
const PCT = '0.00%';

/**
 * Multi-sheet pricing workbook with live formulas: the rate build, PERT
 * sizing, sprint conversion, and the cost-to-price stack recalculate in
 * Excel and reference the Inputs sheet, so a reviewer can trace and flex
 * the math. Milestone allocation (pro-rata + rounding plug) stays as values
 * with the app as the system of record. exceljs is bundled and loaded on
 * demand, so the export works offline.
 */
export async function exportExcel(s: Pursuit, r: ComputeResult) {
  const { Workbook } = await import('exceljs');
  const c = s.control;
  const wb = new Workbook();
  wb.creator = 'Astrion Agile Pricing Studio';
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;
  const isP80 = c.confidence === 'P80';

  /* ---- Inputs: every formula references these cells ---- */
  const inputs = wb.addWorksheet('Inputs');
  inputs.columns = [{ width: 34 }, { width: 14 }, { width: 50 }];
  const inputRows: [string, number | string, string?, string?][] = [
    ['Input', 'Value', '', 'Note'],
    ['Fringe', c.fringe, PCT, 'of direct'], // B2
    ['Overhead', c.overhead, PCT, 'of direct + fringe'], // B3
    ['G&A', c.gna, PCT, 'of direct + fringe + OH'], // B4
    ['Productive hrs / sprint / FTE', c.productiveHrs, undefined, ''], // B5
    ['Fee', c.fee, PCT, 'on cost + reserve'], // B6
    ['Escalation / yr (default)', c.escalation, PCT, 'per-year overrides apply in-app'], // B7
    ['Capacity reserve', s.velocity.capacityReserve, PCT, 'defects/refactor share of velocity'], // B8
    ['Ramp factor (PI1)', s.velocity.rampFactor, undefined, 'first-year velocity multiplier'], // B9
    ['G&A on ODC', c.gnaODC, PCT, 'material handling'], // B10
    ['P80 z-score', 0.84, undefined, 'effective points add z × SD at P80'], // B11
    ['Effective reserve %', r.resPct, PCT, c.reserveMethod + ' method (computed by app)'], // B12
    ['PTW adjustment', c.ptw, PCT, ''], // B13
    ['Confidence', c.confidence, undefined, 'quoted price basis'], // B14
  ];
  for (const [label, value, fmt, note] of inputRows) {
    const row = inputs.addRow([label, value, '', note ?? '']);
    if (fmt) row.getCell(2).numFmt = fmt;
  }
  inputs.getRow(1).font = { bold: true };

  /* ---- Rates: loaded rate is a live formula ---- */
  const rates = wb.addWorksheet('Rates');
  rates.addRow(['LCAT', 'Direct $/hr (Yr1)', 'Rate Basis', 'Skill', 'Source', 'Loaded Yr1 $/hr']).font = { bold: true };
  s.rates.forEach((rt, i) => {
    const n = i + 2;
    const row = rates.addRow([rt.lcat, rt.direct, rt.rateBasis || '', rt.skill || '', rt.source || '', '']);
    row.getCell(6).value = { formula: `B${n}*(1+Inputs!$B$2)*(1+Inputs!$B$3)*(1+Inputs!$B$4)` };
    row.getCell(2).numFmt = MONEY;
    row.getCell(6).numFmt = MONEY;
  });
  rates.columns = [{ width: 28 }, { width: 16 }, { width: 12 }, { width: 12 }, { width: 24 }, { width: 16 }];

  /* ---- Backlog: PERT -> effective points -> sprints -> labor, all formulas ---- */
  const bl = wb.addWorksheet('Backlog');
  bl.addRow([
    'Capability',
    'Epic',
    'PI',
    'PI Yr',
    'Milestone',
    'Archetype',
    'Velocity',
    'AI/Auto ×',
    'CPS escalated $/team-sprint',
    'Low',
    'Likely',
    'High',
    'Expected (PERT)',
    'SD',
    `Eff Pts (${c.confidence})`,
    'Sprints',
    'Labor $',
  ]).font = { bold: true };
  s.backlog.forEach((b, i) => {
    const n = i + 2;
    const der = r.rows[i];
    const cpsEsc = der && der.sp50 > 0 ? der.lp50 / der.sp50 : 0;
    const row = bl.addRow([
      b.capability,
      b.epic,
      b.pi,
      b.piYear,
      b.milestone,
      b.archetype,
      r.archMap[b.archetype]?.vel ?? 0,
      der?.autoF ?? 1,
      cpsEsc,
      b.low,
      b.likely,
      b.high,
      '',
      '',
      '',
      '',
      '',
    ]);
    row.getCell(13).value = { formula: `(J${n}+4*K${n}+L${n})/6` };
    row.getCell(14).value = { formula: `(L${n}-J${n})/6` };
    row.getCell(15).value = {
      formula: isP80 ? `(M${n}+Inputs!$B$11*N${n})/(1-Inputs!$B$8)` : `M${n}/(1-Inputs!$B$8)`,
    };
    row.getCell(16).value = { formula: `IF(G${n}=0,0,O${n}/(G${n}*IF(D${n}=1,Inputs!$B$9,1)*H${n}))` };
    row.getCell(17).value = { formula: `P${n}*I${n}` };
    row.getCell(9).numFmt = MONEY;
    row.getCell(17).numFmt = MONEY;
  });
  const lastBl = s.backlog.length + 1;
  const blTotal = bl.addRow(['TOTAL']);
  blTotal.font = { bold: true };
  blTotal.getCell(16).value = { formula: `SUM(P2:P${lastBl})` };
  blTotal.getCell(17).value = { formula: `SUM(Q2:Q${lastBl})` };
  blTotal.getCell(17).numFmt = MONEY;
  bl.getColumn(1).width = 30;
  bl.getColumn(2).width = 28;
  bl.getColumn(5).width = 24;
  bl.getColumn(9).width = 22;
  const blTotalRow = lastBl + 1;

  /* ---- Summary: the cost-to-price stack as formulas ---- */
  const summary = wb.addWorksheet('Summary', { views: [{ state: 'frozen', ySplit: 2 }] });
  summary.columns = [{ width: 38 }, { width: 20 }, { width: 56 }];
  summary.addRow(['Astrion Agile Pricing — ' + s.name]).font = { bold: true, size: 14 };
  summary.addRow([]);
  const add = (label: string, value: number | string | { formula: string }, fmt?: string, note?: string) => {
    const row = summary.addRow([label, '', note ?? '']);
    row.getCell(2).value = value as never;
    if (fmt) row.getCell(2).numFmt = fmt;
    return row.number;
  };
  const rowLabor = add(
    `Delivery labor (${c.confidence})`,
    { formula: `Backlog!Q${blTotalRow}` },
    MONEY,
    'live: Σ backlog labor formulas',
  );
  add('Persistent LOE', r.loeTot, MONEY, 'computed by app (FTE × loaded × 173.2 × months)');
  add('Program support', r.psTot, MONEY, r.includePS ? 'included' : 'excluded from price');
  add('ODC (escalated + handling)', r.odcTot, MONEY, 'computed by app');
  const rowFixed = add('Fixed (milestones + burden)', r.fixedTot, MONEY, 'computed by app');
  const rowBase = add(
    'Base cost',
    { formula: `SUM(B${rowLabor}:B${rowFixed})` },
    MONEY,
    'fee applies after reserve on this base',
  );
  const rowRes = add('Reserve', { formula: `B${rowBase}*Inputs!$B$12` }, MONEY, 'base × effective reserve %');
  const rowFee = add('Fee', { formula: `(B${rowBase}+B${rowRes})*Inputs!$B$6` }, MONEY, '(base + reserve) × fee');
  const rowSub = add('Subtotal', { formula: `B${rowBase}+B${rowRes}+B${rowFee}` }, MONEY);
  const rowTotal = add('TOTAL PRICE', { formula: `B${rowSub}*(1+Inputs!$B$13)` }, MONEY, 'subtotal × (1 + PTW)');
  summary.getRow(rowTotal).font = { bold: true };
  add('App-computed total (cross-check)', r.total, MONEY, 'should equal the formula above');
  summary.addRow([]);
  add('Gross-up', r.grossup, '0.000000');
  for (const p of r.periods) {
    add(`${p.label} (ALIN ${String(p.index).padStart(3, '0')})`, p.price, MONEY, `${p.months} months · ${p.color}`);
  }
  add('Utilization', r.util, PCT);
  add('Budget ceiling', r.ceiling, MONEY, r.budgetStatus);

  const addTable = (name: string, head: string[], rows: (string | number)[][], moneyCols: number[] = []) => {
    const ws = wb.addWorksheet(name);
    ws.addRow(head).font = { bold: true };
    for (const row of rows) {
      const added = ws.addRow(row);
      for (const ci of moneyCols) added.getCell(ci).numFmt = MONEY;
    }
    ws.columns.forEach((col, i) => {
      col.width = Math.max(12, head[i] ? head[i].length + 4 : 12);
    });
    return ws;
  };

  addTable(
    'Milestones',
    ['ALIN', 'Milestone', 'Period', 'Est. Completion', 'Cost', 'Payable Price', 'Prime Share', ...s.teaming.map((t) => t.party)],
    r.msRows.map((m) => [
      'ALIN ' + String(m.phase).padStart(3, '0'),
      m.name,
      m.phase,
      addMonths(c.popStart, m.monthOffset),
      m.cost,
      m.price,
      m.primeShare,
      ...m.subShares,
    ]),
    [5, 6, 7, ...s.teaming.map((_, i) => 8 + i)],
  );

  addTable(
    'BOE',
    ['Element', 'Epics', 'Exp Pts', 'SD', 'Eff Pts', 'Sprints', 'Labor', 'Total Cost', 'Price'],
    [
      ...r.boeCaps.map((b) => [b.element, b.epics, b.exp, b.sd, b.effPts, b.sprints, b.labor, b.totalCost, b.price]),
      ...r.boeExtra.map((b) => [b.element, '', '', '', '', '', b.totalCost, b.totalCost, b.price]),
    ],
    [7, 8, 9],
  );

  addTable(
    'Funding',
    ['Fiscal Year', ...r.funding.colors, 'FY Total', 'Cumulative'],
    r.funding.rows.map((row) => [
      'FY' + row.fy,
      ...r.funding.colors.map((col) => row.byColor[col] || 0),
      row.total,
      row.cumulative,
    ]),
    [...r.funding.colors.map((_, i) => 2 + i), 2 + r.funding.colors.length, 3 + r.funding.colors.length],
  );

  addTable(
    'Capacity Tiers',
    ['Tier', 'Color', 'Teams', 'FTE', 'Cost/Period', 'Price/Period', 'Annual Run-Rate', '$/FTE/yr', 'Term'],
    r.capacity.tiers.map((t) => [
      t.name,
      t.color,
      t.teamCount,
      t.fte,
      t.costPeriod,
      t.pricePeriod,
      t.annualRunRate,
      t.perFtePriced,
      t.termPrice,
    ]),
    [5, 6, 7, 8, 9],
  );

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    fileSafe(s.name) + '_Pricing.xlsx',
  );
}
