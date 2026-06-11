import { NumCell, NumInput, OptionalNumInput, SelectCell, SelectField, TextCell, TextInput, Toggle } from '../components/inputs';
import { AddRowButton, Callout, Card, DeleteRowButton, Legend, Note, Section, TipBox } from '../components/ui';
import { newRowId, type ControlInputs } from '../engine';
import { pct } from '../lib/format';
import { useActivePursuit, useStore } from '../state/store';
import { useResult } from '../state/useResult';

const COLORS = ['RDT&E', 'O&M', 'Procurement', 'Mixed'];

export function Overview() {
  const s = useActivePursuit();
  const r = useResult();
  const update = useStore((st) => st.updateActive);
  const showToast = useStore((st) => st.showToast);
  const c = s.control;

  const setNum = (key: keyof ControlInputs) => (v: number) =>
    update((p) => {
      (p.control as unknown as Record<string, unknown>)[key] = v;
    });
  const setStr = (key: keyof ControlInputs) => (v: string) =>
    update((p) => {
      (p.control as unknown as Record<string, unknown>)[key] = v;
    });

  const numField = (label: string, key: keyof ControlInputs, hint?: string) => (
    <div className="field">
      <label>
        {label}
        {hint && <span className="hint">{hint}</span>}
      </label>
      <NumInput value={c[key] as number} onCommit={setNum(key)} />
    </div>
  );

  return (
    <Section
      title="Overview & Control"
      sub="Global switches and assumptions. These drive every downstream sheet: rates, capacity, escalation, reserve, fee, and the milestone payment schedule. Edit the blue values."
    >
      <TipBox>
        Set this tab up first — periods, cadence, wrap rates, reserve method — because every other tab prices against it. Exploring a what-if? <b>Duplicate</b> the pursuit (⋯ menu, top bar) and edit the copy; Scenario Compare shows the deltas side by side, and Undo (Ctrl+Z) reverses any edit.
      </TipBox>
      <Callout>
        <b>Reusable across pursuits.</b> Start from the reference baseline or create a blank pursuit (New). Each pursuit saves
        automatically in your browser; use Export JSON to share or archive. Ships with illustrative placeholders and contains
        no CUI — populate controlled data only in an accredited environment.
      </Callout>
      <Card title="Pursuit Identity">
        <div className="cgrid">
          <div className="field">
            <label>
              Scenario label<span className="hint">label for this run</span>
            </label>
            <TextInput className="text" value={c.scenario} onCommit={setStr('scenario')} />
          </div>
          <div className="field">
            <label>
              Period of Performance — start<span className="hint">drives milestone dates</span>
            </label>
            <TextInput className="text" type="date" value={c.popStart} onCommit={setStr('popStart')} />
          </div>
        </div>
      </Card>
      <div className="card flush">
        <div className="ch">
          <h3>Contract Periods</h3>
          <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
            {r.progMonths} months total · {c.periods.length} period{c.periods.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>ALIN</th>
                <th>Period</th>
                <th className="num">Months</th>
                <th className="num">Starts (mo.)</th>
                <th>Color of money</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {c.periods.map((p, i) => (
                <tr key={p.id ?? i}>
                  <td className="calc dim">ALIN {String(i + 1).padStart(3, '0')}</td>
                  <td>
                    <TextCell
                      value={p.label}
                      onCommit={(v) =>
                        update((x) => {
                          x.control.periods[i].label = v;
                        })
                      }
                    />
                  </td>
                  <td className="num">
                    <NumCell
                      value={p.months}
                      onCommit={(v) =>
                        update((x) => {
                          x.control.periods[i].months = Math.max(1, v);
                        })
                      }
                    />
                  </td>
                  <td className="num calc dim">{r.periods[i]?.startMonth ?? 0}</td>
                  <td>
                    <SelectCell
                      value={String(p.color)}
                      options={COLORS.map((o) => ({ value: o }))}
                      onCommit={(v) =>
                        update((x) => {
                          x.control.periods[i].color = v;
                        })
                      }
                    />
                  </td>
                  <td>
                    <DeleteRowButton
                      title="Remove this period"
                      onClick={() => {
                        if (c.periods.length <= 1) {
                          showToast('Keep at least one period');
                          return;
                        }
                        update((x) => {
                          x.control.periods.splice(i, 1);
                        });
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AddRowButton
          label="Add option period"
          onClick={() =>
            update((x) => {
              x.control.periods.push({ id: newRowId(), label: `Option ${x.control.periods.length}`, months: 12, color: 'O&M' });
            })
          }
        />
        <Note style={{ margin: '0 16px 14px' }}>
          Each period is its own ALIN and funding action. Milestones, LOE, program support, and row-phased ODC reference a
          period by number; the milestone schedule, funding view, and exports group by period. Removing a period re-clamps
          rows that pointed at it to the last remaining period.
        </Note>
      </div>
      <Card title="Cadence & Capacity">
        <div className="cgrid">
          {/* sprintLengthWeeks is intentionally not editable here: no
              computation reads it, so an input would imply price impact. */}
          {numField('Productive hours / sprint / FTE', 'productiveHrs', 'net of leave & ceremonies')}
          {numField('Working sprints / year', 'workingSprintsYr', '~26 less holiday / IPM')}
        </div>
      </Card>
      <Card title="Wrap Rates & Economics">
        <div className="cgrid">
          {numField('Fringe rate', 'fringe', 'of direct')}
          {numField('Overhead rate', 'overhead', 'of direct + fringe')}
          {numField('G&A rate', 'gna', 'of direct + fringe + OH')}
          {numField('G&A on ODC / materials', 'gnaODC', 'material handling on ODC')}
          {numField('Fee / margin (OT)', 'fee', 'negotiated margin on cost')}
          {numField('Escalation / year', 'escalation', 'labor & ODC, compounded by PI year')}
          {numField('Subcontractor handling fee', 'subHandling', 'prime handling on sub cost')}
        </div>
        <div className="field" style={{ display: 'block', borderBottom: 0 }}>
          <label>
            Escalation overrides by year
            <span className="hint">
              optional per-year steps (Yr1→Yr2 first); blank = use the {pct(c.escalation)} default
            </span>
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            {Array.from({ length: Math.max(1, r.yearsN - 1) }, (_, y) => (
              <div key={y} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="hint">
                  Yr{y + 1}→{y + 2}
                </span>
                <OptionalNumInput
                  style={{ width: 90 }}
                  step={0.005}
                  placeholder={String(c.escalation)}
                  value={c.escalationByYear?.[y] ?? ''}
                  onCommit={(v) =>
                    update((x) => {
                      const cur = Array.isArray(x.control.escalationByYear) ? [...x.control.escalationByYear] : [];
                      while (cur.length < y + 1) cur.push(null);
                      cur[y] = v;
                      x.control.escalationByYear = cur.some((e) => e !== null) ? cur : undefined;
                    })
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </Card>
      <Card title="Confidence, Reserve & Targets">
        <div className="cgrid">
          <SelectField
            label="Confidence level for price"
            hint="sets the quoted price"
            value={c.confidence}
            options={['P50', 'P80']}
            onCommit={setStr('confidence')}
          />
          <SelectField
            label="Reserve method"
            hint="spread/CoV vs manual"
            value={c.reserveMethod}
            options={['Spread', 'Manual']}
            onCommit={setStr('reserveMethod')}
          />
          {numField('Manual reserve %', 'manualReserve', 'used only if method = Manual')}
          {numField('Price-to-win adjustment', 'ptw', 'competitive +/- on price')}
          {numField('Budget ceiling', 'budgetCeiling', 'RPP anticipated budget ($)')}
          {numField('Round milestones to', 'roundTo', 'whole-dollar rounding ($)')}
        </div>
        <Legend>
          <span>
            <b>Blue</b> = input you change
          </span>
          <span>Black = calculated</span>
          <span>Reserve uses the larger of estimate spread or velocity CoV unless set to Manual.</span>
        </Legend>
      </Card>
      <Card title="Methodology Options">
        <div className="cgrid">
          <SelectField
            label="ODC phasing"
            hint="year-index (default) vs per-row phase"
            value={c.odcPhasing}
            options={['year', 'row']}
            onCommit={setStr('odcPhasing')}
          />
          <SelectField
            label="Milestone rounding plug"
            hint="where the rounding residual lands"
            value={c.plugMode}
            options={['last', 'perPhase', 'largest']}
            onCommit={setStr('plugMode')}
          />
          {numField('Paid hours / sprint / FTE', 'paidHrs', 'full-payroll basis for capacity tiers')}
          {numField('Subcontractor fee', 'subFee', 'optional fee on sub cost+handling')}
          {numField('Fixed-cost burden', 'fixedBurden', 'indirect loaded on fixed line items')}
        </div>
        <Legend>
          <span>Defaults (year · last · no sub fee · 0 fixed burden) reproduce the validated baseline.</span>
          <span>
            <b>perPhase</b> ties each phase to its own cost basis.
          </span>
          <span>
            <Toggle
              label="Include program-support labor in priced total"
              checked={c.includePSupport !== false}
              onCommit={(v) =>
                update((p) => {
                  p.control.includePSupport = v;
                })
              }
            />
          </span>
        </Legend>
      </Card>
    </Section>
  );
}
