import type { ReactNode } from 'react';
import { useStore } from '../state/store';

export function Section(props: { title: string; sub?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className="section-head">
        <div>
          <h2>{props.title}</h2>
          {props.sub && <div className="sub">{props.sub}</div>}
        </div>
        {props.actions}
      </div>
      <div className="hr" />
      {props.children}
    </>
  );
}

export function Card(props: { title?: ReactNode; actions?: ReactNode; flush?: boolean; children: ReactNode }) {
  return (
    <div className={'card' + (props.flush ? ' flush' : '')}>
      {(props.title || props.actions) && (
        <div className="ch">
          <h3>{props.title}</h3>
          {props.actions}
        </div>
      )}
      <div className="cb">{props.children}</div>
    </div>
  );
}

export type PillTone = 'ok' | 'warn' | 'bad';

export function Pill(props: { tone: PillTone; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <span className={'pill ' + props.tone} style={props.style}>
      {props.children}
    </span>
  );
}

export function utilTone(util: number): PillTone {
  return util < 0.7 ? 'warn' : util > 1.05 ? 'bad' : 'ok';
}

export function statusTone(text: string): PillTone {
  if (/OK|WITHIN/.test(text)) return 'ok';
  if (/OVER/.test(text)) return 'bad';
  return 'warn';
}

export function Stat(props: { k: ReactNode; v: ReactNode; sub?: ReactNode; hero?: boolean; vStyle?: React.CSSProperties }) {
  return (
    <div className={'stat' + (props.hero ? ' hero' : '')}>
      <div className="k">{props.k}</div>
      <div className="v" style={props.vStyle}>
        {props.v}
      </div>
      {props.sub && <div className="sub">{props.sub}</div>}
    </div>
  );
}

/** Inline guidance that respects the global Tips toggle. */
export function TipBox(props: { children: ReactNode }) {
  const tipsOn = useStore((s) => s.tipsOn);
  if (!tipsOn) return null;
  return (
    <div className="tip">
      <span className="lab">Tip</span>
      {props.children}
    </div>
  );
}

export function Callout(props: { children: ReactNode; color?: string }) {
  return (
    <div className="callout" style={props.color ? { borderLeftColor: props.color } : undefined}>
      {props.children}
    </div>
  );
}

export function Note(props: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="note" style={props.style}>
      {props.children}
    </div>
  );
}

export function Legend(props: { children: ReactNode }) {
  return <div className="legend">{props.children}</div>;
}

export function AddRowButton(props: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="addrow" onClick={props.onClick}>
      + {props.label}
    </button>
  );
}

export function DeleteRowButton(props: { onClick: () => void; title?: string }) {
  return <button type="button" className="rowdel" title={props.title ?? 'Remove row'} onClick={props.onClick} />;
}
