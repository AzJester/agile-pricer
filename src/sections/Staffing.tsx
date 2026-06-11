import { useMemo, useState } from 'react';
import { StackedBars } from '../components/charts';
import { Toggle } from '../components/inputs';
import { Card, Note, Section, Stat, TipBox } from '../components/ui';
import { monthlyPhasing } from '../engine';
import { csvRows, downloadText } from '../export/download';
import { addMonths, fileSafe, money0 } from '../lib/format';
import { useActivePursuit } from '../state/store';
import { useResult } from '../state/useResult';

const CAT_KEYS = ['Delivery labor', 'LOE', 'Program support', 'ODC', 'Fixed'];
const CAT_COLORS = ['#442C81', '#29AAE1', '#9382F9', '#1ED872', '#FFAF2E'];

export function Staffing() {
  const s = useActivePursuit();
  const r = useResult();
  const [atPrice, setAtPrice] = useState(false);
  const phased = useMemo(() => monthlyPhasing(s, r), [s, r]);
  const mult = atPrice ? phased.grossup : 1;

  // Quarterly buckets keep the chart readable on multi-year programs.
  const quarters = useMemo(() => {
    const out: { label: string; values: Record<string, number>; fte: number }[] = [];
    for (let q = 0; q * 3 < phased.months.length; q++) {
      const slice = phased.months.slice(q * 3, q * 3 + 3);
      out.push({
        label: 'Q' + (q + 1),
        values: {
          'Delivery labor': slice.reduce((a, m) => a + m.labor, 0) * mult,
          LOE: slice.reduce((a, m) => a + m.loe, 0) * mult,
          'Program support': slice.reduce((a, m) => a + m.psupport, 0) * mult,
          ODC: slice.reduce((a, m) => a + m.odc, 0) * mult,
          Fixed: slice.reduce((a, m) => a + m.fixed, 0) * mult,
        },
        fte: slice.length ? slice.reduce((a, m) => a + m.totalFte, 0) / slice.length : 0,
      });
    }
    return out;
  }, [phased, mult]);

  const peakFte = Math.max(...phased.months.map((m) => m.totalFte), 0);
  const peakMonth = phased.months.find((m) => m.totalFte === peakFte);

  const exportCsv = () => {
    const head = ['Month', 'Date', 'Delivery Labor', 'LOE', 'Program Support', 'ODC', 'Fixed', 'Total', 'Cumulative', 'Delivery FTE', 'LOE/PS FTE', 'Total FTE'];
    const rows = phased.months.map((m) => [
      m.idx + 1,
      addMonths(s.control.popStart, m.idx),
      (m.labor * mult).toFixed(2),
      (m.loe * mult).toFixed(2),
      (m.psupport * mult).toFixed(2),
      (m.odc * mult).toFixed(2),
      (m.fixed * mult).toFixed(2),
      (m.total * mult).toFixed(2),
      (m.cumulative * mult).toFixed(2),
      m.backlogFte.toFixed(2),
      m.loeFte.toFixed(2),
      m.totalFte.toFixed(2),
    ]);
    downloadText(csvRows([head, ...rows]), 'text/csv', fileSafe(s.name) + '_Phasing.csv');
  };

  return (
    <Section
      title="Cost Phasing & Staffing"
      sub="The cost stack spread across calendar months: an expenditure curve for spend-plan defense and an FTE-by-month staffing plan recruiting can act on. Spreads preserve the engine totals exactly; toggle to price to apply the gross-up."
      actions={
        <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Toggle label={`Show at price (×${phased.grossup.toFixed(3)})`} checked={atPrice} onCommit={setAtPrice} />
          <button type="button" className="tbtn solid" onClick={exportCsv}>
            Export CSV
          </button>
        </span>
      }
    >
      <TipBox>
        The cost stack spread across calendar months plus the implied FTE plan — totals tie exactly to the engine. Use the FTE row for the staffing-plan volume; a sudden step usually means a PI-year boundary, not an error.
      </TipBox>
      <div className="resgrid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <Stat k={atPrice ? 'Total at price' : 'Total cost spread'} v={money0(phased.totals.total * mult)} />
        <Stat k="Months phased" v={String(phased.months.length)} />
        <Stat k="Peak staffing" v={peakFte.toFixed(1) + ' FTE'} sub={peakMonth ? addMonths(s.control.popStart, peakMonth.idx) : ''} />
        <Stat
          k="Avg monthly burn"
          v={money0((phased.totals.total * mult) / Math.max(1, phased.months.length))}
        />
      </div>
      <div style={{ marginTop: 18 }}>
        <Card title={'Expenditure by quarter' + (atPrice ? ' (price)' : ' (cost)')}>
          <StackedBars rows={quarters.map((q) => ({ label: q.label, values: q.values }))} keys={CAT_KEYS} colors={CAT_COLORS} />
        </Card>
      </div>
      <Card title="Staffing plan (average FTE by quarter)">
        {quarters.map((q, i) => {
          const max = Math.max(...quarters.map((x) => x.fte), 1);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '3px 0' }}>
              <div style={{ width: 50, fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>{q.label}</div>
              <div style={{ flex: 1, background: '#eef', borderRadius: 4 }}>
                <div style={{ width: `${((q.fte / max) * 100).toFixed(1)}%`, background: 'var(--sky)', height: 14, borderRadius: 4 }} />
              </div>
              <div className="mono" style={{ width: 90, fontSize: 11, textAlign: 'right' }}>
                {q.fte.toFixed(1)} FTE
              </div>
            </div>
          );
        })}
        <Note style={{ marginTop: 12, marginBottom: 0 }}>
          Delivery FTE derives from sprints needed per month (teams busy × team headcount); LOE and program-support FTE come
          from each line's staffing over its months. Use the CSV export for the month-level plan.
        </Note>
      </Card>
      <div className="card flush">
        <div className="ch">
          <h3>Monthly detail</h3>
          <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
            cumulative ties to {atPrice ? 'price' : 'cost'} {money0(phased.totals.total * mult)}
          </span>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th className="num">Mo.</th>
                <th>Date</th>
                <th className="num">Labor</th>
                <th className="num">LOE</th>
                <th className="num">Prog. Spt</th>
                <th className="num">ODC</th>
                <th className="num">Fixed</th>
                <th className="num">Total</th>
                <th className="num">Cumulative</th>
                <th className="num">FTE</th>
              </tr>
            </thead>
            <tbody>
              {phased.months.map((m) => (
                <tr key={m.idx}>
                  <td className="num calc dim">{m.idx + 1}</td>
                  <td className="calc dim">{addMonths(s.control.popStart, m.idx)}</td>
                  <td className="num calc">{money0(m.labor * mult)}</td>
                  <td className="num calc">{money0(m.loe * mult)}</td>
                  <td className="num calc">{money0(m.psupport * mult)}</td>
                  <td className="num calc">{money0(m.odc * mult)}</td>
                  <td className="num calc">{money0(m.fixed * mult)}</td>
                  <td className="num calc">
                    <b>{money0(m.total * mult)}</b>
                  </td>
                  <td className="num calc dim">{money0(m.cumulative * mult)}</td>
                  <td className="num calc">{m.totalFte.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}
