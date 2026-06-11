import { useState } from 'react';
import { useFocusTrap } from './dialogs';
import { confirmDialog } from './dialogs';
import {
  ConflictError,
  loadSyncConfig,
  pullPortfolio,
  pushPortfolio,
  saveSyncConfig,
  type SyncConfig,
} from '../lib/sync';
import { useStore } from '../state/store';

/**
 * Push/pull the whole portfolio against the optional sync server
 * (server/server.mjs). Local-first: nothing leaves the browser unless you
 * push, and a pull replaces local pursuits after confirmation.
 */
export function SyncDialog(props: { onClose: () => void }) {
  const store = useStore();
  const [cfg, setCfg] = useState<SyncConfig>(loadSyncConfig);
  const [busy, setBusy] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(props.onClose);
  const [status, setStatus] = useState<string>('');

  const update = (patch: Partial<SyncConfig>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    saveSyncConfig(next);
  };

  const doPush = async () => {
    setBusy(true);
    setStatus('Pushing…');
    try {
      const data = { pursuits: store.pursuits, rateLibrary: store.rateLibrary };
      let rev: number;
      try {
        rev = await pushPortfolio(cfg, data);
      } catch (e) {
        if (e instanceof ConflictError) {
          const overwrite = await confirmDialog(
            'Revision conflict',
            'The server has a newer portfolio than your last sync. Overwrite it with your local copy? (Pull instead to take the server version.)',
            true,
          );
          if (!overwrite) {
            setStatus('Push cancelled — pull to take the server version.');
            setBusy(false);
            return;
          }
          rev = await pushPortfolio({ ...cfg, rev: e.serverRev }, data);
        } else {
          throw e;
        }
      }
      update({ rev });
      setStatus(`Pushed ${store.pursuits.length} pursuits (rev ${rev}).`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Push failed');
    }
    setBusy(false);
  };

  const doPull = async () => {
    setBusy(true);
    setStatus('Pulling…');
    try {
      const remote = await pullPortfolio(cfg);
      const n = remote.data?.pursuits?.length ?? 0;
      const ok = await confirmDialog(
        'Replace local portfolio?',
        `The server has ${n} pursuits (rev ${remote.rev}, saved ${new Date(remote.savedAt).toLocaleString()}). This replaces your local pursuits. Export a local backup first if unsure.`,
        true,
      );
      if (ok && n) {
        store.replaceAll(remote.data.pursuits, remote.data.rateLibrary ?? store.rateLibrary);
        update({ rev: remote.rev });
        setStatus(`Pulled ${n} pursuits (rev ${remote.rev}).`);
      } else {
        setStatus('Pull cancelled.');
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Pull failed');
    }
    setBusy(false);
  };

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div ref={trapRef} className="dialog" role="dialog" aria-modal="true" aria-label="Portfolio sync" style={{ minWidth: 460 }}>
        <h3>Portfolio Sync (optional team server)</h3>
        <div className="msg">
          Share pursuits across machines via the bundled sync server (<code>npm run serve:sync</code>). Local-first:
          nothing is sent until you push. Conflicts are detected by revision.
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={{ fontSize: 12 }}>
            Server URL
            <input type="text" placeholder="http://pricing-server:8787" value={cfg.url} onChange={(e) => update({ url: e.target.value })} />
          </label>
          <label style={{ fontSize: 12 }}>
            Portfolio id
            <input type="text" value={cfg.portfolioId} onChange={(e) => update({ portfolioId: e.target.value })} />
          </label>
          <label style={{ fontSize: 12 }}>
            Access token (if the server requires one)
            <input type="password" value={cfg.token} onChange={(e) => update({ token: e.target.value })} />
          </label>
        </div>
        {status && (
          <div className="msg" style={{ marginTop: 10, fontWeight: 600 }}>
            {status}
          </div>
        )}
        <div className="row">
          <button type="button" className="tbtn" onClick={props.onClose}>
            Close
          </button>
          <button type="button" className="tbtn" disabled={busy || !cfg.url} onClick={() => void doPull()}>
            Pull from server
          </button>
          <button type="button" className="tbtn primary" disabled={busy || !cfg.url} onClick={() => void doPush()}>
            Push to server
          </button>
        </div>
      </div>
    </div>
  );
}
