import { Card, Note, Pill, Section, Stat, statusTone, utilTone } from '../components/ui';
import { fmt0, money0, money2, pct } from '../lib/format';
import { useActivePursuit } from '../state/store';
import { useResult } from '../state/useResult';

export function Results() {
  const s = useActivePursuit();
  const r = useResult();
  const u = Math.min(1, r.util);

  return (
    <Section
      title="Pricing Results"
      sub="Cost-to-price at the selected confidence, with variance-based reserve, fee, capacity reconciliation, budget check and phase split."
    >
      <div className="resgrid">
        <Stat
          hero
          k={`Total Price — ${s.control.confidence}`}
          v={money2(r.total)}
          sub={`Gross-up ${r.grossup.toFixed(4)}× applied to milestone base cost`}
        />
        <Stat k="Cost P50 (pre-fee)" v={money0(r.costP50)} />
        <Stat k="Cost P80 (pre-fee)" v={money0(r.costP80)} />
        <Stat k="Base cost @ confidence" v={money0(r.base)} />
        <Stat
          k={`Reserve ${pct(r.resPct)}`}
          v={money0(r.resD)}
          sub={`${s.control.reserveMethod} · max(spread ${pct(r.spread, 1)}, CoV ${pct(r.cov, 1)})`}
        />
        <Stat k={`Fee (${pct(s.control.fee)})`} v={money0(r.fee)} />
        <Stat k="Subtotal + PTW" v={money0(r.total)} sub={`PTW ${pct(s.control.ptw)}`} />
      </div>
      <div style={{ marginTop: 18 }}>
        <Card title="Capacity Reconciliation" actions={<Pill tone={utilTone(r.util)}>{r.capFlag.split(':')[0]}</Pill>}>
          <div className="cgrid">
            <div className="field">
              <label>Backlog-burn team-sprints (P50)</label>
              <span className="mono">{r.sumSprP50.toFixed(1)}</span>
            </div>
            <div className="field">
              <label>Staffed capacity team-sprints</label>
              <span className="mono">{fmt0(r.totalCapacity)}</span>
            </div>
            <div className="field">
              <label>Utilization</label>
              <span className="mono">{pct(r.util)}</span>
            </div>
            <div className="field">
              <label>Capacity-priced labor (Yr1 blend, info)</label>
              <span className="mono">{money0(r.totalCapacity * r.blendedCps)}</span>
            </div>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(u * 100).toFixed(1)}%` }} />
          </div>
          <div className="sub" style={{ marginTop: 6, color: 'var(--muted)' }}>
            {r.capFlag}
          </div>
        </Card>
      </div>
      <Card title="Budget" actions={<Pill tone={statusTone(r.budgetStatus)}>{r.budgetStatus.split(':')[0]}</Pill>}>
        <div className="cgrid">
          <div className="field">
            <label>Budget ceiling</label>
            <span className="mono">{money0(r.ceiling)}</span>
          </div>
          <div className="field">
            <label>Variance to ceiling</label>
            <span className="mono">{money0(r.budgetVar)}</span>
          </div>
          <div className="field" style={{ gridColumn: '1/-1' }}>
            <label>Status</label>
            <span>{r.budgetStatus}</span>
          </div>
        </div>
      </Card>
      <Card title="Phase Split">
        <div className="cgrid">
          <div className="field">
            <label>Phase 1 price (ALIN 001, exercised)</label>
            <span className="mono">{money0(r.phase1Price)}</span>
          </div>
          <div className="field">
            <label>Phase 2 price (ALIN 002, option)</label>
            <span className="mono">{money0(r.phase2Price)}</span>
          </div>
        </div>
      </Card>
      <Card title="Cost Element Build & Indirect Treatment">
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Cost element</th>
                <th className="num">Cost in base</th>
                <th>Indirect carried before fee</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Delivery labor (backlog)</td>
                <td className="num">{money0(s.control.confidence === 'P80' ? r.capSubP80 : r.capSubP50)}</td>
                <td>Fully burdened (fringe + OH + G&A in loaded rate)</td>
              </tr>
              <tr>
                <td>Persistent LOE</td>
                <td className="num">{money0(r.loeTot)}</td>
                <td>Fully burdened (loaded rate)</td>
              </tr>
              <tr>
                <td>Program support</td>
                <td className="num">{r.includePS ? money0(r.psTot) : 'excluded'}</td>
                <td>Fully burdened (loaded rate)</td>
              </tr>
              <tr>
                <td>ODC</td>
                <td className="num">{money0(r.odcTot)}</td>
                <td>Material handling / G&A on ODC at {pct(s.control.gnaODC)}</td>
              </tr>
              <tr>
                <td>Fixed (PM & mobilization)</td>
                <td className="num">{money0(r.fixedTot)}</td>
                <td>
                  {r.fixedBurden > 0
                    ? 'Burden at ' + pct(r.fixedBurden)
                    : 'No indirect (set Fixed-cost burden on Overview to load it)'}
                </td>
              </tr>
              <tr>
                <td>Subcontractors</td>
                <td className="num">{money0(r.subsSubtotal)}</td>
                <td>
                  Handling at {pct(s.control.subHandling)}
                  {s.control.subFee > 0 ? ' + sub fee ' + pct(s.control.subFee) : ''}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>Base cost (fee applies after this)</td>
                <td className="num">{money0(r.base)}</td>
                <td>Reserve, then fee, then PTW</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <Note style={{ marginTop: 12, marginBottom: 0 }}>
          Fee is applied to the loaded base plus reserve, so every element above carries its indirect before fee. Pure ODC
          carries material handling / G&A only, not fringe and overhead, which matches a standard disclosure. If your
          accounting loads fixed items, set the fixed-cost burden on the Overview tab.
        </Note>
      </Card>
      <Card title="Sprints Needed vs Funded">
        <div className="cgrid">
          <div className="field">
            <label>Sprints needed (demand, {s.control.confidence})</label>
            <span className="mono">{r.demand.needed.toFixed(1)}</span>
          </div>
          <div className="field">
            <label>Sprints funded (staffed capacity)</label>
            <span className="mono">{r.demand.funded.toFixed(1)}</span>
          </div>
          <div className="field">
            <label>Gap (funded − needed)</label>
            <span className="mono">{r.demand.gap.toFixed(1)}</span>
          </div>
          <div className="field">
            <label>Cost-equivalent of the gap (Yr1 blend)</label>
            <span className="mono">{money0(r.demand.gapCost)}</span>
          </div>
        </div>
        <Note style={{ marginTop: 12, marginBottom: 0 }}>
          The milestone price bills the work needed, not the full staffed year, which is why a low utilization shows up as a
          gap here rather than as cost. Bid to demand when you are competitive; price the full capacity (the Capacity Tiers
          model) when you are selling a standing capability, where the gap becomes buffer, efficiency dividend, or margin.
        </Note>
      </Card>
    </Section>
  );
}
