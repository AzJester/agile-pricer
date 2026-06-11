import type { ComputeResult, Pursuit } from '../engine';
import { addMonths, fileSafe } from '../lib/format';
import { csvRows, downloadText } from './download';

export function exportMpsCsv(s: Pursuit, r: ComputeResult) {
  const head = ['ALIN', 'Milestone', 'Estimated Completion', 'Payable Amount', 'Prime Share', ...s.teaming.map((t) => t.party)];
  const rows = r.msRows.map((m) => [
    'ALIN ' + String(m.phase).padStart(3, '0'),
    m.name,
    addMonths(s.control.popStart, m.monthOffset),
    m.price.toFixed(2),
    m.primeShare.toFixed(2),
    ...m.subShares.map((x) => x.toFixed(2)),
  ]);
  downloadText(csvRows([head, ...rows]), 'text/csv', fileSafe(s.name) + '_MPS.csv');
}

export function exportTiersCsv(s: Pursuit, r: ComputeResult) {
  const head = [
    'Tier',
    'Color of Money',
    'Teams',
    'Monthly ODC',
    'Cost per Period',
    'Recurring Price per Period',
    'Annual Run-Rate',
    `Term (${r.capacity.optionYears} yr)`,
  ];
  const rows = r.capacity.tiers.map((t) => [
    t.name,
    t.color,
    t.teamCount,
    t.monthlyODC.toFixed(2),
    t.costPeriod.toFixed(2),
    t.pricePeriod.toFixed(2),
    t.annualRunRate.toFixed(2),
    t.termPrice.toFixed(2),
  ]);
  downloadText(csvRows([head, ...rows]), 'text/csv', fileSafe(s.name) + '_Tiers.csv');
}

export function exportFundingCsv(s: Pursuit, r: ComputeResult) {
  const f = r.funding;
  const head = ['Fiscal Year', ...f.colors, 'FY Total', 'Cumulative'];
  const rows = f.rows.map((row) => [
    'FY' + row.fy,
    ...f.colors.map((c) => (row.byColor[c] || 0).toFixed(2)),
    row.total.toFixed(2),
    row.cumulative.toFixed(2),
  ]);
  downloadText(csvRows([head, ...rows]), 'text/csv', fileSafe(s.name) + '_Funding.csv');
}
