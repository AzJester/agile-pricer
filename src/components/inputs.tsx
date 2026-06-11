import { useId, useRef, useState } from 'react';

/**
 * Inputs hold a local draft while focused and commit on blur or Enter, so
 * each keystroke does not push an undo snapshot or re-run the model.
 * Escape discards the draft.
 */
function useDraft(value: string, onCommit: (v: string) => void) {
  const [draft, setDraft] = useState<string | null>(null);
  // blur() dispatches synchronously while the queued setDraft(null) hasn't
  // landed, so onBlur still sees the old draft; the ref is the cancel signal.
  const cancelRef = useRef(false);
  return {
    value: draft ?? value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value),
    onBlur: () => {
      if (!cancelRef.current && draft !== null && draft !== value) onCommit(draft);
      cancelRef.current = false;
      setDraft(null);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      if (e.key === 'Escape') {
        e.stopPropagation(); // editing cancel, not dialog dismissal
        cancelRef.current = true;
        setDraft(null);
        (e.target as HTMLInputElement).blur();
      }
    },
  };
}

interface CommonProps {
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  title?: string;
  /** Accessible name for unlabeled table-cell inputs. */
  label?: string;
  /** id of a datalist providing dropdown suggestions. */
  list?: string;
}

export function NumInput(props: CommonProps & { value: number | string; onCommit: (v: number) => void; step?: number | string }) {
  const bind = useDraft(String(props.value ?? ''), (v) => {
    // Unparseable text (cleared field, "1,000") reverts to the prior value
    // instead of silently committing 0.
    const n = parseFloat(v);
    if (Number.isFinite(n)) props.onCommit(n);
  });
  return (
    <input
      type="number"
      step={props.step ?? 'any'}
      aria-label={props.label}
      list={props.list}
      className={props.className}
      style={props.style}
      placeholder={props.placeholder}
      title={props.title}
      {...bind}
    />
  );
}

/** Numeric input where an empty value is meaningful (clears an override). */
export function OptionalNumInput(
  props: CommonProps & { value: number | ''; onCommit: (v: number | null) => void; step?: number | string },
) {
  const bind = useDraft(props.value === '' ? '' : String(props.value), (v) => {
    const n = parseFloat(v);
    props.onCommit(Number.isFinite(n) ? n : null);
  });
  return (
    <input
      type="number"
      step={props.step ?? 'any'}
      aria-label={props.label}
      list={props.list}
      className={props.className}
      style={props.style}
      placeholder={props.placeholder}
      title={props.title}
      {...bind}
    />
  );
}

export function TextInput(props: CommonProps & { value: string; onCommit: (v: string) => void; type?: string }) {
  const bind = useDraft(props.value ?? '', props.onCommit);
  return (
    <input
      type={props.type ?? 'text'}
      aria-label={props.label}
      list={props.list}
      className={props.className}
      style={props.style}
      placeholder={props.placeholder}
      title={props.title}
      {...bind}
    />
  );
}

/** Editable numeric table cell (blue = input convention). */
export function NumCell(props: { value: number | string; onCommit: (v: number) => void; step?: number | string; label?: string }) {
  return <NumInput className="cellinput num" value={props.value} onCommit={props.onCommit} step={props.step} label={props.label} />;
}

/** Editable text table cell. */
export function TextCell(props: { value: string; onCommit: (v: string) => void; label?: string }) {
  return <TextInput className="cellinput text" value={props.value} onCommit={props.onCommit} label={props.label} />;
}

/**
 * Editable text cell with a dropdown of suggestions (native datalist combo):
 * pick a choice or type a custom value — neither select-only nor text-only.
 */
export function ComboCell(props: { value: string; options: string[]; onCommit: (v: string) => void; label?: string }) {
  const listId = useId();
  return (
    <>
      <TextInput className="cellinput text" value={props.value} onCommit={props.onCommit} label={props.label} list={listId} />
      <datalist id={listId}>
        {props.options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}

/** Numeric cell with dropdown suggestions; any number can still be typed. */
export function NumComboCell(props: { value: number | string; options: number[]; onCommit: (v: number) => void; label?: string }) {
  const listId = useId();
  return (
    <>
      <NumInput className="cellinput num" value={props.value} onCommit={props.onCommit} label={props.label} list={listId} />
      <datalist id={listId}>
        {props.options.map((o) => (
          <option key={o} value={String(o)} />
        ))}
      </datalist>
    </>
  );
}

export function SelectCell(props: {
  value: string;
  options: { value: string; label?: string }[];
  onCommit: (v: string) => void;
  numeric?: boolean;
}) {
  return (
    <select
      className={'cellinput ' + (props.numeric ? 'num' : 'text')}
      value={props.value}
      onChange={(e) => props.onCommit(e.target.value)}
    >
      {props.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label ?? o.value}
        </option>
      ))}
    </select>
  );
}

/* ------------------------- labeled form fields ------------------------- */

export function FieldRow(props: { label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; span2?: boolean }) {
  return (
    <div className="field" style={props.span2 ? { gridColumn: '1/-1' } : undefined}>
      <label>
        {props.label}
        {props.hint && <span className="hint">{props.hint}</span>}
      </label>
      {props.children}
    </div>
  );
}

export function NumField(props: { label: React.ReactNode; hint?: React.ReactNode; value: number; onCommit: (v: number) => void }) {
  return (
    <FieldRow label={props.label} hint={props.hint}>
      <NumInput value={props.value} onCommit={props.onCommit} />
    </FieldRow>
  );
}

export function TextField(props: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  value: string;
  onCommit: (v: string) => void;
  type?: string;
}) {
  return (
    <FieldRow label={props.label} hint={props.hint}>
      <TextInput className="text" value={props.value} onCommit={props.onCommit} type={props.type} />
    </FieldRow>
  );
}

export function SelectField(props: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  value: string;
  options: string[];
  onCommit: (v: string) => void;
}) {
  return (
    <FieldRow label={props.label} hint={props.hint}>
      <select value={props.value} onChange={(e) => props.onCommit(e.target.value)}>
        {props.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </FieldRow>
  );
}

export function Toggle(props: { label: React.ReactNode; checked: boolean; onCommit: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onCommit(e.target.checked)} /> {props.label}
    </label>
  );
}
