import { OptionalNumInput } from '../components/inputs';
import { Card, Legend, Note, Pill, Section, utilTone } from '../components/ui';
import { pct } from '../lib/format';
import { useActivePursuit, useStore } from '../state/store';
import { useResult } from '../state/useResult';

export function Phasing() {
  const s = useActivePursuit();
  const r = useResult();
  const update = useStore((st) => st.updateActive);
  const c = s.control;

  const setCurve = (curve: 'automationCurve' | 'surgeProfile', year: number, v: number | null) =>
    update((p) => {
      if (v !== null && v > 0) p.control[curve][year] = v;
      else delete p.control[curve][year];
    });

  return (
    <Section
      title="Time-Phasing: Surge & AI Disruption"
      sub="Most requirements are not straight-line. Use the surge factor to scale staffed capacity in a given year (a Dev-heavy year then an O&S tail), and the AI / automation factor to model throughput gains that let a smaller team clear the same backlog in the out-years."
    >
      <div className="card flush">
        <div className="ch">
          <h3>Demand vs Funded Capacity by Year</h3>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th className="num">Story Pts (exp)</th>
                <th className="num">Sprints Needed</th>
                <th className="num">Surge ×</th>
                <th className="num">Sprints Funded</th>
                <th className="num">Utilization</th>
                <th className="num">AI / Auto ×</th>
              </tr>
            </thead>
            <tbody>
              {r.demand.byYear.map((y) => (
                <tr key={y.year}>
                  <td>
                    <b>PI Year {y.year}</b>
                  </td>
                  <td className="num calc">{y.points.toFixed(0)}</td>
                  <td className="num calc">{y.needed.toFixed(1)}</td>
                  <td className="num">
                    <OptionalNumInput
                      className="cellinput num"
                      step={0.05}
                      placeholder="1.0"
                      value={c.surgeProfile[y.year] ?? ''}
                      onCommit={(v) => setCurve('surgeProfile', y.year, v)}
                    />
                  </td>
                  <td className="num calc">{y.funded.toFixed(0)}</td>
                  <td className="num">
                    <Pill tone={utilTone(y.util)}>{pct(y.util)}</Pill>
                  </td>
                  <td className="num">
                    <OptionalNumInput
                      className="cellinput num"
                      step={0.05}
                      placeholder="1.0"
                      value={c.automationCurve[y.year] ?? ''}
                      onCommit={(v) => setCurve('automationCurve', y.year, v)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Legend>
          <span>
            <b>Surge ×</b> scales funded capacity for that year (0.5 = half a year of teams; 1.5 = surge).
          </span>
          <span>
            <b>AI / Auto ×</b> above 1.0 raises effective velocity, so the same points need fewer sprints and less labor in
            that year.
          </span>
          <span>Blank = 1.0 (no change).</span>
        </Legend>
      </div>
      <Card title="How to use these levers">
        <Note style={{ marginBottom: 0 }}>
          The AI factor handles the "drop the four mid/junior engineers in the option years" case: set Year 2 and Year 3 above
          1.0 to reflect automation-driven throughput, and the out-year labor falls. The surge factor handles the
          Dev-then-sustainment wave by funding fewer team-years where the workload tapers. Both default to 1.0, so an untouched
          model stays straight-line and ties to the validated baseline.
        </Note>
      </Card>
    </Section>
  );
}
