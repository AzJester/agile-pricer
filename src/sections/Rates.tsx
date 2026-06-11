import { useRef, useState } from 'react';
import { promptDialog } from '../components/dialogs';
import { NumCell, OptionalNumInput, SelectCell, TextCell, Toggle } from '../components/inputs';
import { AddRowButton, Card, DeleteRowButton, Legend, Note, Section, TipBox } from '../components/ui';
import type { LaborRate } from '../engine';
import { parseRatesCsv, readFileAsText } from '../export/json';
import { fmt2, pct } from '../lib/format';
import { useActivePursuit, useStore } from '../state/store';
import { useResult } from '../state/useResult';

export function Rates() {
  const s = useActivePursuit();
  const r = useResult();
  const update = useStore((st) => st.updateActive);
  const rateLibrary = useStore((st) => st.rateLibrary);
  const applyRateSet = useStore((st) => st.applyRateSet);
  const saveRateSet = useStore((st) => st.saveRateSet);
  const showToast = useStore((st) => st.showToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showYears, setShowYears] = useState(() => s.rates.some((x) => Array.isArray(x.directByYear)));
  const yearsN = r.yearsN;

  const setDirectYear = (i: number, y: number, v: number | null) =>
    update((p) => {
      const rate = p.rates[i];
      const cur = Array.isArray(rate.directByYear) ? [...rate.directByYear] : [];
      while (cur.length < y + 1) cur.push(null);
      cur[y] = v;
      rate.directByYear = cur.some((x) => x !== null) ? cur : undefined;
    });

  const setRate = (i: number, key: keyof LaborRate, v: string | number) =>
    update((p) => {
      const old = p.rates[i].lcat;
      (p.rates[i] as unknown as Record<string, unknown>)[key] = v;
      // Renaming an LCAT keeps archetype headcounts, LOE, and support lines attached.
      if (key === 'lcat' && v !== old && typeof v === 'string') {
        for (const a of p.archetypes) {
          if (a.hc && old in a.hc) {
            a.hc[v] = a.hc[old];
            delete a.hc[old];
          }
        }
        for (const l of p.loe) if (l.lcat === old) l.lcat = v;
        for (const l of p.psupport) if (l.lcat === old) l.lcat = v;
      }
    });

  const addRate = () =>
    update((p) => {
      let n = 'New LCAT';
      let k = 1;
      while (p.rates.some((x) => x.lcat === n)) n = 'New LCAT ' + ++k;
      p.rates.push({ lcat: n, direct: 80, rateBasis: '' });
      for (const a of p.archetypes) a.hc[n] = 0;
    });

  const importCsv = async (file: File) => {
    try {
      const rows = parseRatesCsv(await readFileAsText(file));
      if (!rows.length) {
        showToast('Could not parse CSV (expected LCAT,Direct)');
        return;
      }
      update((p) => {
        for (const { lcat, direct } of rows) {
          const ex = p.rates.find((x) => x.lcat === lcat);
          if (ex) ex.direct = direct;
          else {
            p.rates.push({ lcat, direct, rateBasis: '' });
            for (const a of p.archetypes) a.hc[lcat] = a.hc[lcat] || 0;
          }
        }
      });
      showToast(`Imported ${rows.length} rate rows`);
    } catch {
      showToast('Could not read the CSV file');
    }
  };

  const wrap = (1 + s.control.fringe) * (1 + s.control.overhead) * (1 + s.control.gna);

  return (
    <Section
      title="Labor Rates"
      sub="Direct rate is the blue input. Fully loaded Year-1 rate = direct × (1+fringe) × (1+OH) × (1+G&A). For to-be-hired roles, set the basis to Survey / HR3D and record the YOE, degree, and location that produced the rate; for proposed incumbents, use Actual staff."
    >
      <TipBox>
        Tag <b>every</b> rate with a basis. Use <b>Actual staff</b> when you are proposing a named incumbent, and{' '}
        <b>Survey / HR3D</b> for a to-be-hired role, recording the YOE, degree, and location that produced the number. An
        untagged rate raises an advisory and is hard to defend in a cost review.
      </TipBox>
      <Card title="Indirect-Rate Library">
        <div className="cgrid">
          <div className="field">
            <label>
              Apply a saved indirect set<span className="hint">sets fringe / OH / G&A</span>
            </label>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) applyRateSet(e.target.value);
              }}
            >
              <option value="">Select…</option>
              {rateLibrary.map((set) => (
                <option key={set.name} value={set.name}>
                  {set.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Current wrap (loaded / direct)</label>
            <span className="mono">{wrap.toFixed(4)}×</span>
          </div>
        </div>
        <Legend>
          <span>Fringe {pct(s.control.fringe)}</span>
          <span>OH {pct(s.control.overhead)}</span>
          <span>G&A {pct(s.control.gna)}</span>
          <span>
            <button
              type="button"
              className="tbtn solid"
              onClick={async () => {
                const name = await promptDialog('Name this indirect-rate set:', 'Custom ' + (rateLibrary.length + 1));
                if (name) saveRateSet(name);
              }}
            >
              Save current as a set
            </button>
          </span>
        </Legend>
        <Note style={{ marginTop: 10, marginBottom: 0 }}>
          Switching a set rewrites the wrap rates for this pursuit only. Use it to compare a full government burden against a
          lighter past-performance or commercial basis.
        </Note>
      </Card>
      <div className="card flush">
        <div className="ch">
          <h3>Fully Loaded Rate Build & Basis</h3>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Toggle
              label={`FPRA per-year rates (${yearsN} yrs)`}
              checked={showYears}
              onCommit={(v) => setShowYears(v)}
            />
            <button type="button" className="tbtn solid" onClick={() => fileRef.current?.click()}>
              Import CSV
            </button>
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importCsv(f);
              e.target.value = '';
            }}
          />
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Labor Category (LCAT)</th>
                <th className="num">Direct $/hr (Yr1)</th>
                {showYears &&
                  Array.from({ length: yearsN - 1 }, (_, y) => (
                    <th key={y} className="num">
                      Yr{y + 2} $/hr
                    </th>
                  ))}
                <th>Rate Basis</th>
                <th>Skill</th>
                <th className="num">YOE</th>
                <th>Degree</th>
                <th>Location/Market</th>
                <th>Clearance</th>
                <th>Source</th>
                <th className="num">Loaded Yr1 $/hr</th>
              </tr>
            </thead>
            <tbody>
              {s.rates.map((rate, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <DeleteRowButton
                        title="Remove this labor category"
                        onClick={() =>
                          update((p) => {
                            p.rates.splice(i, 1);
                          })
                        }
                      />
                      <TextCell value={rate.lcat} onCommit={(v) => setRate(i, 'lcat', v)} />
                    </div>
                  </td>
                  <td className="num">
                    <NumCell value={rate.direct} onCommit={(v) => setRate(i, 'direct', v)} />
                  </td>
                  {showYears &&
                    Array.from({ length: yearsN - 1 }, (_, y) => (
                      <td key={y} className="num">
                        <OptionalNumInput
                          className="cellinput num"
                          placeholder={(rate.direct * Math.pow(1 + s.control.escalation, y + 1)).toFixed(2)}
                          value={rate.directByYear?.[y + 1] ?? ''}
                          onCommit={(v) => setDirectYear(i, y + 1, v)}
                        />
                      </td>
                    ))}
                  <td>
                    <SelectCell
                      value={rate.rateBasis || ''}
                      options={[
                        { value: '', label: '— set basis —' },
                        { value: 'actual', label: 'Actual staff' },
                        { value: 'survey', label: 'Survey / HR3D' },
                      ]}
                      onCommit={(v) => setRate(i, 'rateBasis', v)}
                    />
                  </td>
                  <td>
                    <SelectCell
                      value={rate.skill || ''}
                      options={['', 'Junior', 'Mid', 'Senior', 'Principal', 'SME'].map((o) => ({
                        value: o,
                        label: o || '— level —',
                      }))}
                      onCommit={(v) => setRate(i, 'skill', v)}
                    />
                  </td>
                  <td className="num">
                    <NumCell value={rate.yoe ?? ''} onCommit={(v) => setRate(i, 'yoe', v)} />
                  </td>
                  <td>
                    <TextCell value={rate.degree || ''} onCommit={(v) => setRate(i, 'degree', v)} />
                  </td>
                  <td>
                    <TextCell value={rate.location || ''} onCommit={(v) => setRate(i, 'location', v)} />
                  </td>
                  <td>
                    <TextCell value={rate.clearance || ''} onCommit={(v) => setRate(i, 'clearance', v)} />
                  </td>
                  <td>
                    <TextCell value={rate.source || ''} onCommit={(v) => setRate(i, 'source', v)} />
                  </td>
                  <td className="num calc">
                    <b>${fmt2(r.loaded[rate.lcat] || 0)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AddRowButton label="Add labor category" onClick={addRate} />
      </div>
    </Section>
  );
}
