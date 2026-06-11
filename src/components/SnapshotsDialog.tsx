import { confirmDialog, promptDialog, useFocusTrap } from './dialogs';
import { useActivePursuit, useStore } from '../state/store';

/** Named point-in-time copies of the active pursuit ("as-submitted", "BAFO"). */
export function SnapshotsDialog(props: { onClose: () => void }) {
  const store = useStore();
  const s = useActivePursuit();
  const snapshots = store.snapshots.filter((x) => x.pursuitId === store.activeId);
  const trapRef = useFocusTrap<HTMLDivElement>();

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div ref={trapRef} className="dialog" role="dialog" aria-modal="true" aria-label="Snapshots" style={{ minWidth: 460 }}>
        <h3>Snapshots — {s.name}</h3>
        <div className="msg">
          A snapshot freezes this pursuit as of now. Restoring creates a new pursuit from the frozen copy; the original is
          untouched. Use them for "as-submitted" or "BAFO" baselines.
        </div>
        {snapshots.length === 0 && <div className="msg" style={{ color: 'var(--muted)' }}>No snapshots yet for this pursuit.</div>}
        {snapshots.map((sn) => (
          <div
            key={sn.id}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--line)' }}
          >
            <div style={{ flex: 1 }}>
              <b>{sn.name}</b>
              <div className="hint">{new Date(sn.takenAt).toLocaleString()}</div>
            </div>
            <button type="button" className="tbtn" onClick={() => store.restoreSnapshot(sn.id)}>
              Restore as copy
            </button>
            <button
              type="button"
              className="tbtn"
              onClick={async () => {
                if (await confirmDialog('Delete snapshot', `Delete snapshot "${sn.name}"?`, true)) {
                  store.deleteSnapshot(sn.id);
                }
              }}
            >
              Delete
            </button>
          </div>
        ))}
        <div className="row">
          <button type="button" className="tbtn" onClick={props.onClose}>
            Close
          </button>
          <button
            type="button"
            className="tbtn primary"
            onClick={async () => {
              const name = await promptDialog('Snapshot name', 'as-submitted ' + new Date().toISOString().slice(0, 10));
              if (name) store.takeSnapshot(name);
            }}
          >
            Take snapshot
          </button>
        </div>
      </div>
    </div>
  );
}
