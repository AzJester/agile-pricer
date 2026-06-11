import { useMemo, useState } from 'react';
import { Histogram, Tornado, Waterfall } from '../components/charts';
import { NumInput, Toggle } from '../components/inputs';
import { Callout, Card, Note, Pill, Section, Stat } from '../components/ui';
import {
  sensitivity,
  simulate,
  type ComputeResult,
  type Pursuit,
  type SensitivityResult,
  type SimulationResult,
} from '../engine';
import { fmt0, money0, pct } from '../lib/format';
import type React from 'react';
import { useActivePursuit, useStore } from '../state/store';
import { computeCached, useResult } from '../state/useResult';

export function Risk() {
  const s = useActivePursuit();
  const update = useStore((st) => st.updateActive);
  const [mc, setMc] = useState<SimulationResult | null>(null);
  const [ranFor, setRanFor] = useState<Pursuit | null>(null);
  const stale = mc !== null && ranFor !== s;

  return (
    <Section
      title="Risk — Monte Carlo"
      sub="Simulates the three-point backlog estimates (triangular sampling) to produce a cost distribution instead of the single deterministic PERT figure. Use it to defend the reserve and the P80 confidence basis."
      actions={
        <button
          type="button"
          className="tbtn solid"
          onClick={() => {
            setMc(simulate(s, 4000));
            setRanFor(s);
          }}
        >
          Run 4,000 trials
        </button>
      }
    >
      <Card title="Simulation Assumptions">
        <div className="cgrid">
          <div className="field">
            <label>
              Epic correlation (0–0.99)
              <span className="hint">shared driver across epics per trial; 0 = independent</span>
            </label>
            <NumInput
              step={0.05}
              value={s.risk.correlation}
              onCommit={(v) =>
                update((p) => {
                  p.risk.correlation = Math.min(0.99, Math.max(0, v));
                })
              }
            />
          </div>
          <div className="field">
            <label>
              Sample velocity per trial
              <span className="hint">draws a velocity multiplier from the historical CoV</span>
            </label>
            <Toggle
              label=""
              checked={s.risk.sampleVelocity}
              onCommit={(v) =>
                update((p) => {
                  p.risk.sampleVelocity = v;
                })
              }
            />
          </div>
        </div>
        <Note style={{ marginTop: 10, marginBottom: 0 }}>
          Independent epics (correlation 0) understate tail risk: overruns usually share a cause, the same team and the same
          unknowns. A correlation of 0.3–0.5 is a more realistic planning basis; velocity sampling moves velocity uncertainty
          out of the reserve heuristic and into the distribution itself.
        </Note>
      </Card>
      {stale && (
        <Callout color="var(--supernova)">Inputs changed since this run. Re-run the simulation to refresh the distribution.</Callout>
      )}
      {mc ? (
        <>
          <div className="resgrid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            <Stat k="Simulated P50 cost" v={money0(mc.p50)} />
            <Stat k="Simulated P80 cost" v={money0(mc.p80)} />
            <Stat
              k="Mean ± Std"
              vStyle={{ fontSize: 15 }}
              v={
                <>
                  {money0(mc.mean)}
                  <br />
                  <small>± {money0(mc.std)}</small>
                </>
              }
            />
            <Stat k="P10 – P90 range" vStyle={{ fontSize: 14 }} v={`${money0(mc.p10)} – ${money0(mc.p90)}`} />
          </div>
          <div style={{ marginTop: 18 }}>
            <Card title={`Cost Distribution (${fmt0(mc.iters)} trials)`}>
              <Histogram samples={mc.samples} p50={mc.p50} p80={mc.p80} />
            </Card>
          </div>
          <Card title="Simulated vs Deterministic">
            <div className="cgrid">
              <div className="field">
                <label>Deterministic P50 (PERT)</label>
                <span className="mono">{money0(mc.deterministicP50)}</span>
              </div>
              <div className="field">
                <label>Simulated P50</label>
                <span className="mono">{money0(mc.p50)}</span>
              </div>
              <div className="field">
                <label>Deterministic P80 (PERT + 0.84·SD)</label>
                <span className="mono">{money0(mc.deterministicP80)}</span>
              </div>
              <div className="field">
                <label>Simulated P80</label>
                <span className="mono">{money0(mc.p80)}</span>
              </div>
            </div>
            <Note style={{ marginTop: 10, marginBottom: 0 }}>
              Close agreement supports the deterministic shortcut used in the priced model. A wide gap means the backlog spread
              is skewed enough to prefer the simulated basis.
              {mc.seed !== null && (
                <>
                  {' '}
                  Seeded run (seed {mc.seed}): the same inputs reproduce these figures exactly, so a reviewed result can be
                  regenerated.
                </>
              )}
            </Note>
          </Card>
        </>
      ) : (
        <Callout>
          Run the simulation to generate a cost distribution from the current backlog. It samples each epic between its Low and
          High around the Likely value.
        </Callout>
      )}
    </Section>
  );
}

export function Sensitivity() {
  const s = useActivePursuit();
  const [pctFlex, setPctFlex] = useState<number | null>(null);
  const res: SensitivityResult | null = useMemo(
    () => (pctFlex === null ? null : sensitivity(s, pctFlex)),
    [s, pctFlex],
  );

  return (
    <Section
      title="Driver Sensitivity"
      sub="The model is only as good as its cost-sensitive inputs. This flexes each driver by a set percentage and ranks the resulting price swing, so you see which one or two assumptions to defend hardest. A long bar means a small error there moves the bid a lot."
      actions={
        <div style={{ display: 'flex', gap: 6 }}>
          {[0.1, 0.2, 0.3].map((p) => (
            <button
              key={p}
              type="button"
              className={'tbtn ' + (pctFlex === p ? 'primary' : 'solid')}
              onClick={() => setPctFlex(p)}
            >
              ±{Math.round(p * 100)}%
            </button>
          ))}
        </div>
      }
    >
      {res ? (
        <>
          <Card title={`Tornado — price swing at ±${Math.round(res.pct * 100)}%`}>
            <Tornado drivers={res.drivers} base={res.base} />
          </Card>
          <div className="card flush">
            <div className="ch">
              <h3>Detail</h3>
            </div>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Driver</th>
                    <th className="num">Low</th>
                    <th className="num">Base</th>
                    <th className="num">High</th>
                    <th className="num">Swing</th>
                    <th className="num">% of base</th>
                  </tr>
                </thead>
                <tbody>
                  {res.drivers.map((d) => (
                    <tr key={d.driver}>
                      <td>{d.driver}</td>
                      <td className="num calc">{money0(d.low)}</td>
                      <td className="num calc">{money0(d.base)}</td>
                      <td className="num calc">{money0(d.high)}</td>
                      <td className="num calc">
                        <b>{money0(d.swing)}</b>
                      </td>
                      <td className="num calc">{pct(d.swing / d.base)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <Callout>Pick a percentage above to run the sensitivity sweep against the current pursuit.</Callout>
      )}
    </Section>
  );
}

export function MarginWalk() {
  const s = useActivePursuit();
  const r = useResult();
  const ptw = r.total - r.subtotal;
  const cost = r.base;
  const margin = r.total - cost;
  const psNote = r.includePS
    ? r.psTot > 0
      ? money0(r.psTot) + ' included in cost'
      : 'none entered'
    : 'tracked but excluded from price';

  const line = (lab: string, val: string, strong = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eef' }}>
      <span>{lab}</span>
      <span className="mono" style={strong ? { fontWeight: 700 } : undefined}>
        {val}
      </span>
    </div>
  );

  return (
    <Section
      title="Margin Walk (internal view)"
      sub="What you propose, and how the financial position behind it is built. Cost is the loaded estimate the portfolio is held to; everything above it is reserve, fee, and any price-to-win move. This is the internal companion to the customer-facing price."
    >
      <div className="resgrid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <Stat k="Proposed Price" v={money0(r.total)} />
        <Stat k={`Internal Cost (${s.control.confidence})`} v={money0(cost)} />
        <Stat hero k="Margin (price − cost)" v={money0(margin)} sub={`${pct(r.total ? margin / r.total : 0)} of price`} />
        <Stat k="Fee booked" v={money0(r.fee)} sub={`${pct(s.control.fee)} of cost+reserve`} />
      </div>
      <div style={{ marginTop: 18 }}>
        <Card title="Cost to Price">
          <Waterfall
            steps={[
              { label: 'Cost', delta: cost },
              { label: 'Reserve', delta: r.resD },
              { label: 'Fee', delta: r.fee },
              { label: 'PTW', delta: ptw },
              { label: 'Price', delta: 0, total: true },
            ]}
          />
        </Card>
      </div>
      <Card title="Internal Build">
        {line('Delivery labor (backlog)', money0(s.control.confidence === 'P80' ? r.capSubP80 : r.capSubP50))}
        {line('Persistent LOE', money0(r.loeTot))}
        {line('Program support (PM/finance/contracts/BM)', psNote)}
        {line('ODC + handling', money0(r.odcTot))}
        {line('Fixed (PM & mobilization' + (r.fixedBurden > 0 ? ' + burden' : '') + ')', money0(r.fixedTot))}
        {line('Internal cost target', money0(cost), true)}
        {line('Risk reserve', money0(r.resD))}
        {line('Fee', money0(r.fee))}
        {line('Price-to-win adjustment', money0(ptw))}
        {line('Proposed price', money0(r.total), true)}
      </Card>
    </Section>
  );
}

export function ScenarioCompare() {
  const pursuits = useStore((st) => st.pursuits);
  const baselineId = useStore((st) => st.baselineId);
  const setBaseline = useStore((st) => st.setBaseline);
  const rows = useMemo(() => {
    const out: { id: string; name: string; r: ComputeResult; data: Pursuit }[] = [];
    for (const p of pursuits) {
      try {
        // Cached on data identity: editing one pursuit no longer re-runs the
        // engine for every column while this section is open.
        out.push({ id: p.id, name: p.data.name, r: computeCached(p.data), data: p.data });
      } catch {
        // Skip pursuits that fail to compute rather than blanking the table.
      }
    }
    return out;
  }, [pursuits]);
  const baseline = rows.find((x) => x.id === baselineId) ?? null;

  const metric = (
    label: string,
    fn: (r: ComputeResult, d: Pursuit) => string | number,
    deltaFn?: (r: ComputeResult) => number,
  ) => (
    <tr>
      <td>{label}</td>
      {rows.map((x, i) => {
        let delta: React.ReactNode = null;
        if (deltaFn && baseline && x.id !== baseline.id) {
          const d = deltaFn(x.r) - deltaFn(baseline.r);
          if (Math.abs(d) >= 1) {
            delta = (
              <div style={{ fontSize: 10.5, color: d > 0 ? 'var(--twilight)' : '#0c7a44' }}>
                {d > 0 ? '+' : '−'}${fmt0(Math.abs(d))}
              </div>
            );
          }
        }
        return (
          <td key={i} className="num calc" style={x.id === baselineId ? { background: '#f6f3ff' } : undefined}>
            {fn(x.r, x.data)}
            {delta}
          </td>
        );
      })}
    </tr>
  );

  return (
    <Section
      title="Scenario Compare"
      sub="Every saved pursuit side by side. Duplicate a pursuit (top bar), change one assumption, and read the deltas here without losing the original. Pin one column as the baseline to see dollar deltas against it."
    >
      <div className="card flush">
        <div className="ch">
          <h3>Side-by-Side</h3>
          {baseline && <Pill tone="ok">baseline: {baseline.name}</Pill>}
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                {rows.map((x, i) => (
                  <th key={i} className="num" style={x.id === baselineId ? { background: '#efedf7' } : undefined}>
                    <div>{x.name}</div>
                    <button
                      type="button"
                      className="tbtn"
                      style={{
                        marginTop: 4,
                        padding: '1px 8px',
                        fontSize: 10,
                        background: x.id === baselineId ? 'var(--force)' : 'var(--paper)',
                        color: x.id === baselineId ? '#fff' : 'var(--muted)',
                        borderColor: 'var(--line-2)',
                      }}
                      onClick={() => setBaseline(x.id === baselineId ? null : x.id)}
                    >
                      {x.id === baselineId ? '★ baseline' : '☆ pin'}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metric('Total price', (r) => money0(r.total), (r) => r.total)}
              {metric('Period 1 (base)', (r) => money0(r.phase1Price), (r) => r.phase1Price)}
              {metric('Options (periods 2+)', (r) => money0(r.phase2Price), (r) => r.phase2Price)}
              {metric('Cost P50', (r) => money0(r.costP50), (r) => r.costP50)}
              {metric('Cost P80', (r) => money0(r.costP80), (r) => r.costP80)}
              {metric('Reserve %', (r) => pct(r.resPct))}
              {metric('Gross-up', (r) => r.grossup.toFixed(3) + '×')}
              {metric('Fee %', (_r, d) => pct(d.control.fee))}
              {metric(
                'Wrap (loaded/direct)',
                (_r, d) => ((1 + d.control.fringe) * (1 + d.control.overhead) * (1 + d.control.gna)).toFixed(3) + '×',
              )}
              {metric('Utilization', (r) => pct(r.util))}
              {metric('Top capacity tier / yr', (r) =>
                r.capacity.tiers.length ? money0(Math.max(...r.capacity.tiers.map((t) => t.annualRunRate))) : '—',
              )}
              {metric('Advisories', (r) => r.flags.length)}
              {metric('Integrity', (r) => (r.allOk ? 'OK' : r.checks.filter((c) => !c.ok).length + ' fail'))}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}
