import { colorForMoney, StackedBars, Waterfall } from '../components/charts';
import { Callout, Card, Note, Pill, Section, Stat, utilTone } from '../components/ui';
import { exportFundingCsv } from '../export/csv';
import { money0, pct } from '../lib/format';
import { useActivePursuit, useStore } from '../state/store';
import { useResult } from '../state/useResult';

function FlagsBanner() {
  const r = useResult();
  if (!r.flags.length) {
    return (
      <Callout color="var(--refraction)">
        <b>No advisories.</b> Inputs are within expected bands.
      </Callout>
    );
  }
  return (
    <div className="card" style={{ borderLeft: '4px solid var(--supernova)' }}>
      <div className="cb" style={{ padding: '12px 16px' }}>
        {r.flags.map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '4px 0' }}>
            <Pill tone={f.sev === 'bad' ? 'bad' : 'warn'}>{f.sev === 'bad' ? 'CHECK' : 'NOTE'}</Pill>
            <span style={{ fontSize: 13 }}>{f.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function fundingChart(r: ReturnType<typeof useResult>) {
  return (
    <StackedBars
      rows={r.funding.rows.map((row) => ({ label: 'FY' + String(row.fy).slice(2), values: row.byColor }))}
      keys={r.funding.colors}
      colors={r.funding.colors.map((c, i) => colorForMoney(c, i))}
    />
  );
}

export function Dashboard() {
  const s = useActivePursuit();
  const r = useResult();
  const ptw = r.total - r.subtotal;
  const cfMax = Math.max(...r.msRows.map((m) => m.price), 1);

  return (
    <Section
      title="Dashboard"
      sub="One-screen read of the bid: price build, milestone cash flow, capacity posture, funding by year, and any advisories."
      actions={
        <button type="button" className="tbtn solid" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      }
    >
      <FlagsBanner />
      <div className="resgrid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <Stat hero k={`Total Price (${s.control.confidence})`} v={money0(r.total)} sub={`Gross-up ${r.grossup.toFixed(3)}×`} />
        <Stat
          k="Phase 1 / Phase 2"
          vStyle={{ fontSize: 15 }}
          v={
            <>
              {money0(r.phase1Price)}
              <br />
              <small>{money0(r.phase2Price)}</small>
            </>
          }
        />
        <Stat
          k="Reserve / Fee"
          vStyle={{ fontSize: 15 }}
          v={
            <>
              {pct(r.resPct)}
              <br />
              <small>{pct(s.control.fee)} fee</small>
            </>
          }
        />
        <Stat
          k="Utilization"
          v={
            <>
              {pct(r.util)} <Pill tone={utilTone(r.util)}>{r.util < 0.7 ? 'Under' : r.util > 1.05 ? 'Over' : 'OK'}</Pill>
            </>
          }
        />
      </div>
      <div style={{ marginTop: 18 }}>
        <Card title="Cost-to-Price Waterfall">
          <Waterfall
            steps={[
              { label: 'Base cost', delta: r.base },
              { label: 'Reserve', delta: r.resD },
              { label: 'Fee', delta: r.fee },
              { label: 'PTW', delta: ptw },
              { label: 'Total', delta: 0, total: true },
            ]}
          />
        </Card>
      </div>
      <Card title="Milestone Cash Flow">
        {r.msRows.length === 0 && <div className="sub">No milestones.</div>}
        {r.msRows.map((m) => (
          <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '3px 0' }}>
            <div style={{ width: 150, fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
              {m.name.length > 11 ? m.name.slice(0, 10) + '…' : m.name}
            </div>
            <div style={{ flex: 1, background: '#eef', borderRadius: 4 }}>
              <div
                style={{ width: `${((m.price / cfMax) * 100).toFixed(1)}%`, background: 'var(--force)', height: 14, borderRadius: 4 }}
              />
            </div>
            <div className="mono" style={{ width: 110, fontSize: 11, textAlign: 'right' }}>
              {money0(m.price)}
            </div>
          </div>
        ))}
      </Card>
      <Card title="Funding by Fiscal Year (color of money)">
        {r.funding.rows.length ? fundingChart(r) : <div className="sub">No milestone payments to schedule.</div>}
      </Card>
    </Section>
  );
}

export function Funding() {
  const s = useActivePursuit();
  const r = useResult();
  const update = useStore((st) => st.updateActive);
  const f = r.funding;

  const colSel = (label: string, key: 'colorPhase1' | 'colorPhase2') => (
    <div className="field">
      <label>{label}</label>
      <select
        value={s.control[key]}
        onChange={(e) =>
          update((p) => {
            p.control[key] = e.target.value as typeof p.control.colorPhase1;
          })
        }
      >
        {['RDT&E', 'O&M', 'Procurement', 'Mixed'].map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <Section
      title="Funding & Color of Money"
      sub="Milestone payments mapped to the federal fiscal year of completion (Oct–Sep) and tagged by appropriation. Each option year is its own funding action; appropriation types generally cannot be commingled. Planning support, not an obligation schedule."
    >
      <Card title="Appropriation Tagging">
        <div className="cgrid">
          {colSel('Phase 1 color of money', 'colorPhase1')}
          {colSel('Phase 2 color of money', 'colorPhase2')}
        </div>
        <Note style={{ marginTop: 10, marginBottom: 0 }}>
          Tag drives the funding split below and the dashboard chart. Set it to fiscal reality (a sustainment phase may be
          O&M, a modernization phase RDT&E).
        </Note>
      </Card>
      <div className="card flush">
        <div className="ch">
          <h3>Funding by Fiscal Year</h3>
          <button type="button" className="tbtn solid" onClick={() => exportFundingCsv(s, r)}>
            Export CSV
          </button>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Fiscal Year</th>
                {f.colors.map((c) => (
                  <th key={c} className="num">
                    {c}
                  </th>
                ))}
                <th className="num">FY Total</th>
                <th className="num">Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {f.rows.length === 0 && (
                <tr>
                  <td colSpan={3 + f.colors.length} className="sub">
                    No milestone payments.
                  </td>
                </tr>
              )}
              {f.rows.map((row) => (
                <tr key={row.fy}>
                  <td>
                    <b>FY{row.fy}</b>
                  </td>
                  {f.colors.map((c) => (
                    <td key={c} className="num calc">
                      {money0(row.byColor[c] || 0)}
                    </td>
                  ))}
                  <td className="num calc">
                    <b>{money0(row.total)}</b>
                  </td>
                  <td className="num calc dim">{money0(row.cumulative)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>TOTAL</td>
                {f.colors.map((c) => (
                  <td key={c} className="num">
                    {money0(f.rows.reduce((a, row) => a + (row.byColor[c] || 0), 0))}
                  </td>
                ))}
                <td className="num">{money0(r.total)}</td>
                <td className="num" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <Card title="Funding Profile">
        {f.rows.length ? fundingChart(r) : <div className="sub">Nothing to chart.</div>}
      </Card>
    </Section>
  );
}
