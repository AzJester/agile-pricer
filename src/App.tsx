import { useEffect, useRef, useState } from 'react';
import { confirmDialog, DialogHost, promptDialog } from './components/dialogs';
import { SnapshotsDialog } from './components/SnapshotsDialog';
import { SyncDialog } from './components/SyncDialog';
import { Pill, statusTone, utilTone } from './components/ui';
import { isNewerSchema, looksLikePursuit } from './engine';
import { exportExcel } from './export/excel';
import { exportPortfolioJson, exportPursuitJson, readFileAsText } from './export/json';
import { exportWord } from './export/word';
import { money0, pct } from './lib/format';
import { useHashRoute } from './lib/useHashRoute';
import { SECTION_GROUPS, SECTIONS } from './sections';
import { useActivePursuit, useStore } from './state/store';
import { useResult } from './state/useResult';

function KpiStrip() {
  const s = useActivePursuit();
  const r = useResult();
  const fails = r.checks.filter((c) => !c.ok).length;
  return (
    <div className="kpis">
      <div className="kpi">
        <div className="k">Total Price ({s.control.confidence})</div>
        <div className="v">{money0(r.total)}</div>
      </div>
      <div className="kpi">
        <div className="k">Cost P50 / P80</div>
        <div className="v sky" style={{ fontSize: 14 }}>
          {money0(r.costP50)} <small>/ {money0(r.costP80)}</small>
        </div>
      </div>
      <div className="kpi">
        <div className="k">Reserve (effective)</div>
        <div className="v">{pct(r.resPct)}</div>
      </div>
      <div className="kpi">
        <div className="k">Capacity Utilization</div>
        <div className="v">
          {pct(r.util)} <Pill tone={utilTone(r.util)}>{r.util < 0.7 ? 'Under' : r.util > 1.05 ? 'Over' : 'OK'}</Pill>
        </div>
      </div>
      <div className="kpi">
        <div className="k">Budget Status</div>
        <div className="v" style={{ fontSize: 14 }}>
          <Pill tone={statusTone(r.budgetStatus)}>{r.budgetStatus.split(':')[0]}</Pill>
        </div>
      </div>
      <div className="kpi">
        <div className="k">Integrity</div>
        <div className="v" style={{ fontSize: 14 }}>
          <Pill tone={r.allOk ? 'ok' : 'bad'}>{r.allOk ? 'ALL OK' : fails + ' FAIL'}</Pill>
        </div>
      </div>
    </div>
  );
}

function Toolbar() {
  const store = useStore();
  const s = useActivePursuit();
  const r = useResult();
  const pursuitFileRef = useRef<HTMLInputElement>(null);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [showSync, setShowSync] = useState(false);

  const onNew = async () => {
    const name = await promptDialog(
      'New pursuit',
      'New Pursuit',
      'Name the pursuit. Tip: include "baseline" to start from the reference baseline instead of a blank model.',
    );
    if (name === null) return;
    store.newPursuit(name, /baseline|reference/i.test(name));
  };

  const onDelete = async () => {
    if (store.pursuits.length <= 1) {
      store.showToast('Cannot delete the only pursuit');
      return;
    }
    const ok = await confirmDialog('Delete pursuit', `Delete "${s.name}"? This cannot be undone.`, true);
    if (ok) store.deletePursuit();
  };

  const onRename = async () => {
    const name = await promptDialog('Rename pursuit', s.name);
    if (name && name.trim()) store.renamePursuit(name);
  };

  const onImportFile = async (file: File) => {
    try {
      const data: unknown = JSON.parse(await readFileAsText(file));
      // A portfolio file wraps multiple pursuits; a pursuit file is one.
      if (data && typeof data === 'object' && Array.isArray((data as { pursuits?: unknown }).pursuits)) {
        const entries = (data as { pursuits: { data?: unknown }[] }).pursuits;
        if (entries.some((p) => isNewerSchema(p?.data))) {
          store.showToast('This portfolio was saved by a newer app version — update the app before importing');
          return;
        }
        const n = store.importPortfolio(data);
        store.showToast(n ? `Imported ${n} pursuits` : 'Invalid portfolio file');
      } else if (isNewerSchema(data)) {
        store.showToast('This pursuit was saved by a newer app version — update the app before importing');
      } else if (looksLikePursuit(data)) {
        store.importPursuit(data);
      } else {
        store.showToast('Invalid pursuit file');
      }
    } catch {
      store.showToast('Invalid JSON file');
    }
  };

  return (
    <div className="pursuit-wrap">
      <select
        className="pursuit-select"
        title="Active pursuit"
        value={store.activeId}
        onChange={(e) => store.switchPursuit(e.target.value)}
      >
        {store.pursuits.map((p) => (
          <option key={p.id} value={p.id}>
            {p.data.name}
          </option>
        ))}
      </select>
      <button type="button" className="tbtn" title="Undo (Ctrl+Z)" disabled={!store.past.length} onClick={store.undo}>
        Undo
      </button>
      <button type="button" className="tbtn" title="Redo (Ctrl+Y)" disabled={!store.future.length} onClick={store.redo}>
        Redo
      </button>
      <button type="button" className="tbtn" title="Rename pursuit" onClick={() => void onRename()}>
        Rename
      </button>
      <button type="button" className="tbtn" onClick={() => void onNew()}>
        New
      </button>
      <button type="button" className="tbtn" onClick={store.duplicatePursuit}>
        Duplicate
      </button>
      <button type="button" className="tbtn" onClick={() => void onDelete()}>
        Delete
      </button>
      <button
        type="button"
        className="tbtn"
        title="Import a pursuit or portfolio JSON"
        onClick={() => pursuitFileRef.current?.click()}
      >
        Import
      </button>
      <button
        type="button"
        className="tbtn"
        title="Export this pursuit as JSON"
        onClick={() => {
          exportPursuitJson(s);
          store.showToast('Exported JSON');
        }}
      >
        Export
      </button>
      <button
        type="button"
        className="tbtn"
        title="Export all pursuits"
        onClick={() => {
          exportPortfolioJson(store.pursuits, store.rateLibrary);
          store.showToast('Portfolio exported');
        }}
      >
        Portfolio
      </button>
      <button
        type="button"
        className="tbtn"
        title="Export to Excel"
        onClick={() => {
          store.showToast('Preparing Excel…');
          exportExcel(s, r).then(
            () => store.showToast('Excel workbook exported'),
            () => store.showToast('Excel export failed'),
          );
        }}
      >
        Excel
      </button>
      <button
        type="button"
        className="tbtn"
        title="Export proposal extract to Word"
        onClick={() => {
          store.showToast('Preparing Word document…');
          exportWord(s, r).then(
            () => store.showToast('Word document exported'),
            () => store.showToast('Word export failed'),
          );
        }}
      >
        Word
      </button>
      <button type="button" className="tbtn" title="Named point-in-time copies of this pursuit" onClick={() => setShowSnapshots(true)}>
        Snapshots
      </button>
      <button type="button" className="tbtn" title="Push/pull the portfolio to a team sync server" onClick={() => setShowSync(true)}>
        Sync
      </button>
      <button type="button" className="tbtn" title="Show or hide input tips" onClick={store.toggleTips}>
        Tips: {store.tipsOn ? 'on' : 'off'}
      </button>
      <button type="button" className="tbtn primary" onClick={() => window.print()}>
        Print / PDF
      </button>
      <input
        ref={pursuitFileRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onImportFile(f);
          e.target.value = '';
        }}
      />
      {showSnapshots && <SnapshotsDialog onClose={() => setShowSnapshots(false)} />}
      {showSync && <SyncDialog onClose={() => setShowSync(false)} />}
    </div>
  );
}

function Nav({ route, navigate }: { route: string; navigate: (id: string) => void }) {
  const s = useActivePursuit();
  const r = useResult();
  return (
    <nav>
      {SECTION_GROUPS.map((g) => (
        <div key={g.group}>
          <div className="navsec">{g.group}</div>
          {g.items.map(({ id, label }) => {
            let badge: React.ReactNode = null;
            if (id === 'checks') {
              const fails = r.checks.filter((c) => !c.ok).length;
              badge = fails ? <span className="badge bad">{fails}</span> : <span className="badge">OK</span>;
            }
            if (id === 'backlog') badge = <span className="badge">{s.backlog.length}</span>;
            return (
              <button
                key={id}
                type="button"
                className={'navbtn' + (route === id ? ' active' : '')}
                aria-current={route === id ? 'page' : undefined}
                onClick={() => navigate(id)}
              >
                {label}
                {badge}
              </button>
            );
          })}
        </div>
      ))}
      <div className="navsec" style={{ marginTop: 14 }}>
        <span style={{ color: 'var(--input)' }}>Blue</span> = input · Black = calculated
      </div>
    </nav>
  );
}

function Toast() {
  const toast = useStore((st) => st.toast);
  const clearToast = useStore((st) => st.clearToast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, 1900);
    return () => clearTimeout(t);
  }, [toast, clearToast]);
  return (
    <div className={'toast' + (toast ? ' show' : '')} role="status">
      {toast}
    </div>
  );
}

export default function App() {
  const [route, navigate] = useHashRoute('start');
  const undo = useStore((st) => st.undo);
  const redo = useStore((st) => st.redo);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Let inputs keep their native undo while editing.
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const ActiveSection = (SECTIONS[route] ?? SECTIONS.start).component;

  return (
    <>
      <header>
        <div className="bar">
          <div className="brand">
            <div>
              <div className="logo">
                ASTRION<span className="dot">.</span>
              </div>
              <div className="tagline">Agile Pricing Studio</div>
            </div>
          </div>
          <div className="spacer" />
          <Toolbar />
        </div>
        <div className="gbar" />
        <KpiStrip />
      </header>
      <div className="shell">
        <Nav route={route} navigate={navigate} />
        <main>
          <ActiveSection />
        </main>
      </div>
      <Toast />
      <DialogHost />
    </>
  );
}
