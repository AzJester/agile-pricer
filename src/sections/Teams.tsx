import { NumCell, TextInput } from '../components/inputs';
import { AddRowButton, Card, DeleteRowButton, Section } from '../components/ui';
import { newRowId } from '../engine';
import { fmt0, money0 } from '../lib/format';
import { useActivePursuit, useStore } from '../state/store';
import { useResult } from '../state/useResult';

export function Teams() {
  const s = useActivePursuit();
  const r = useResult();
  const update = useStore((st) => st.updateActive);
  const showToast = useStore((st) => st.showToast);
  const A = s.archetypes;

  const renameArch = (i: number, name: string) =>
    update((p) => {
      const old = p.archetypes[i].name;
      if (!name || name === old) return;
      p.archetypes[i].name = name;
      for (const b of p.backlog) if (b.archetype === old) b.archetype = name;
      for (const t of p.capacity.tiers) {
        if (t.teams && old in t.teams) {
          t.teams[name] = t.teams[old];
          delete t.teams[old];
        }
      }
    });

  const delArch = (i: number) => {
    if (A.length <= 1) {
      showToast('Keep at least one archetype');
      return;
    }
    update((p) => {
      p.archetypes.splice(i, 1);
    });
  };

  return (
    <Section
      title="Team Archetypes"
      sub="Define standard team shapes by headcount per LCAT. Cost per team-sprint = Σ(headcount × loaded Yr1 rate) × productive hours/sprint. Backlog rows draw velocity and team cost from the archetype they reference. Use the bin icon by an archetype name to remove it; at least one must remain."
    >
      <div className="card flush">
        <div className="ch">
          <h3>Archetype Headcount Matrix</h3>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>LCAT</th>
                {A.map((a, i) => (
                  <th key={i} className="num">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                      <TextInput className="cellinput text" value={a.name} onCommit={(v) => renameArch(i, v)} />
                      <DeleteRowButton title="Remove this archetype" onClick={() => delArch(i)} />
                    </div>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {s.rates.map((rate) => (
                <tr key={rate.lcat}>
                  <td>{rate.lcat}</td>
                  {A.map((a, i) => (
                    <td key={i} className="num">
                      <NumCell
                        value={(a.hc || {})[rate.lcat] || 0}
                        onCommit={(v) =>
                          update((p) => {
                            p.archetypes[i].hc[rate.lcat] = v;
                          })
                        }
                      />
                    </td>
                  ))}
                  <td />
                </tr>
              ))}
              <tr>
                <td>
                  <b>Total headcount</b>
                </td>
                {A.map((a, i) => (
                  <td key={i} className="num calc">
                    <b>{s.rates.reduce((t, rate) => t + ((a.hc || {})[rate.lcat] || 0), 0)}</b>
                  </td>
                ))}
                <td />
              </tr>
              <tr>
                <td>Cost / team-sprint (Yr1)</td>
                {A.map((a, i) => (
                  <td key={i} className="num calc">
                    {money0(r.archMap[a.name]?.cps ?? 0)}
                  </td>
                ))}
                <td />
              </tr>
              <tr>
                <td>Steady velocity (pts/sprint)</td>
                {A.map((a, i) => (
                  <td key={i} className="num">
                    <NumCell
                      value={a.velocity}
                      onCommit={(v) =>
                        update((p) => {
                          p.archetypes[i].velocity = v;
                        })
                      }
                    />
                  </td>
                ))}
                <td />
              </tr>
              <tr>
                <td># teams of this archetype</td>
                {A.map((a, i) => (
                  <td key={i} className="num">
                    <NumCell
                      value={a.teams}
                      onCommit={(v) =>
                        update((p) => {
                          p.archetypes[i].teams = v;
                        })
                      }
                    />
                  </td>
                ))}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <AddRowButton
          label="Add archetype"
          onClick={() =>
            update((p) => {
              const hc: Record<string, number> = {};
              for (const rate of p.rates) hc[rate.lcat] = 0;
              p.archetypes.push({
                id: newRowId(),
                name: 'Team ' + String.fromCharCode(65 + p.archetypes.length),
                velocity: 40,
                teams: 1,
                hc,
              });
            })
          }
        />
      </div>
      <Card title="Capacity Model">
        <div className="cgrid">
          <div className="field">
            <label>Program duration</label>
            <span className="mono">{r.progMonths} months</span>
          </div>
          <div className="field">
            <label>Working sprints over PoP (per team)</label>
            <span className="mono">{r.wsPoP}</span>
          </div>
          <div className="field">
            <label>Total team-sprints of capacity</label>
            <span className="mono">{fmt0(r.totalCapacity)}</span>
          </div>
          <div className="field">
            <label>Blended cost / team-sprint (Yr1)</label>
            <span className="mono">{money0(r.blendedCps)}</span>
          </div>
        </div>
      </Card>
    </Section>
  );
}
