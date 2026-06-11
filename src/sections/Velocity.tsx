import { NumInput, TextInput } from '../components/inputs';
import { Card, Legend, Section, TipBox } from '../components/ui';
import { money0, pct } from '../lib/format';
import { useActivePursuit, useStore } from '../state/store';
import { useResult } from '../state/useResult';

export function Velocity() {
  const s = useActivePursuit();
  const r = useResult();
  const update = useStore((st) => st.updateActive);
  const v = s.velocity;

  return (
    <Section
      title="Velocity & Reserve"
      sub="Velocity, ramp and reserve drive points → sprints → escalated labor. P80 effective points add 0.84×SD (≈ the P80 z-score). New teams ramp in their first PI year. The reserve compares estimate spread to historical velocity variation."
    >
      <TipBox>
        Base velocity on <b>three to six sprints of actuals</b> from a comparable team, and enter those sprints as samples so
        the model can derive the variation behind the reserve. A velocity pulled from a single point or from memory is the most
        common way a clean-looking estimate goes wrong. If you have no history, widen the backlog ranges and lean on the P80.
      </TipBox>
      <Card title="Assumptions">
        <div className="cgrid">
          <div className="field">
            <label>
              Capacity reserve %<span className="hint">defects / refactor, not new scope</span>
            </label>
            <NumInput
              value={v.capacityReserve}
              onCommit={(x) =>
                update((p) => {
                  p.velocity.capacityReserve = x;
                })
              }
            />
          </div>
          <div className="field">
            <label>
              Ramp factor (PI1)<span className="hint">first-year velocity multiplier</span>
            </label>
            <NumInput
              value={v.rampFactor}
              onCommit={(x) =>
                update((p) => {
                  p.velocity.rampFactor = x;
                })
              }
            />
          </div>
          <div className="field" style={{ gridColumn: '1/-1' }}>
            <label>
              Historical velocity samples<span className="hint">comma or space separated; drives velocity CoV</span>
            </label>
            <TextInput
              className="text"
              style={{ minWidth: 320, textAlign: 'left' }}
              value={v.samples.join(', ')}
              onCommit={(str) =>
                update((p) => {
                  p.velocity.samples = str
                    .split(/[,\s]+/)
                    .map((x) => parseFloat(x))
                    .filter((x) => Number.isFinite(x));
                })
              }
            />
          </div>
        </div>
        <Legend>
          <span>
            Velocity CoV = <b>{pct(r.cov, 2)}</b>
          </span>
          <span>
            Estimate spread (P80−P50)/P50 = <b>{pct(r.spread, 2)}</b>
          </span>
          <span>
            Effective reserve = <b>{pct(r.resPct, 2)}</b> ({s.control.reserveMethod})
          </span>
        </Legend>
      </Card>
      <div className="card flush">
        <div className="ch">
          <h3>Effort → Sprints → Labor (escalated)</h3>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Capability</th>
                <th>Milestone</th>
                <th className="num">PI Yr</th>
                <th className="num">Eff Pts P50</th>
                <th className="num">Eff Pts P80</th>
                <th className="num">Sprints P50</th>
                <th className="num">Sprints P80</th>
                <th className="num">Labor P50</th>
                <th className="num">Labor P80</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row, i) => (
                <tr key={i}>
                  <td>{row.cap}</td>
                  <td className="calc dim">{row.ms}</td>
                  <td className="num calc dim">{row.py}</td>
                  <td className="num calc">{row.effP50.toFixed(1)}</td>
                  <td className="num calc">{row.effP80.toFixed(1)}</td>
                  <td className="num calc">{row.sp50.toFixed(2)}</td>
                  <td className="num calc">{row.sp80.toFixed(2)}</td>
                  <td className="num calc">{money0(row.lp50)}</td>
                  <td className="num calc">{money0(row.lp80)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>TOTAL</td>
                <td className="num">{r.sumSprP50.toFixed(1)}</td>
                <td className="num">{r.sumSprP80.toFixed(1)}</td>
                <td className="num">{money0(r.capSubP50)}</td>
                <td className="num">{money0(r.capSubP80)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Section>
  );
}
