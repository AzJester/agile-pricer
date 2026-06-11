import { NumCell, SelectCell, TextCell } from '../components/inputs';
import { AddRowButton, Callout, DeleteRowButton, Section, TipBox } from '../components/ui';
import type { BacklogItem } from '../engine';
import { fmt0 } from '../lib/format';
import { useActivePursuit, useStore } from '../state/store';
import { useResult } from '../state/useResult';

export function Backlog() {
  const s = useActivePursuit();
  const r = useResult();
  const update = useStore((st) => st.updateActive);

  const set = (i: number, key: keyof BacklogItem, v: string | number) =>
    update((p) => {
      (p.backlog[i] as unknown as Record<string, unknown>)[key] = v;
    });

  const unmatched = r.checks.find((c) => c.n === 6 && !c.ok);
  const totalExp = s.backlog.reduce((t, b) => t + (b.low + 4 * b.likely + b.high) / 6, 0);

  return (
    <Section
      title="Backlog"
      sub="Scope decomposition with three-point sizing. Expected uses PERT = (Low + 4×Likely + High) / 6; SD = (High − Low) / 6. The Milestone name must match a row on the Milestones tab so labor maps to a payable event."
    >
      {unmatched && (
        <Callout>
          Some backlog milestone names don't exist in the Milestones table. Unmatched labor won't map to a payable milestone.
          Reconcile names on the Milestones tab.
        </Callout>
      )}
      <TipBox>
        The story-point counts here drive most of the bid. Spread <b>Low</b> and <b>High</b> to reflect real uncertainty rather
        than anchoring tight around <b>Likely</b>; a wider range raises the P80 and the reserve, which is the honest result
        when scope is soft. After sizing, open the <b>Sensitivity</b> tab to see how much the total moves if these points are
        off by 20%.
      </TipBox>
      <div className="card flush">
        <div className="ch">
          <h3>Scope & Sizing</h3>
          <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
            {s.backlog.length} epics · Σ expected {fmt0(totalExp)} pts
          </span>
        </div>
        <div className="tablewrap">
          <table className="t-backlog">
            <thead>
              <tr>
                <th>Capability</th>
                <th>Epic</th>
                <th>PI</th>
                <th className="num">PI Yr</th>
                <th>Milestone</th>
                <th>Archetype</th>
                <th className="num">Low</th>
                <th className="num">Likely</th>
                <th className="num">High</th>
                <th className="num">Exp</th>
                <th className="num">SD</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.backlog.map((b, i) => {
                const exp = (b.low + 4 * b.likely + b.high) / 6;
                const sd = (b.high - b.low) / 6;
                return (
                  <tr key={i}>
                    <td>
                      <TextCell value={b.capability} onCommit={(v) => set(i, 'capability', v)} />
                    </td>
                    <td>
                      <TextCell value={b.epic} onCommit={(v) => set(i, 'epic', v)} />
                    </td>
                    <td>
                      <TextCell value={b.pi} onCommit={(v) => set(i, 'pi', v)} />
                    </td>
                    <td className="num">
                      <NumCell value={b.piYear} onCommit={(v) => set(i, 'piYear', v)} />
                    </td>
                    <td>
                      <TextCell value={b.milestone} onCommit={(v) => set(i, 'milestone', v)} />
                    </td>
                    <td>
                      <SelectCell
                        value={b.archetype}
                        options={s.archetypes.map((a) => ({ value: a.name }))}
                        onCommit={(v) => set(i, 'archetype', v)}
                      />
                    </td>
                    <td className="num">
                      <NumCell value={b.low} onCommit={(v) => set(i, 'low', v)} />
                    </td>
                    <td className="num">
                      <NumCell value={b.likely} onCommit={(v) => set(i, 'likely', v)} />
                    </td>
                    <td className="num">
                      <NumCell value={b.high} onCommit={(v) => set(i, 'high', v)} />
                    </td>
                    <td className="num calc">{exp.toFixed(1)}</td>
                    <td className="num calc dim">{sd.toFixed(1)}</td>
                    <td>
                      <DeleteRowButton
                        onClick={() =>
                          update((p) => {
                            p.backlog.splice(i, 1);
                          })
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <AddRowButton
          label="Add epic"
          onClick={() =>
            update((p) => {
              p.backlog.push({
                capability: 'New Capability',
                epic: 'New Epic',
                pi: 'PI1',
                piYear: 1,
                milestone: p.milestones[0]?.name || '',
                archetype: p.archetypes[0]?.name || '',
                low: 50,
                likely: 75,
                high: 120,
              });
            })
          }
        />
      </div>
    </Section>
  );
}
