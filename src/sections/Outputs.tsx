import { Note, Pill, Section, Stat } from '../components/ui';
import { exportMpsCsv } from '../export/csv';
import { addMonths, money0, money2 } from '../lib/format';
import { useActivePursuit } from '../state/store';
import { useResult } from '../state/useResult';

export function Mps() {
  const s = useActivePursuit();
  const r = useResult();

  const phaseBlock = (phase: number, title: string) => {
    const list = r.msRows.filter((row) => row.phase === phase);
    if (!list.length) return null;
    const subNames = s.teaming.map((t) => t.party);
    const total = list.reduce((a, row) => a + row.price, 0);
    return (
      <div className="card flush">
        <div className="ch">
          <h3>{title}</h3>
          <span className="mono" style={{ fontSize: 13, color: 'var(--force)', fontWeight: 800 }}>
            {money0(total)}
          </span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Milestone / Deliverable</th>
              <th>Est. Completion</th>
              <th className="num">Payable Amount</th>
            </tr>
          </thead>
          <tbody>
            {list.map((row) => (
              <>
                <tr key={row.name}>
                  <td>
                    <b>{row.name}</b>
                  </td>
                  <td className="calc dim">{addMonths(s.control.popStart, row.monthOffset)}</td>
                  <td className="num">
                    <b>{money0(row.price)}</b>
                  </td>
                </tr>
                <tr key={row.name + '::prime'}>
                  <td colSpan={2} style={{ paddingLeft: 28, color: 'var(--muted)' }}>
                    Prime share
                  </td>
                  <td className="num calc">{money2(row.primeShare)}</td>
                </tr>
                {row.subShares.map((share, k) => (
                  <tr key={row.name + '::sub' + k}>
                    <td colSpan={2} style={{ paddingLeft: 28, color: 'var(--muted)' }}>
                      {subNames[k] || 'Sub ' + (k + 1)} share
                    </td>
                    <td className="num calc">{money2(share)}</td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <Section
      title="Milestone Payment Schedule"
      sub="Customer-facing (Attachment 10 format). Reserve is embedded in milestone prices via the gross-up, not shown as a line. Each contract period is its own ALIN; ALIN 001 is the exercised base."
      actions={
        <button type="button" className="tbtn solid" onClick={() => exportMpsCsv(s, r)}>
          Export CSV
        </button>
      }
    >
      <div
        className="resgrid"
        style={{ gridTemplateColumns: `repeat(${Math.min(4, r.periods.length + 1)},1fr)`, marginBottom: 18 }}
      >
        {r.periods.map((p) => (
          <Stat
            key={p.index}
            k={`ALIN ${String(p.index).padStart(3, '0')} — FFP, ${p.index === 1 ? 'Exercised' : 'Option'}`}
            v={money0(p.price)}
          />
        ))}
        <Stat k="Total Agreement" v={money0(r.total)} />
      </div>
      {r.periods.map((p) =>
        phaseBlock(
          p.index,
          `${p.label} — ALIN ${String(p.index).padStart(3, '0')} (${p.index === 1 ? 'Exercised' : 'Option'})`,
        ),
      )}
    </Section>
  );
}

export function Boe() {
  const s = useActivePursuit();
  const r = useResult();
  return (
    <Section
      title="BOE Traceability"
      sub="Requirement-to-price chain for evaluation-notice defense: three-point points → reserve → ramp → sprints → escalated labor → +LOE/ODC/fixed → gross-up → price. The total ties to the quoted price."
    >
      <div className="card flush">
        <div className="ch">
          <h3>Capability Chain @ {s.control.confidence}</h3>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Element</th>
                <th className="num">Epics</th>
                <th className="num">Exp Pts</th>
                <th className="num">SD</th>
                <th className="num">Eff Pts</th>
                <th className="num">Sprints</th>
                <th className="num">Labor</th>
                <th className="num">ODC+LOE+Fixed</th>
                <th className="num">Total Cost</th>
                <th className="num">Price</th>
              </tr>
            </thead>
            <tbody>
              {r.boeCaps.map((b) => (
                <tr key={b.element}>
                  <td>{b.element}</td>
                  <td className="num calc">{b.epics}</td>
                  <td className="num calc">{b.exp.toFixed(0)}</td>
                  <td className="num calc">{b.sd.toFixed(1)}</td>
                  <td className="num calc">{b.effPts.toFixed(1)}</td>
                  <td className="num calc">{b.sprints.toFixed(1)}</td>
                  <td className="num calc">{money0(b.labor)}</td>
                  <td className="num calc dim">—</td>
                  <td className="num calc">{money0(b.totalCost)}</td>
                  <td className="num calc">
                    <b>{money0(b.price)}</b>
                  </td>
                </tr>
              ))}
              {r.boeExtra.map((b) => (
                <tr key={b.element}>
                  <td>{b.element}</td>
                  <td className="num calc dim">—</td>
                  <td className="num calc dim">—</td>
                  <td className="num calc dim">—</td>
                  <td className="num calc dim">—</td>
                  <td className="num calc dim">—</td>
                  <td className="num calc dim">—</td>
                  <td className="num calc">{money0(b.totalCost)}</td>
                  <td className="num calc">{money0(b.totalCost)}</td>
                  <td className="num calc">
                    <b>{money0(b.price)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={8}>TOTAL</td>
                <td className="num">
                  {money0(r.boeCaps.reduce((a, b) => a + b.totalCost, 0) + r.boeExtra.reduce((a, b) => a + b.totalCost, 0))}
                </td>
                <td className="num">{money0(r.boeTotalPrice)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Section>
  );
}

export function ValueMap() {
  const s = useActivePursuit();
  const r = useResult();
  const gated = r.msRows.filter((row) => row.gated);
  return (
    <Section
      title="Value Map"
      sub="Price per value increment for SOO value-based evaluation. Each value-gated milestone carries a KPI and acceptance threshold; payment is gated on demonstrated value. Edit KPIs and thresholds on the Milestones tab."
    >
      <div className="card flush">
        <div className="ch">
          <h3>Value-Gated Milestones</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>Milestone</th>
              <th>Primary Capability</th>
              <th>Value KPI (SOO)</th>
              <th>Acceptance Threshold</th>
              <th className="num">Price</th>
              <th className="num">Gated?</th>
            </tr>
          </thead>
          <tbody>
            {gated.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: 'var(--muted)' }}>
                  No milestones marked value-gated. Toggle "Gated?" on the Milestones tab.
                </td>
              </tr>
            )}
            {gated.map((row) => {
              const cap = s.backlog.find((b) => b.milestone === row.name)?.capability || '';
              return (
                <tr key={row.name}>
                  <td>
                    <b>{row.name}</b>
                  </td>
                  <td className="calc dim">{cap}</td>
                  <td>{row.kpi}</td>
                  <td>{row.threshold}</td>
                  <td className="num calc">{money0(row.price)}</td>
                  <td className="num">
                    <Pill tone="ok">Yes</Pill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Note>
        If scope shifts, milestone dollars stay fixed; the work behind a gate is re-baselined in the backlog, preserving the
        capacity-based price.
      </Note>
    </Section>
  );
}

export function Checks() {
  const r = useResult();
  const fails = r.checks.filter((c) => !c.ok).length;
  return (
    <Section
      title="Integrity Checks"
      sub="Automated reconciliations that guard against silent errors when inputs change. All must read OK before the price is trustworthy."
      actions={
        <Pill tone={r.allOk ? 'ok' : 'bad'} style={{ fontSize: 13 }}>
          {r.allOk ? 'ALL OK' : fails + ' FAILING'}
        </Pill>
      }
    >
      <div className="card flush">
        <div className="ch">
          <h3>Reconciliation</h3>
        </div>
        {r.checks.map((c) => (
          <div className="check" key={c.n}>
            <div className="num">{c.n}</div>
            <div className="lbl">{c.label}</div>
            <div className="val">{Number.isInteger(c.val) ? c.val : c.val.toFixed(4)}</div>
            <Pill tone={c.ok ? 'ok' : 'bad'}>{c.ok ? 'OK' : 'FAIL'}</Pill>
          </div>
        ))}
      </div>
    </Section>
  );
}
