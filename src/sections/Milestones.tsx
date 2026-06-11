import React, { useState } from 'react';
import { NumCell, SelectCell, TextCell, TextInput } from '../components/inputs';
import { AddRowButton, DeleteRowButton, Section, TipBox } from '../components/ui';
import { newRowId, type Milestone, type Phase } from '../engine';
import { addMonths, money0, pct } from '../lib/format';
import { useActivePursuit, useStore } from '../state/store';
import { useResult } from '../state/useResult';


export function Milestones() {
  const s = useActivePursuit();
  const r = useResult();
  const update = useStore((st) => st.updateActive);
  const PHASE_OPTIONS = s.control.periods.map((p, i) => ({ value: String(i + 1), label: `${i + 1} · ${p.label}` }));

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
      <TipBox>
        Milestone names are the join key: backlog labor maps here by exact name match, and renaming a milestone updates its backlog rows automatically. Month offsets drive completion dates and the funding-by-FY rollup; the rounding plug keeps the schedule tied to the total.
      </TipBox>
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
                <th className="num">Period</th>
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
                <tr key={m.id ?? i}>
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
                id: newRowId(),
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
  const [openLines, setOpenLines] = useState<Record<number, boolean>>({});

  return (
    <Section
      title="Teaming"
      sub="Subcontractors carry their cost plus prime handling; the prime takes the residual of total price after subs. Enter a sub's cost manually, or expand a row to build it bottom-up from the sub's fully burdened rates × hours. Shares feed the per-milestone prime/sub split on the schedule."
    >
      <TipBox>
        Enter each sub at cost — handling and any sub fee stack on top, and the prime takes the residual of total price. Expand a row to build the sub bottom-up from burdened rates × hours when you hold their quote.
      </TipBox>
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
                const d = r.teaming[i] || { handling: 0, price: 0, share: 0, fromLines: false, effectiveSubCost: 0 };
                const lines = t.lines || [];
                return (
                  <React.Fragment key={t.id ?? i}>
                    <tr>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            className="tbtn"
                            style={{
                              background: 'var(--paper)',
                              color: 'var(--force)',
                              borderColor: 'var(--line-2)',
                              padding: '2px 8px',
                            }}
                            title="Bottom-up labor lines"
                            onClick={() => setOpenLines((o) => ({ ...o, [i]: !o[i] }))}
                          >
                            {openLines[i] ? '▾' : '▸'} {lines.length ? `${lines.length} lines` : 'lines'}
                          </button>
                          <TextCell
                            value={t.party}
                            onCommit={(v) =>
                              update((p) => {
                                p.teaming[i].party = v;
                              })
                            }
                          />
                        </div>
                      </td>
                      <td className="num">
                        {d.fromLines ? (
                          <span className="calc" title="Sum of bottom-up lines">
                            {money0(d.effectiveSubCost)}
                          </span>
                        ) : (
                          <NumCell
                            value={t.subCost}
                            onCommit={(v) =>
                              update((p) => {
                                p.teaming[i].subCost = v;
                              })
                            }
                          />
                        )}
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
                    {openLines[i] && (
                      <tr>
                        <td colSpan={6} style={{ background: '#fafbfd', padding: '8px 16px 12px 40px' }}>
                          <table style={{ maxWidth: 640 }}>
                            <thead>
                              <tr>
                                <th>Sub role / task</th>
                                <th className="num">Burdened $/hr</th>
                                <th className="num">Hours</th>
                                <th className="num">Cost</th>
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {lines.map((l, li) => (
                                <tr key={l.id ?? li}>
                                  <td>
                                    <TextCell
                                      value={l.role}
                                      onCommit={(v) =>
                                        update((p) => {
                                          p.teaming[i].lines![li].role = v;
                                        })
                                      }
                                    />
                                  </td>
                                  <td className="num">
                                    <NumCell
                                      value={l.rate}
                                      onCommit={(v) =>
                                        update((p) => {
                                          p.teaming[i].lines![li].rate = v;
                                        })
                                      }
                                    />
                                  </td>
                                  <td className="num">
                                    <NumCell
                                      value={l.hours}
                                      onCommit={(v) =>
                                        update((p) => {
                                          p.teaming[i].lines![li].hours = v;
                                        })
                                      }
                                    />
                                  </td>
                                  <td className="num calc">{money0(l.rate * l.hours)}</td>
                                  <td>
                                    <DeleteRowButton
                                      onClick={() =>
                                        update((p) => {
                                          p.teaming[i].lines!.splice(li, 1);
                                          if (!p.teaming[i].lines!.length) delete p.teaming[i].lines;
                                        })
                                      }
                                    />
                                  </td>
                                </tr>
                              ))}
                              {!lines.length && (
                                <tr>
                                  <td colSpan={5} className="sub">
                                    No lines. Manual sub cost applies until lines are added.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                          <button
                            type="button"
                            className="addrow"
                            style={{ margin: '8px 0 0' }}
                            onClick={() =>
                              update((p) => {
                                if (!Array.isArray(p.teaming[i].lines)) p.teaming[i].lines = [];
                                p.teaming[i].lines!.push({ id: newRowId(), role: 'Sub role', rate: 150, hours: 1000 });
                              })
                            }
                          >
                            + Add labor line
                          </button>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
              p.teaming.push({ id: newRowId(), party: 'Subcontractor ' + (p.teaming.length + 1), subCost: 0 });
            })
          }
        />
      </div>
    </Section>
  );
}
