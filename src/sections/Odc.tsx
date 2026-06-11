import { NumCell, SelectCell, TextCell } from '../components/inputs';
import { AddRowButton, Card, DeleteRowButton, Note, Section, TipBox } from '../components/ui';
import { newRowId, type OdcLine } from '../engine';
import { money0 } from '../lib/format';
import { useActivePursuit, useStore } from '../state/store';
import { useResult } from '../state/useResult';

const CHECKLIST = [
  'Cloud / hosting',
  'Software licenses',
  'Hardware / lab',
  'Travel',
  'Training environment',
  'Certification & accreditation (cATO/ATO)',
  'GFE / GFP gaps',
  'Data / storage egress',
  'Shipping & logistics',
  'Surge / contingency ODC',
];

export function Odc() {
  const s = useActivePursuit();
  const r = useResult();
  const update = useStore((st) => st.updateActive);
  const yN = r.yearsN;
  const rowPhased = s.control.odcPhasing === 'row';
  const PHASE_OPTIONS = s.control.periods.map((p, i) => ({ value: String(i + 1), label: `${i + 1} · ${p.label}` }));

  const set = (i: number, key: keyof OdcLine, v: string | number) =>
    update((p) => {
      (p.odc[i] as unknown as Record<string, unknown>)[key] = v;
    });

  const have = (cat: string) =>
    s.odc.some((o) => ((o.cat || '') + (o.item || '')).toLowerCase().includes(cat.split(' ')[0].toLowerCase()));

  return (
    <Section
      title="Other Direct Costs"
      sub="Non-labor, entered in Year-1 dollars and escalated per year. Material handling (G&A on ODC) is added. Record a basis for each line (unit × quantity × periods) so the estimate is defensible. Year-1 spend phases to the base period; later years to the option period."
    >
      <TipBox>
        Enter Year-1 dollars per program year — escalation and material handling are applied for you. Dollars beyond the period of performance raise an advisory instead of pricing silently; extend the PoP or trim those year columns.
      </TipBox>
      <Card title="Completeness Checklist">
        <div>
          {CHECKLIST.map((cat) => {
            const present = have(cat);
            return (
              <span
                key={cat}
                className={'pill ' + (present ? 'ok' : 'warn')}
                style={{ margin: '3px 6px 3px 0', display: 'inline-block' }}
              >
                {present ? '✓' : '•'} {cat}
              </span>
            );
          })}
        </div>
        <Note style={{ marginTop: 10, marginBottom: 0 }}>
          A check means a line touching that category exists. Dots are categories estimators routinely miss. They are prompts,
          not requirements: if one truly does not apply, leave it and note why in the basis field of a related line.
        </Note>
      </Card>
      <div className="card flush">
        <div className="ch">
          <h3>ODC by Year</h3>
          <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
            P1 {money0(r.odcP1)} · P2 {money0(r.odcP2)}
          </span>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Basis (unit × qty × periods)</th>
                {rowPhased && <th className="num">Period</th>}
                {Array.from({ length: yN }, (_, y) => (
                  <th key={y} className="num">
                    Yr {y + 1} $
                  </th>
                ))}
                <th className="num">Escalated</th>
                <th className="num">+ Handling</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.odc.map((o, i) => {
                const der = r.odcRows[i] || { escTotal: 0, withH: 0 };
                return (
                  <tr key={o.id ?? i}>
                    <td>
                      <TextCell value={o.item} onCommit={(v) => set(i, 'item', v)} />
                    </td>
                    <td>
                      <TextCell value={o.cat} onCommit={(v) => set(i, 'cat', v)} />
                    </td>
                    <td>
                      <TextCell value={o.basis || ''} onCommit={(v) => set(i, 'basis', v)} />
                    </td>
                    {rowPhased && (
                      <td className="num">
                        <SelectCell
                          numeric
                          value={String(o.phase)}
                          options={PHASE_OPTIONS}
                          onCommit={(v) => set(i, 'phase', Number(v))}
                        />
                      </td>
                    )}
                    {Array.from({ length: yN }, (_, y) => (
                      <td key={y} className="num">
                        <NumCell
                          value={(o.years || [])[y] || 0}
                          onCommit={(v) =>
                            update((p) => {
                              p.odc[i].years[y] = v;
                            })
                          }
                        />
                      </td>
                    ))}
                    <td className="num calc dim">{money0(der.escTotal)}</td>
                    <td className="num calc">
                      <b>{money0(der.withH)}</b>
                    </td>
                    <td>
                      <DeleteRowButton
                        onClick={() =>
                          update((p) => {
                            p.odc.splice(i, 1);
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
                <td colSpan={(rowPhased ? 4 : 3) + yN}>TOTAL ODC</td>
                <td className="num">{money0(r.odcRows.reduce((a, x) => a + x.escTotal, 0))}</td>
                <td className="num">{money0(r.odcTot)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <AddRowButton
          label="Add ODC item"
          onClick={() =>
            update((p) => {
              p.odc.push({ id: newRowId(), item: 'New ODC', cat: 'ODC', phase: 1, years: Array(yN).fill(0) });
            })
          }
        />
      </div>
    </Section>
  );
}
