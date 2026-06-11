import { useMemo, useRef, useState } from 'react';
import { useFocusTrap } from './dialogs';
import {
  buildBacklogItems,
  guessColumn,
  parseDelimited,
  type BacklogField,
  type ImportOptions,
} from '../lib/importBacklog';
import { useActivePursuit, useStore } from '../state/store';

const FIELD_LABELS: Record<BacklogField, string> = {
  epic: 'Epic / Summary',
  capability: 'Capability',
  points: 'Story points (likely)',
  pi: 'PI / Sprint',
  milestone: 'Milestone',
  ignore: '— ignore —',
};

/**
 * Import backlog rows from a Jira/Azure DevOps CSV export or a block pasted
 * from Excel. Columns are auto-mapped from the header and adjustable; the
 * three-point spread is derived from the likely points.
 */
export function BacklogImportDialog(props: { onClose: () => void }) {
  const s = useActivePursuit();
  const update = useStore((st) => st.updateActive);
  const showToast = useStore((st) => st.showToast);
  const [text, setText] = useState('');
  const [mapping, setMapping] = useState<BacklogField[] | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [spreadLow, setSpreadLow] = useState(0.3);
  const [spreadHigh, setSpreadHigh] = useState(0.4);
  const [archetype, setArchetype] = useState(s.archetypes[0]?.name || '');
  const [milestone, setMilestone] = useState(s.milestones[0]?.name || '');
  const fileRef = useRef<HTMLInputElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>();

  const rows = useMemo(() => (text.trim() ? parseDelimited(text) : []), [text]);
  const effectiveMapping = useMemo<BacklogField[]>(() => {
    if (!rows.length) return [];
    const width = Math.max(...rows.map((r) => r.length));
    if (mapping && mapping.length === width) return mapping;
    const head = rows[0];
    const guessed = Array.from({ length: width }, (_, i) => guessColumn(head[i] ?? ''));
    // Without a points column nothing imports; if exactly one numeric-looking
    // column exists in row 2, take it.
    if (!guessed.includes('points') && rows.length > 1) {
      const numericCols = rows[1].map((v, i) => (Number.isFinite(parseFloat(v)) ? i : -1)).filter((i) => i >= 0);
      if (numericCols.length === 1) guessed[numericCols[0]] = 'points';
    }
    if (!guessed.includes('epic')) {
      const firstIgnore = guessed.indexOf('ignore');
      if (firstIgnore >= 0) guessed[firstIgnore] = 'epic';
    }
    return guessed;
  }, [rows, mapping]);

  const opts: ImportOptions = {
    mapping: effectiveMapping,
    hasHeader,
    spreadLow,
    spreadHigh,
    defaultArchetype: archetype,
    defaultMilestone: milestone,
    defaultPiYear: 1,
  };
  const preview = useMemo(() => (rows.length ? buildBacklogItems(rows, opts) : []), [rows, opts]);

  const doImport = () => {
    if (!preview.length) {
      showToast('Nothing to import — check the points column mapping');
      return;
    }
    update((p) => {
      p.backlog.push(...preview);
    });
    showToast(`Imported ${preview.length} epics`);
    props.onClose();
  };

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div ref={trapRef} className="dialog" role="dialog" aria-modal="true" aria-label="Import backlog" style={{ maxWidth: 760, minWidth: 620 }}>
        <h3>Import backlog — Jira / Azure DevOps CSV or Excel paste</h3>
        <div className="msg">
          Paste rows copied from Excel/Sheets (tab-separated) or a Jira/ADO CSV export, or choose a file. Columns are
          auto-detected from the header; adjust below. Rows without an epic name and positive points are skipped.
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button type="button" className="tbtn" onClick={() => fileRef.current?.click()}>
            Choose CSV file…
          </button>
          <label className="toggle">
            <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} /> First row is a
            header
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setText(await f.text());
              e.target.value = '';
            }}
          />
        </div>
        <textarea
          rows={6}
          style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, border: '1px solid var(--line-2)', borderRadius: 8, padding: 8 }}
          placeholder={'Summary\tStory Points\tSprint\nPlanning workflow\t40\tPI1\n…'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {rows.length > 0 && (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
              {effectiveMapping.map((f, i) => (
                <div key={i} style={{ fontSize: 11 }}>
                  <div className="hint" style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {hasHeader ? rows[0][i] || `col ${i + 1}` : `col ${i + 1}`}
                  </div>
                  <select
                    value={f}
                    onChange={(e) => {
                      const next = [...effectiveMapping];
                      next[i] = e.target.value as BacklogField;
                      setMapping(next);
                    }}
                  >
                    {(Object.keys(FIELD_LABELS) as BacklogField[]).map((k) => (
                      <option key={k} value={k}>
                        {FIELD_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8, fontSize: 12 }}>
              <label>
                Low spread −{' '}
                <input type="number" step={0.05} value={spreadLow} style={{ width: 64 }} onChange={(e) => setSpreadLow(parseFloat(e.target.value) || 0)} />
              </label>
              <label>
                High spread +{' '}
                <input type="number" step={0.05} value={spreadHigh} style={{ width: 64 }} onChange={(e) => setSpreadHigh(parseFloat(e.target.value) || 0)} />
              </label>
              <label>
                Archetype{' '}
                <select value={archetype} onChange={(e) => setArchetype(e.target.value)}>
                  {s.archetypes.map((a) => (
                    <option key={a.name}>{a.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Default milestone{' '}
                <select value={milestone} onChange={(e) => setMilestone(e.target.value)}>
                  {s.milestones.map((m) => (
                    <option key={m.name}>{m.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="msg" style={{ fontWeight: 600 }}>
              {preview.length} epics ready · first: {preview[0] ? `${preview[0].epic} (${preview[0].low}/${preview[0].likely}/${preview[0].high})` : '—'}
            </div>
          </>
        )}
        <div className="row">
          <button type="button" className="tbtn" onClick={props.onClose}>
            Cancel
          </button>
          <button type="button" className="tbtn primary" onClick={doImport} disabled={!preview.length}>
            Import {preview.length || ''} epics
          </button>
        </div>
      </div>
    </div>
  );
}
