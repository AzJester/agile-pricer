import { useMemo, useState } from 'react';
import { useFocusTrap } from './dialogs';
import { SECTION_GROUPS } from '../sections';

/** Ctrl+K quick-jump across every section. */
export function CommandPalette(props: { onNavigate: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const trapRef = useFocusTrap<HTMLDivElement>(props.onClose);
  const items = useMemo(() => {
    const all = SECTION_GROUPS.flatMap((g) => g.items.map((it) => ({ ...it, group: g.group })));
    const needle = q.trim().toLowerCase();
    return needle ? all.filter((it) => (it.label + ' ' + it.group).toLowerCase().includes(needle)) : all;
  }, [q]);
  const active = Math.min(sel, Math.max(0, items.length - 1));
  const goTo = (id: string) => {
    props.onNavigate(id);
    props.onClose();
  };
  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div ref={trapRef} className="dialog" role="dialog" aria-modal="true" aria-label="Jump to section" style={{ minWidth: 420 }}>
        <input
          type="text"
          placeholder="Jump to section…  (↑↓ to choose, Enter to open)"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSel((s) => Math.min(s + 1, items.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSel((s) => Math.max(s - 1, 0));
            } else if (e.key === 'Enter' && items[active]) {
              goTo(items[active].id);
            }
          }}
        />
        <div className="palette-list">
          {items.map((it, i) => (
            <button
              key={it.id}
              type="button"
              className={'palette-item' + (i === active ? ' active' : '')}
              onMouseEnter={() => setSel(i)}
              onClick={() => goTo(it.id)}
            >
              <span>{it.label}</span>
              <span className="grp">{it.group}</span>
            </button>
          ))}
          {!items.length && <div className="sub" style={{ padding: 8 }}>No match.</div>}
        </div>
      </div>
    </div>
  );
}
