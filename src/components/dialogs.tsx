import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';

/**
 * Keyboard containment for modal dialogs: focuses the first control on
 * mount, keeps Tab cycling inside the container, closes on Escape (the
 * WAI-ARIA dialog pattern), and restores focus to the previously focused
 * element on unmount.
 */
export function useFocusTrap<T extends HTMLElement>(onEscape?: () => void) {
  const ref = useRef<T>(null);
  const escRef = useRef(onEscape);
  useEffect(() => {
    escRef.current = onEscape;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        el.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((x) => !x.hasAttribute('disabled'));
    (focusables()[0] ?? el).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && escRef.current) {
        e.stopPropagation();
        escRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, []);
  return ref;
}

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

function DialogBody({ current, close }: { current: DialogRequest; close: () => void }) {
  const [text, setText] = useState(current.kind === 'prompt' ? current.defaultValue : '');
  const inputRef = useRef<HTMLInputElement>(null);

  const cancel = () => {
    if (current.kind === 'prompt') current.resolve(null);
    else current.resolve(false);
    close();
  };
  const trapRef = useFocusTrap<HTMLDivElement>(cancel);

  useEffect(() => {
    if (current.kind === 'prompt') setTimeout(() => inputRef.current?.select(), 0);
  }, [current]);
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
      <div ref={trapRef} className="dialog" role="dialog" aria-modal="true" aria-label={current.title}>
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

export function DialogHost() {
  const current = useDialogStore((s) => s.current);
  const close = useDialogStore((s) => s.close);
  if (!current) return null;
  // Keyed remount resets the prompt text and focus trap per request.
  return <DialogBody key={current.title + current.kind} current={current} close={close} />;
}
