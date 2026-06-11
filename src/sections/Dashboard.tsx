import { useMemo } from 'react';
import { AreaLine, colorForMoney, StackedBars, Waterfall } from '../components/charts';
import { Callout, Card, Note, Pill, Section, Stat, utilTone, TipBox } from '../components/ui';
import { monthlyPhasing } from '../engine';
import { exportFundingCsv } from '../export/csv';
import { addMonths, fmt0, money0, pct } from '../lib/format';
import { useActivePursuit, useStore } from '../state/store';
import { useResult } from '../state/useResult';

/** Hash navigation for dashboard drill-through (picked up by useHashRoute). */
function go(id: string) {
  window.location.hash = '#/' + id;
  window.scrollTo(0, 0);
}

/** Wraps a read-only widget so it drills through to the tab that owns it. */
function Jump(props: { to: string; title: string; children: React.ReactNode }) {
  return (
    <div
      role="link"
      tabIndex={0}
      title={props.title}
      style={{ cursor: 'pointer' }}
      onClick={() => go(props.to)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go(props.to);
        }
      }}
    >
      {props.children}
    </div>
  );
}

/** Route an advisory to the screen that fixes it, keyed off its wording. */
function advisoryTarget(msg: string): { tab: string; label: string } {
  const rules: [RegExp, string, string][] = [
    [/capacity reserve/i, 'velocity', 'Velocity & Reserve'],
    [/utilization/i, 'phasing', 'Time-Phasing'],
    [/effective reserve/i, 'velocity', 'Velocity & Reserve'],
    [/budget ceiling/i, 'overview', 'Overview'],
    [/ODC/, 'odc', 'Other Direct Costs'],
    [/milestone price/i, 'milestones', 'Milestones'],
    [/velocity has fewer|historical sample/i, 'velocity', 'Velocity & Reserve'],
    [/rate.*basis|documented basis/i, 'rates', 'Labor Rates'],
    [/tier/i, 'capacity', 'Capacity Tiers'],
  ];
  for (const [re, tab, label] of rules) if (re.test(msg)) return { tab, label };
  return { tab: 'checks', label: 'Integrity Checks' };
}

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
      <div className="cb" style={{ padding: '8px 12px' }}>
        {r.flags.map((f, i) => {
          const target = advisoryTarget(f.msg);
          return (
            <button
              key={i}
              type="button"
              className="dashrow"
              style={{ alignItems: 'flex-start' }}
              title={`Open ${target.label} to address this`}
              onClick={() => go(target.tab)}
            >
              <Pill tone={f.sev === 'bad' ? 'bad' : 'warn'}>{f.sev === 'bad' ? 'CHECK' : 'NOTE'}</Pill>
              <span style={{ fontSize: 13, flex: 1, textAlign: 'left' }}>{f.msg}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{target.label} →</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function fundingChart(r: ReturnType<typeof useResult>, onBarClick?: () => void) {
  return (
    <StackedBars
      rows={r.funding.rows.map((row) => ({ label: 'FY' + String(row.fy).slice(2), values: row.byColor }))}
      keys={r.funding.colors}
      colors={r.funding.colors.map((c, i) => colorForMoney(c, i))}
      onBarClick={onBarClick}
    />
  );
}

export function Dashboard() {
  const s = useActivePursuit();
  const r = useResult();
  const ptw = r.total - r.subtotal;
  const cfMax = Math.max(...r.msRows.map((m) => m.price), 1);
  // One gutter width for all cash-flow labels (ch ≈ one character at 11px),
  // capped so very long names wrap to a second line rather than truncate.
  const cfLabelCh = Math.min(Math.max(...r.msRows.map((m) => m.name.length), 10) + 1, 34);
  const fails = r.checks.filter((c) => !c.ok).length;
  // Cumulative expenditure curve from the monthly phasing engine.
  const spendCurve = useMemo(() => monthlyPhasing(s, r).months.map((m) => m.cumulative), [s, r]);
  const topDrivers = useMemo(() => [...r.boeCaps].sort((a, b) => b.price - a.price).slice(0, 4), [r]);
  const topMax = Math.max(...topDrivers.map((b) => b.price), 1);

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
      <TipBox>
        The pre-review health check: KPIs, advisories, and reconciliation in one place — and every widget drills through:
        click a KPI, a waterfall bar, a milestone row, or an FY bar to open the tab that owns it. Hover anything for the
        exact figure. Chase anything amber or red back to its source tab — the advisory text names it.
      </TipBox>
      <FlagsBanner />
      <div className="resgrid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Jump to="results" title="Open Pricing Results">
          <Stat hero k={`Total Price (${s.control.confidence})`} v={money0(r.total)} sub={`Gross-up ${r.grossup.toFixed(3)}×`} />
        </Jump>
        <Jump to="mps" title="Open the Milestone Payment Schedule">
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
        </Jump>
        <Jump to="results" title="Open Pricing Results">
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
        </Jump>
        <Jump to="phasing" title="Open Demand vs Funded Capacity">
          <Stat
            k="Utilization"
            v={
              <>
                {pct(r.util)} <Pill tone={utilTone(r.util)}>{r.util < 0.7 ? 'Under' : r.util > 1.05 ? 'Over' : 'OK'}</Pill>
              </>
            }
          />
        </Jump>
        <Jump to="checks" title="Open Integrity Checks">
          <Stat
            k="Integrity"
            v={<Pill tone={r.allOk ? 'ok' : 'bad'}>{r.allOk ? 'ALL OK' : `${fails} FAIL`}</Pill>}
            sub={r.flags.length ? `${r.flags.length} advisor${r.flags.length > 1 ? 'ies' : 'y'}` : 'no advisories'}
          />
        </Jump>
      </div>
      <div className="dashgrid" style={{ marginTop: 18 }}>
        <Card title="Cost-to-Price Waterfall">
          <Waterfall
            onStepClick={() => go('results')}
            steps={[
              { label: 'Base cost', delta: r.base },
              { label: 'Reserve', delta: r.resD },
              { label: 'Fee', delta: r.fee },
              { label: 'PTW', delta: ptw },
              { label: 'Total', delta: 0, total: true },
            ]}
          />
        </Card>
        <Card title="Funding by Fiscal Year (color of money)">
          {r.funding.rows.length ? fundingChart(r, () => go('funding')) : <div className="sub">No milestone payments to schedule.</div>}
        </Card>
        <Card title="Cumulative Expenditure (cost basis)">
          <Jump to="staffing" title="Open Cost Phasing & Staffing">
            <AreaLine values={spendCurve} label="Cumulative expenditure by month" />
          </Jump>
        </Card>
        <Card title="Demand vs Funded Capacity by Year">
          {r.demand.byYear.map((yr) => (
            <button
              key={yr.year}
              type="button"
              className="dashrow"
              title={`Year ${yr.year}: ${fmt0(yr.needed)} sprints needed of ${fmt0(yr.funded)} funded (${pct(yr.util)}) · click for time-phasing`}
              onClick={() => go('phasing')}
            >
              <span style={{ width: '8ch', fontSize: 11, color: 'var(--muted)', textAlign: 'right', flexShrink: 0 }}>
                Yr {yr.year}
              </span>
              <span className="dashbar">
                <i
                  style={{
                    width: `${Math.min(100, (yr.funded ? yr.needed / yr.funded : 0) * 100).toFixed(1)}%`,
                    background: yr.util > 1.05 ? 'var(--twilight)' : undefined,
                  }}
                />
              </span>
              <span className="mono" style={{ width: 130, fontSize: 11, textAlign: 'right', flexShrink: 0 }}>
                {fmt0(yr.needed)} / {fmt0(yr.funded)} spr · {pct(yr.util, 0)}
              </span>
            </button>
          ))}
          <Note style={{ marginTop: 8, marginBottom: 0 }}>Sprints needed vs funded; red means over-subscribed.</Note>
        </Card>
        <Card title="Milestone Cash Flow">
        {r.msRows.length === 0 && <div className="sub">No milestones.</div>}
        {r.msRows.map((m, idx) => (
          <button
            key={idx + '::' + m.name}
            type="button"
            className="dashrow"
            onClick={() => go('mps')}
            title={`${m.name} — ${money0(m.price)} (${pct(r.total ? m.price / r.total : 0)} of total) · est. ${addMonths(s.control.popStart, m.monthOffset)} · click to open the payment schedule`}
          >
            {/* Uniform label gutter sized to the longest name; long names wrap
                instead of truncating. */}
            <span
              style={{
                width: `${cfLabelCh}ch`,
                fontSize: 11,
                color: 'var(--muted)',
                textAlign: 'right',
                whiteSpace: 'normal',
                lineHeight: 1.25,
                flexShrink: 0,
              }}
            >
              {m.name}
            </span>
            <span className="dashbar">
              <i style={{ width: `${((m.price / cfMax) * 100).toFixed(1)}%` }} />
            </span>
            <span className="mono" style={{ width: 110, fontSize: 11, textAlign: 'right', flexShrink: 0 }}>
              {money0(m.price)}
            </span>
          </button>
        ))}
        </Card>
        <Card title="Top Cost Drivers (BOE)">
          {topDrivers.map((b) => (
            <button
              key={b.element}
              type="button"
              className="dashrow"
              title={`${b.element} — ${money0(b.price)} (${pct(r.total ? b.price / r.total : 0)} of total) · click for the BOE`}
              onClick={() => go('boe')}
            >
              <span
                style={{
                  width: `${cfLabelCh}ch`,
                  fontSize: 11,
                  color: 'var(--muted)',
                  textAlign: 'right',
                  whiteSpace: 'normal',
                  lineHeight: 1.25,
                  flexShrink: 0,
                }}
              >
                {b.element}
              </span>
              <span className="dashbar">
                <i style={{ width: `${((b.price / topMax) * 100).toFixed(1)}%` }} />
              </span>
              <span className="mono" style={{ width: 110, fontSize: 11, textAlign: 'right', flexShrink: 0 }}>
                {money0(b.price)}
              </span>
            </button>
          ))}
          <Note style={{ marginTop: 8, marginBottom: 0 }}>Largest capability prices; defend these hardest in the BOE.</Note>
        </Card>
      </div>
    </Section>
  );
}

export function Funding() {
  const s = useActivePursuit();
  const r = useResult();
  const update = useStore((st) => st.updateActive);
  const f = r.funding;

  return (
    <Section
      title="Funding & Color of Money"
      sub="Milestone payments mapped to the federal fiscal year of completion (Oct–Sep) and tagged by appropriation. Each option period is its own funding action; appropriation types generally cannot be commingled. Planning support, not an obligation schedule."
    >
      <TipBox>
        Milestone prices roll into federal fiscal years (Oct–Sep) by completion date, split by each period's color of money. If an FY looks lumpy, slide milestone month offsets instead of touching dollars.
      </TipBox>
      <Card title="Appropriation Tagging (per contract period)">
        <div className="cgrid">
          {s.control.periods.map((p, i) => (
            <div className="field" key={i}>
              <label>
                {p.label} <span className="hint">ALIN {String(i + 1).padStart(3, '0')} · {p.months} months</span>
              </label>
              <select
                value={String(p.color)}
                onChange={(e) =>
                  update((x) => {
                    x.control.periods[i].color = e.target.value;
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
          ))}
        </div>
        <Note style={{ marginTop: 10, marginBottom: 0 }}>
          The tag drives the funding split below and the dashboard chart. Set it to fiscal reality (a sustainment period may
          be O&M, a modernization period RDT&E).
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
