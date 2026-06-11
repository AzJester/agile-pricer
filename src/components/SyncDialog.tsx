import { useState } from 'react';
import { useFocusTrap } from './dialogs';
import { confirmDialog } from './dialogs';
import {
  ConflictError,
  isMixedContent,
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
  const [status, setStatus] = useState<string>('');

  // Edits stay in component state; the config (token included) persists to
  // localStorage on action or close, not on every keystroke.
  const update = (patch: Partial<SyncConfig>) => setCfg((c) => ({ ...c, ...patch }));
  const persistAnd = (next: SyncConfig) => {
    setCfg(next);
    saveSyncConfig(next);
  };
  const close = () => {
    saveSyncConfig(cfg);
    props.onClose();
  };
  const trapRef = useFocusTrap<HTMLDivElement>(close);
  const mixed = isMixedContent(cfg.url);

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
      persistAnd({ ...cfg, rev });
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
      if (!ok) {
        setStatus('Pull cancelled.');
      } else if (!n) {
        // Confirming an empty server portfolio used to report "cancelled".
        setStatus('Server portfolio is empty — nothing to apply.');
      } else {
        store.replaceAll(remote.data.pursuits, remote.data.rateLibrary ?? store.rateLibrary);
        persistAnd({ ...cfg, rev: remote.rev });
        setStatus(`Pulled ${n} pursuits (rev ${remote.rev}).`);
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
        if (e.target === e.currentTarget) close();
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
            <input type="text" placeholder="https://pricing-server:8787" value={cfg.url} onChange={(e) => update({ url: e.target.value })} />
          </label>
          {mixed && (
            <div className="msg" style={{ color: 'var(--twilight, #a33)', fontWeight: 600 }}>
              This page is served over HTTPS, so the browser will block a plain http:// sync URL as mixed content. Use
              https:// (run the sync server behind TLS), or run the app from the same network origin.
            </div>
          )}
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
          <button type="button" className="tbtn" onClick={close}>
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
