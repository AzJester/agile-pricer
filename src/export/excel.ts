import type { ComputeResult, Pursuit } from '../engine';
import { addMonths, fileSafe } from '../lib/format';
import { downloadBlob } from './download';

const MONEY = '#,##0.00';
const PCT = '0.00%';

/**
 * Multi-sheet pricing workbook. exceljs is bundled and loaded on demand,
 * so the export works offline (no CDN dependency).
 */
export async function exportExcel(s: Pursuit, r: ComputeResult) {
  const { Workbook } = await import('exceljs');
  const c = s.control;
  const wb = new Workbook();
  wb.creator = 'Astrion Agile Pricing Studio';
  wb.created = new Date();

  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 34 }, { width: 22 }];
  const sRows: [string, string | number, string?][] = [
    ['Astrion Agile Pricing — ' + s.name, ''],
    ['', ''],
    ['Confidence', c.confidence],
    ['Total Price', r.total, MONEY],
    ['Cost P50', r.costP50, MONEY],
    ['Cost P80', r.costP80, MONEY],
    ['Base cost', r.base, MONEY],
    ['Reserve %', r.resPct, PCT],
    ['Reserve $', r.resD, MONEY],
    ['Fee %', c.fee, PCT],
    ['Fee $', r.fee, MONEY],
    ['PTW', c.ptw, PCT],
    ['Gross-up', r.grossup, '0.000000'],
    ['Phase 1 price', r.phase1Price, MONEY],
    ['Phase 2 price', r.phase2Price, MONEY],
    ['Utilization', r.util, PCT],
    ['Budget ceiling', r.ceiling, MONEY],
    ['Budget status', r.budgetStatus],
    ['Wrap (loaded/direct)', (1 + c.fringe) * (1 + c.overhead) * (1 + c.gna), '0.0000'],
  ];
  for (const [label, value, fmt] of sRows) {
    const row = summary.addRow([label, value]);
    if (fmt) row.getCell(2).numFmt = fmt;
  }
  summary.getRow(1).font = { bold: true, size: 14 };

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
    'Rates',
    ['LCAT', 'Direct $/hr', 'Rate Basis', 'Skill', 'Source', 'Fringe', 'OH', 'G&A', 'Loaded Yr1 $/hr'],
    s.rates.map((rt) => [
      rt.lcat,
      rt.direct,
      rt.rateBasis || '',
      rt.skill || '',
      rt.source || '',
      c.fringe,
      c.overhead,
      c.gna,
      r.loaded[rt.lcat] || 0,
    ]),
    [2, 9],
  );

  addTable(
    'Milestones',
    ['ALIN', 'Milestone', 'Phase', 'Est. Completion', 'Cost', 'Payable Price', 'Prime Share', ...s.teaming.map((t) => t.party)],
    r.msRows.map((m) => [
      m.phase === 1 ? 'ALIN 001' : 'ALIN 002',
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

  addTable(
    'Backlog',
    ['Capability', 'Epic', 'PI', 'PI Yr', 'Milestone', 'Archetype', 'Low', 'Likely', 'High', 'Expected', 'SD'],
    s.backlog.map((b) => [
      b.capability,
      b.epic,
      b.pi,
      b.piYear,
      b.milestone,
      b.archetype,
      b.low,
      b.likely,
      b.high,
      (b.low + 4 * b.likely + b.high) / 6,
      (b.high - b.low) / 6,
    ]),
  );

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    fileSafe(s.name) + '_Pricing.xlsx',
  );
}
