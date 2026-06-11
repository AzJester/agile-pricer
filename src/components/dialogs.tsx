import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';

type DialogRequest =
  | { kind: 'prompt'; title: string; message?: string; defaultValue: string; resolve: (v: string | null) => void }
  | { kind: 'confirm'; title: string; message: string; danger?: boolean; resolve: (v: boolean) => void };

interface DialogStore {
  current: DialogRequest | null;
  open: (r: DialogRequest) => void;
  close: () => void;
}

const useDialogStore = create<DialogStore>((set) => ({
  current: null,
  open: (r) => set({ current: r }),
  close: () => set({ current: null }),
}));

export function promptDialog(title: string, defaultValue = '', message?: string): Promise<string | null> {
  return new Promise((resolve) => {
    useDialogStore.getState().open({ kind: 'prompt', title, message, defaultValue, resolve });
  });
}

export function confirmDialog(title: string, message: string, danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    useDialogStore.getState().open({ kind: 'confirm', title, message, danger, resolve });
  });
}

export function DialogHost() {
  const current = useDialogStore((s) => s.current);
  const close = useDialogStore((s) => s.close);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (current?.kind === 'prompt') {
      setText(current.defaultValue);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [current]);

  if (!current) return null;

  const cancel = () => {
    if (current.kind === 'prompt') current.resolve(null);
    else current.resolve(false);
    close();
  };
  const accept = () => {
    if (current.kind === 'prompt') current.resolve(text);
    else current.resolve(true);
    close();
  };

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cancel();
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-label={current.title}>
        <h3>{current.title}</h3>
        {current.message && <div className="msg">{current.message}</div>}
        {current.kind === 'prompt' && (
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') accept();
              if (e.key === 'Escape') cancel();
            }}
          />
        )}
        <div className="row">
          <button type="button" className="tbtn" onClick={cancel}>
            Cancel
          </button>
          <button
            type="button"
            className={'tbtn ' + (current.kind === 'confirm' && current.danger ? 'danger' : 'primary')}
            onClick={accept}
          >
            {current.kind === 'confirm' ? 'Confirm' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
