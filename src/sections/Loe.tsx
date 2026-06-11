import { NumCell, SelectCell, TextCell, Toggle } from '../components/inputs';
import { AddRowButton, Callout, DeleteRowButton, Section, TipBox } from '../components/ui';
import { newRowId, type LoeLine, type Phase, type PSupportLine } from '../engine';
import { money0 } from '../lib/format';
import { useActivePursuit, useStore } from '../state/store';
import { useResult } from '../state/useResult';

function periodOptions(s: { control: { periods: { label: string }[] } }) {
  return s.control.periods.map((p, i) => ({ value: String(i + 1), label: `${i + 1} · ${p.label}` }));
}

export function Loe() {
  const s = useActivePursuit();
  const r = useResult();
  const update = useStore((st) => st.updateActive);
  const lcatOptions = s.rates.map((x) => ({ value: x.lcat }));
  const PHASE_OPTIONS = periodOptions(s);

  const set = (i: number, key: keyof LoeLine, v: string | number) =>
    update((p) => {
      (p.loe[i] as unknown as Record<string, unknown>)[key] = v;
    });

  return (
    <Section
      title="Persistent Level-of-Effort"
      sub="Staffed, time-based effort that is not story-point work — cATO sustainment, 24/7 operations, on-call. Monthly cost = FTE × loaded rate × 173.2 hrs × escalation(rate year). Phase 1 vs 2 feeds the milestone allocation."
    >
      <TipBox>
        LOE prices steady-state operations (cATO, help desk, 24/7 ops) that never burn down the backlog: FTE × loaded rate × 173.2 hours/month × months, starting at the chosen period. Set <b>Rate Yr</b> to price option-year staffing at escalated rates.
      </TipBox>
      <div className="card flush">
        <div className="ch">
          <h3>LOE Lines</h3>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Function</th>
                <th>LCAT</th>
                <th className="num">FTE</th>
                <th className="num">Period</th>
                <th className="num">Months</th>
                <th className="num">Rate Yr</th>
                <th className="num">Monthly</th>
                <th className="num">LOE Cost</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.loe.map((l, i) => {
                const der = r.loeRows[i] || { monthly: 0, cost: 0 };
                return (
                  <tr key={l.id ?? i}>
                    <td>
                      <TextCell value={l.fn} onCommit={(v) => set(i, 'fn', v)} />
                    </td>
                    <td>
                      <SelectCell value={l.lcat} options={lcatOptions} onCommit={(v) => set(i, 'lcat', v)} />
                    </td>
                    <td className="num">
                      <NumCell value={l.fte} onCommit={(v) => set(i, 'fte', v)} />
                    </td>
                    <td className="num">
                      <SelectCell
                        numeric
                        value={String(l.phase)}
                        options={PHASE_OPTIONS}
                        onCommit={(v) => set(i, 'phase', Number(v) as Phase)}
                      />
                    </td>
                    <td className="num">
                      <NumCell value={l.months} onCommit={(v) => set(i, 'months', v)} />
                    </td>
                    <td className="num">
                      <NumCell value={l.rateYear} onCommit={(v) => set(i, 'rateYear', v)} />
                    </td>
                    <td className="num calc dim">{money0(der.monthly)}</td>
                    <td className="num calc">
                      <b>{money0(der.cost)}</b>
                    </td>
                    <td>
                      <DeleteRowButton
                        onClick={() =>
                          update((p) => {
                            p.loe.splice(i, 1);
                          })
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7}>
                  TOTAL LOE{' '}
                  <span style={{ fontWeight: 600, color: 'var(--muted)' }}>
                    (P1 {money0(r.loeP1)} · P2 {money0(r.loeP2)})
                  </span>
                </td>
                <td className="num">{money0(r.loeTot)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <AddRowButton
          label="Add LOE line"
          onClick={() =>
            update((p) => {
              p.loe.push({ id: newRowId(), fn: 'New LOE', lcat: p.rates[0]?.lcat || '', fte: 1, phase: 1, months: 12, rateYear: 1 });
            })
          }
        />
      </div>
    </Section>
  );
}

export function PSupport() {
  const s = useActivePursuit();
  const r = useResult();
  const update = useStore((st) => st.updateActive);
  const inc = s.control.includePSupport !== false;
  const lcatOptions = s.rates.map((x) => ({ value: x.lcat }));
  const PHASE_OPTIONS = periodOptions(s);

  const set = (i: number, key: keyof PSupportLine, v: string | number) =>
    update((p) => {
      (p.psupport[i] as unknown as Record<string, unknown>)[key] = v;
    });

  return (
    <Section
      title="Program Support Labor"
      sub="Non-sprint labor: program management office, program control / finance analyst, contracts, business management. Costed like LOE (FTE × loaded rate × 173.2 hrs × escalation). Kept separate from delivery teams so you can include it in the priced total or carry it on the pricing side."
      actions={
        <Toggle
          label="Include in priced total"
          checked={inc}
          onCommit={(v) =>
            update((p) => {
              p.control.includePSupport = v;
            })
          }
        />
      }
    >
      <TipBox>
        This prices the office that runs the contract — PM, finance, contracts, business management. The Overview toggle includes or excludes it from the priced total; keep it filled in either way so the internal margin story is complete.
      </TipBox>
      {!inc && (
        <Callout color="var(--supernova)">
          Program support is currently <b>excluded</b> from the priced total. Lines below are tracked but not added to the
          price.
        </Callout>
      )}
      <div className="card flush">
        <div className="ch">
          <h3>Program Support Lines</h3>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Role / Function</th>
                <th>LCAT (rate basis)</th>
                <th className="num">FTE</th>
                <th className="num">Period</th>
                <th className="num">Months</th>
                <th className="num">Rate Yr</th>
                <th className="num">Monthly</th>
                <th className="num">Cost</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.psupport.length === 0 && (
                <tr>
                  <td colSpan={9} className="sub">
                    No program-support lines yet. Add PM, finance, contracts, or business management here.
                  </td>
                </tr>
              )}
              {s.psupport.map((l, i) => {
                const der = r.psRows[i] || { monthly: 0, cost: 0 };
                return (
                  <tr key={l.id ?? i}>
                    <td>
                      <TextCell value={l.role} onCommit={(v) => set(i, 'role', v)} />
                    </td>
                    <td>
                      <SelectCell value={l.lcat} options={lcatOptions} onCommit={(v) => set(i, 'lcat', v)} />
                    </td>
                    <td className="num">
                      <NumCell value={l.fte} onCommit={(v) => set(i, 'fte', v)} />
                    </td>
                    <td className="num">
                      <SelectCell
                        numeric
                        value={String(l.phase)}
                        options={PHASE_OPTIONS}
                        onCommit={(v) => set(i, 'phase', Number(v) as Phase)}
                      />
                    </td>
                    <td className="num">
                      <NumCell value={l.months} onCommit={(v) => set(i, 'months', v)} />
                    </td>
                    <td className="num">
                      <NumCell value={l.rateYear} onCommit={(v) => set(i, 'rateYear', v)} />
                    </td>
                    <td className="num calc dim">{money0(der.monthly)}</td>
                    <td className="num calc">
                      <b>{money0(der.cost)}</b>
                    </td>
                    <td>
                      <DeleteRowButton
                        onClick={() =>
                          update((p) => {
                            p.psupport.splice(i, 1);
                          })
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7}>
                  TOTAL PROGRAM SUPPORT{' '}
                  <span style={{ fontWeight: 600, color: 'var(--muted)' }}>
                    (P1 {money0(r.psP1)} · P2 {money0(r.psP2)})
                  </span>
                </td>
                <td className="num">{money0(r.psTot)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <AddRowButton
          label="Add support role"
          onClick={() =>
            update((p) => {
              p.psupport.push({
                id: newRowId(),
                role: 'Program Control Analyst',
                lcat: p.rates[0]?.lcat || '',
                fte: 0.5,
                phase: 1,
                months: 12,
                rateYear: 1,
              });
            })
          }
        />
      </div>
    </Section>
  );
}
