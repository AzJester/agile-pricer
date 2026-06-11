import { NumCell, TextCell } from '../components/inputs';
import { AddRowButton, Callout, Card, DeleteRowButton, Legend, Note, Pill, Section } from '../components/ui';
import { newRowId, type CapacityInputs } from '../engine';
import { money0, pct } from '../lib/format';
import { useActivePursuit, useStore } from '../state/store';
import { useResult } from '../state/useResult';
import { exportTiersCsv } from '../export/csv';
import { NumInput, SelectCell } from '../components/inputs';

const VEHICLES = ['OTA (Prototype/Production)', 'FFP w/ Priced Options', 'Capacity IDIQ', 'FFP-LOE', 'T&M'];
const DIVIDENDS = ['Reinvested capacity', 'Shared savings', 'None'];
const COLORS = ['O&M', 'RDT&E', 'Procurement', 'Mixed'];

export function Capacity() {
  const s = useActivePursuit();
  const r = useResult();
  const update = useStore((st) => st.updateActive);
  const showToast = useStore((st) => st.showToast);
  const cp = s.capacity;
  const A = s.archetypes;
  const cap = r.capacity;

  const setCap = (key: keyof CapacityInputs, v: string | number) =>
    update((p) => {
      (p.capacity as unknown as Record<string, unknown>)[key] = v;
    });

  const cnum = (label: string, key: keyof CapacityInputs, hint: string) => (
    <div className="field">
      <label>
        {label}
        <span className="hint">{hint}</span>
      </label>
      <NumInput value={cp[key] as number} onCommit={(v) => setCap(key, v)} />
    </div>
  );
  const csel = (label: string, key: keyof CapacityInputs, options: string[], hint: string) => (
    <div className="field">
      <label>
        {label}
        <span className="hint">{hint}</span>
      </label>
      <select value={String(cp[key])} onChange={(e) => setCap(key, e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <Section
      title="Capacity Subscription Tiers"
      sub="An alternative commercial wrapper: the customer funds a level of delivery capacity per option period and reprioritizes through the backlog, rather than buying labor hours. Tier prices are built bottom-up from the same loaded team cost used everywhere else, so they stay defensible. Tiers are menu options the customer chooses between; the figures are not additive."
    >
      <Callout>
        <b>How a tier is priced.</b> Recurring cost / period = Σ(teams × cost per team-sprint) × working sprints in the period,
        plus an ODC allowance with material handling. Price applies the subscription reserve then fee (same shape as the
        program model). Term escalates each option year by the program escalation rate. Reprioritization is free under the
        funded cap; expanding the cap or the nature of work still needs a modification.
      </Callout>
      <Card title="Subscription Controls">
        <div className="cgrid">
          {cnum('Period length', 'periodMonths', 'months per recurring period')}
          {cnum('Option years (term)', 'optionYears', 'periods escalate each year')}
          {cnum('Subscription reserve %', 'reservePct', 'management reserve on capacity')}
          {csel('Contract vehicle', 'vehicle', VEHICLES, 'how capacity is made payable')}
          {csel('Efficiency dividend', 'dividend', DIVIDENDS, 'who captures productivity gains')}
          {csel('Default color of money', 'colorDefault', COLORS, 'appropriation type')}
          {csel('Labor hours basis', 'hoursBasis', ['productive', 'paid'], 'productive sprint hrs vs full payroll')}
        </div>
        <Legend>
          <span>
            Periods / year = <b>{cap.periodsPerYear}</b>
          </span>
          <span>
            Working sprints / period / team = <b>{cap.wsPeriod}</b>
          </span>
          <span>
            Term = <b>{cap.optionYears}</b> option years
          </span>
          <span>
            Fee reused from program = <b>{pct(s.control.fee)}</b>
          </span>
        </Legend>
      </Card>
      <div className="card flush">
        <div className="ch">
          <h3>Delivery-Capacity Tiers</h3>
          <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
            menu options · figures not additive{' '}
            <button type="button" className="tbtn solid" onClick={() => exportTiersCsv(s, r)}>
              Export CSV
            </button>
          </span>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Tier</th>
                <th>Color $</th>
                {A.map((a) => (
                  <th key={a.name} className="num">
                    {a.name}
                    <div className="hint" style={{ fontWeight: 500 }}>
                      teams
                    </div>
                  </th>
                ))}
                <th className="num">Monthly ODC</th>
                <th className="num">Cost / Period</th>
                <th className="num">Recurring Price / Period</th>
                <th className="num">Annual Run-Rate</th>
                <th className="num">Term ({cap.optionYears} yr)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cp.tiers.map((t, i) => {
                const d = cap.tiers[i] || {
                  teamCount: 0,
                  costPeriod: 0,
                  pricePeriod: 0,
                  annualRunRate: 0,
                  termPrice: 0,
                };
                return (
                  <tr key={t.id ?? i}>
                    <td>
                      <TextCell
                        value={t.name}
                        onCommit={(v) =>
                          update((p) => {
                            p.capacity.tiers[i].name = v;
                          })
                        }
                      />
                    </td>
                    <td>
                      <SelectCell
                        value={String(t.color)}
                        options={COLORS.map((c) => ({ value: c }))}
                        onCommit={(v) =>
                          update((p) => {
                            p.capacity.tiers[i].color = v;
                          })
                        }
                      />
                    </td>
                    {A.map((a) => (
                      <td key={a.name} className="num">
                        <NumCell
                          value={(t.teams || {})[a.name] || 0}
                          onCommit={(v) =>
                            update((p) => {
                              p.capacity.tiers[i].teams[a.name] = v;
                            })
                          }
                        />
                      </td>
                    ))}
                    <td className="num">
                      <NumCell
                        value={t.monthlyODC}
                        onCommit={(v) =>
                          update((p) => {
                            p.capacity.tiers[i].monthlyODC = v;
                          })
                        }
                      />
                    </td>
                    <td className="num calc dim">{money0(d.costPeriod)}</td>
                    <td className="num calc">
                      <b>{money0(d.pricePeriod)}</b>
                    </td>
                    <td className="num calc">{money0(d.annualRunRate)}</td>
                    <td className="num calc">
                      <b>{money0(d.termPrice)}</b>
                    </td>
                    <td>
                      <DeleteRowButton
                        onClick={() => {
                          if (cp.tiers.length <= 1) {
                            showToast('Keep at least one tier');
                            return;
                          }
                          update((p) => {
                            p.capacity.tiers.splice(i, 1);
                          });
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <AddRowButton
          label="Add tier"
          onClick={() =>
            update((p) => {
              const teams: Record<string, number> = {};
              for (const a of p.archetypes) teams[a.name] = 0;
              p.capacity.tiers.push({
                id: newRowId(),
                name: 'New Tier',
                color: String(p.capacity.colorDefault || 'O&M'),
                teams,
                monthlyODC: 0,
              });
            })
          }
        />
      </div>
      <Card
        title="Acceptance & Governance"
        actions={<Pill tone={cp.vehicle === 'FFP-LOE' || cp.vehicle === 'T&M' ? 'warn' : 'ok'}>{cp.vehicle}</Pill>}
      >
        <div className="field" style={{ gridColumn: '1/-1', display: 'block' }}>
          <label>
            Acceptance basis (what the Government pays against)
            <span className="hint">objective proxies, not story points — survives audit and protest</span>
          </label>
          <textarea
            rows={3}
            defaultValue={cp.slaNote}
            onBlur={(e) => setCap('slaNote', e.target.value)}
            style={{ width: '100%', marginTop: 6 }}
          />
        </div>
        <div className="field" style={{ gridColumn: '1/-1', display: 'block', marginTop: 10 }}>
          <label>
            Recompete & lock-in mitigations
            <span className="hint">data/IP rights, delivered artifacts, modular design</span>
          </label>
          <textarea
            rows={3}
            defaultValue={cp.mitigationNote}
            onBlur={(e) => setCap('mitigationNote', e.target.value)}
            style={{ width: '100%', marginTop: 6 }}
          />
        </div>
        <Note style={{ marginTop: 10, marginBottom: 0 }}>
          Efficiency dividend is set to <b>{cp.dividend}</b>. Each option year is a separate funding action subject to
          available appropriations; color of money ({String(cp.colorDefault)} default) may differ by tier and cannot always be
          commingled. None of this is legal or contracting advice — confirm the vehicle with your contracts team.
        </Note>
      </Card>
    </Section>
  );
}
