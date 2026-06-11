import { useEffect, useRef, useState } from 'react';

/**
 * Inputs hold a local draft while focused and commit on blur or Enter, so
 * each keystroke does not push an undo snapshot or re-run the model.
 */
function useDraft(value: string, onCommit: (v: string) => void) {
  const [draft, setDraft] = useState<string | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  // If the external value changes while not editing (undo/redo), show it.
  useEffect(() => {
    if (draftRef.current === null) setDraft(null);
  }, [value]);
  return {
    value: draft ?? value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value),
    onBlur: () => {
      if (draft !== null && draft !== value) onCommit(draft);
      setDraft(null);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      if (e.key === 'Escape') {
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
}

export function NumInput(props: CommonProps & { value: number | string; onCommit: (v: number) => void; step?: number | string }) {
  const bind = useDraft(String(props.value ?? ''), (v) => props.onCommit(parseFloat(v) || 0));
  return (
    <input
      type="number"
      step={props.step ?? 'any'}
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
      className={props.className}
      style={props.style}
      placeholder={props.placeholder}
      title={props.title}
      {...bind}
    />
  );
}

/** Editable numeric table cell (blue = input convention). */
export function NumCell(props: { value: number | string; onCommit: (v: number) => void; step?: number | string }) {
  return <NumInput className="cellinput num" value={props.value} onCommit={props.onCommit} step={props.step} />;
}

/** Editable text table cell. */
export function TextCell(props: { value: string; onCommit: (v: string) => void }) {
  return <TextInput className="cellinput text" value={props.value} onCommit={props.onCommit} />;
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
