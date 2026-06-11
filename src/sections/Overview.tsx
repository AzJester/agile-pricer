import { NumInput, SelectField, TextInput, Toggle } from '../components/inputs';
import { Callout, Card, Legend, Section } from '../components/ui';
import type { ControlInputs } from '../engine';
import { useActivePursuit, useStore } from '../state/store';

export function Overview() {
  const s = useActivePursuit();
  const update = useStore((st) => st.updateActive);
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
          {numField('Base Period (Phase 1)', 'baseMonths', 'months · ALIN 001 exercised')}
          {numField('Option Period (Phase 2)', 'optionMonths', 'months · ALIN 002 option')}
        </div>
      </Card>
      <Card title="Cadence & Capacity">
        <div className="cgrid">
          {numField('Sprint length', 'sprintLengthWeeks', 'weeks')}
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
