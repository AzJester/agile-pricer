import { NumCell, SelectCell, TextCell, TextInput } from '../components/inputs';
import { AddRowButton, DeleteRowButton, Section } from '../components/ui';
import type { Milestone, Phase } from '../engine';
import { addMonths, money0, pct } from '../lib/format';
import { useActivePursuit, useStore } from '../state/store';
import { useResult } from '../state/useResult';

const PHASE_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
];

export function Milestones() {
  const s = useActivePursuit();
  const r = useResult();
  const update = useStore((st) => st.updateActive);

  const set = (i: number, key: keyof Milestone, v: string | number | boolean) =>
    update((p) => {
      (p.milestones[i] as unknown as Record<string, unknown>)[key] = v;
    });

  const rename = (i: number, name: string) =>
    update((p) => {
      const old = p.milestones[i].name;
      p.milestones[i].name = name;
      // Keep backlog labor mapped when a milestone is renamed.
      if (name !== old) for (const b of p.backlog) if (b.milestone === old) b.milestone = name;
    });

  return (
    <Section
      title="Milestones"
      sub="Payable milestone definitions. Backlog labor maps here by matching the Milestone name. LOE and ODC are allocated across same-phase milestones pro-rata by mapped labor. Month offset (from PoP start) sets the estimated completion date. The last milestone carries the whole-dollar rounding plug so prices tie to the total."
    >
      <div className="card flush">
        <div className="ch">
          <h3>Payable Milestones</h3>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Milestone / Deliverable</th>
                <th>PI</th>
                <th className="num">Phase</th>
                <th className="num">Month Off.</th>
                <th className="num">Est. Completion</th>
                <th className="num">Fixed / Mgmt $</th>
                <th>Value KPI (SOO)</th>
                <th>Acceptance</th>
                <th className="num">Gated?</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.milestones.map((m, i) => (
                <tr key={i}>
                  <td>
                    <TextInput className="cellinput text" value={m.name} onCommit={(v) => rename(i, v)} />
                  </td>
                  <td>
                    <TextCell value={m.pi} onCommit={(v) => set(i, 'pi', v)} />
                  </td>
                  <td className="num">
                    <SelectCell
                      numeric
                      value={String(m.phase)}
                      options={PHASE_OPTIONS}
                      onCommit={(v) => set(i, 'phase', Number(v) as Phase)}
                    />
                  </td>
                  <td className="num">
                    <NumCell value={m.monthOffset} onCommit={(v) => set(i, 'monthOffset', v)} />
                  </td>
                  <td className="num calc dim">{addMonths(s.control.popStart, m.monthOffset)}</td>
                  <td className="num">
                    <NumCell value={m.fixed} onCommit={(v) => set(i, 'fixed', v)} />
                  </td>
                  <td>
                    <TextCell value={m.kpi} onCommit={(v) => set(i, 'kpi', v)} />
                  </td>
                  <td>
                    <TextCell value={m.threshold} onCommit={(v) => set(i, 'threshold', v)} />
                  </td>
                  <td className="num">
                    <input type="checkbox" checked={m.gated} onChange={(e) => set(i, 'gated', e.target.checked)} />
                  </td>
                  <td>
                    <DeleteRowButton
                      onClick={() =>
                        update((p) => {
                          p.milestones.splice(i, 1);
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>TOTAL FIXED</td>
                <td className="num">{money0(r.fixedTot)}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
        <AddRowButton
          label="Add milestone"
          onClick={() =>
            update((p) => {
              p.milestones.push({
                name: 'New Milestone',
                pi: 'PI1',
                phase: 1,
                monthOffset: 6,
                fixed: 0,
                kpi: '',
                threshold: '',
                gated: true,
              });
            })
          }
        />
      </div>
    </Section>
  );
}

export function Teaming() {
  const s = useActivePursuit();
  const r = useResult();
  const update = useStore((st) => st.updateActive);

  return (
    <Section
      title="Teaming"
      sub="Subcontractors are built bottom-up: sub cost plus prime handling. The prime takes the residual of total price after subs. Shares feed the per-milestone prime/sub split on the schedule."
    >
      <div className="card flush">
        <div className="ch">
          <h3>Subcontractors & Prime Split</h3>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Party</th>
                <th className="num">Sub Cost (input)</th>
                <th className="num">Handling</th>
                <th className="num">Party Price</th>
                <th className="num">Share</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.teaming.map((t, i) => {
                const d = r.teaming[i] || { handling: 0, price: 0, share: 0 };
                return (
                  <tr key={i}>
                    <td>
                      <TextCell
                        value={t.party}
                        onCommit={(v) =>
                          update((p) => {
                            p.teaming[i].party = v;
                          })
                        }
                      />
                    </td>
                    <td className="num">
                      <NumCell
                        value={t.subCost}
                        onCommit={(v) =>
                          update((p) => {
                            p.teaming[i].subCost = v;
                          })
                        }
                      />
                    </td>
                    <td className="num calc dim">{money0(d.handling)}</td>
                    <td className="num calc">
                      <b>{money0(d.price)}</b>
                    </td>
                    <td className="num calc">{pct(d.share, 2)}</td>
                    <td>
                      <DeleteRowButton
                        onClick={() =>
                          update((p) => {
                            p.teaming.splice(i, 1);
                          })
                        }
                      />
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td>
                  <b>Prime (residual)</b>
                </td>
                <td className="num calc dim">—</td>
                <td className="num calc dim">—</td>
                <td className="num calc">
                  <b>{money0(r.prime)}</b>
                </td>
                <td className="num calc">{pct(r.primeShare, 2)}</td>
                <td />
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>TOTAL</td>
                <td className="num">—</td>
                <td className="num">—</td>
                <td className="num">{money0(r.total)}</td>
                <td className="num">100.00%</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <AddRowButton
          label="Add subcontractor"
          onClick={() =>
            update((p) => {
              p.teaming.push({ party: 'Subcontractor ' + (p.teaming.length + 1), subCost: 0 });
            })
          }
        />
      </div>
    </Section>
  );
}
