import { fmt0, money0 } from '../lib/format';

export const CHART_COLORS = {
  force: '#442C81',
  sky: '#29AAE1',
  refraction: '#1ED872',
  zenith: '#9382F9',
  supernova: '#FFAF2E',
  twilight: '#FC5442',
  silver: '#BDBDBD',
  ink: '#222230',
};

const CYCLE = [CHART_COLORS.force, CHART_COLORS.sky, CHART_COLORS.refraction, CHART_COLORS.zenith, CHART_COLORS.supernova];

export function colorForMoney(name: string, i: number): string {
  const m: Record<string, string> = {
    'RDT&E': CHART_COLORS.force,
    'O&M': CHART_COLORS.sky,
    Procurement: CHART_COLORS.refraction,
    Mixed: CHART_COLORS.zenith,
  };
  return m[name] || CYCLE[i % CYCLE.length];
}

export interface WaterfallStep {
  label: string;
  delta: number;
  total?: boolean;
}

export function Waterfall({
  steps,
  w = 620,
  h = 240,
  onStepClick,
}: {
  steps: WaterfallStep[];
  w?: number;
  h?: number;
  /** Makes the bars drill-through targets (pointer cursor + click). */
  onStepClick?: (step: WaterfallStep) => void;
}) {
  const pad = { l: 8, r: 8, t: 24, b: 46 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const pts: (WaterfallStep & { start: number; end: number })[] = [];
  for (const s of steps) {
    const start = pts.length ? pts[pts.length - 1].end : 0;
    pts.push({ ...s, start, end: start + s.delta });
  }
  const max = Math.max(...pts.map((p) => Math.max(p.start, p.end)), 1);
  const bw = (iw / pts.length) * 0.62;
  const gap = iw / pts.length;
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: w }}>
      {pts.map((p, i) => {
        const x = pad.l + gap * i + (gap - bw) / 2;
        const top = y(Math.max(p.start, p.end));
        const bot = y(Math.min(p.start, p.end));
        const col = p.total ? CHART_COLORS.force : p.delta >= 0 ? CHART_COLORS.sky : CHART_COLORS.twilight;
        return (
          <g
            key={i}
            onClick={onStepClick ? () => onStepClick(p) : undefined}
            style={onStepClick ? { cursor: 'pointer' } : undefined}
          >
            <rect x={x} y={top} width={bw} height={Math.max(2, bot - top)} rx={2} fill={col}>
              <title>
                {p.total
                  ? `${p.label}: ${money0(Math.round(p.end))}`
                  : `${p.label}: ${p.delta >= 0 ? '+' : '−'}${money0(Math.abs(Math.round(p.delta)))} → running ${money0(Math.round(p.end))}`}
              </title>
            </rect>
            <text x={x + bw / 2} y={top - 5} fontSize={9.5} textAnchor="middle" fill="#555">
              {'$' + fmt0(Math.round(p.end))}
            </text>
            <text x={x + bw / 2} y={h - pad.b + 14} fontSize={10} textAnchor="middle" fill={CHART_COLORS.ink}>
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export interface StackedRow {
  label: string;
  values: Record<string, number>;
}

export function StackedBars({
  rows,
  keys,
  colors,
  w = 620,
  h = 240,
  fmtY = (v: number) => '$' + Math.round(v / 1e6) + 'M',
  onBarClick,
}: {
  rows: StackedRow[];
  keys: string[];
  colors: string[];
  w?: number;
  h?: number;
  fmtY?: (v: number) => string;
  /** Makes the bars drill-through targets (pointer cursor + click). */
  onBarClick?: (row: StackedRow) => void;
}) {
  const pad = { l: 54, r: 8, t: 16, b: 42 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const totals = rows.map((r) => keys.reduce((a, k) => a + (r.values[k] || 0), 0));
  const max = Math.max(...totals, 1);
  const bw = (iw / Math.max(rows.length, 1)) * 0.6;
  const gap = iw / Math.max(rows.length, 1);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const grid = [0, 1, 2, 3, 4].map((g) => {
    const gv = (max * g) / 4;
    return (
      <g key={g}>
        <line x1={pad.l} y1={y(gv)} x2={w - pad.r} y2={y(gv)} stroke="#eef" strokeWidth={1} />
        <text x={pad.l - 6} y={y(gv) + 3} fontSize={9} textAnchor="end" fill="#888">
          {fmtY(gv)}
        </text>
      </g>
    );
  });
  return (
    <>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: w }}>
        {grid}
        {rows.map((r, i) => {
          let yc = pad.t + ih;
          const x = pad.l + gap * i + (gap - bw) / 2;
          return (
            <g
              key={i}
              onClick={onBarClick ? () => onBarClick(r) : undefined}
              style={onBarClick ? { cursor: 'pointer' } : undefined}
            >
              {keys.map((k, ki) => {
                const v = r.values[k] || 0;
                if (v <= 0) return null;
                const hh = (v / max) * ih;
                yc -= hh;
                return (
                  <rect key={k} x={x} y={yc} width={bw} height={hh} fill={colors[ki]}>
                    <title>
                      {r.label} · {k}: {money0(Math.round(v))}
                    </title>
                  </rect>
                );
              })}
              {totals[i] > 0 && (
                <text x={x + bw / 2} y={y(totals[i]) - 4} fontSize={9} textAnchor="middle" fill="#555">
                  {'$' + fmt0(Math.round(totals[i]))}
                </text>
              )}
              <text x={x + bw / 2} y={h - pad.b + 14} fontSize={10} textAnchor="middle" fill={CHART_COLORS.ink}>
                {r.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ marginTop: 6 }}>
        {keys.map((k, ki) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginRight: 14, fontSize: 11 }}>
            <span style={{ width: 11, height: 11, borderRadius: 2, background: colors[ki] }} />
            {k}
          </span>
        ))}
      </div>
    </>
  );
}

export function Histogram({
  samples,
  p50,
  p80,
  w = 620,
  h = 200,
}: {
  samples: number[];
  p50: number;
  p80: number;
  w?: number;
  h?: number;
}) {
  if (!samples.length) return null;
  const pad = { l: 8, r: 8, t: 10, b: 38 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const bins = 36;
  const lo = samples[0];
  const hi = samples[samples.length - 1];
  const span = hi - lo || 1;
  const counts = new Array(bins).fill(0) as number[];
  for (const v of samples) {
    let b = Math.floor(((v - lo) / span) * bins);
    if (b >= bins) b = bins - 1;
    counts[b]++;
  }
  const max = Math.max(...counts, 1);
  const bw = iw / bins;
  const xv = (v: number) => pad.l + ((v - lo) / span) * iw;
  const mark = (v: number, col: string, lab: string) => (
    <g>
      <line x1={xv(v)} y1={pad.t} x2={xv(v)} y2={pad.t + ih} stroke={col} strokeWidth={2} strokeDasharray="4 3" />
      <text x={xv(v)} y={pad.t + 8} fontSize={9.5} textAnchor="middle" fill={col}>
        {lab}
      </text>
    </g>
  );
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      style={{ maxWidth: w }}
      role="img"
      aria-label={`Cost distribution histogram from $${fmt0(Math.round(lo))} to $${fmt0(Math.round(hi))}; P50 $${fmt0(Math.round(p50))}, P80 $${fmt0(Math.round(p80))}`}
    >
      {counts.map((c, i) => {
        const hh = (c / max) * ih;
        return (
          <rect key={i} x={pad.l + bw * i} y={pad.t + ih - hh} width={bw - 1} height={hh} fill={CHART_COLORS.sky} opacity={0.75} />
        );
      })}
      {mark(p50, CHART_COLORS.force, 'P50')}
      {mark(p80, CHART_COLORS.twilight, 'P80')}
      <text x={pad.l} y={h - 8} fontSize={9.5} fill="#888">
        {'$' + fmt0(Math.round(lo))}
      </text>
      <text x={w - pad.r} y={h - 8} fontSize={9.5} textAnchor="end" fill="#888">
        {'$' + fmt0(Math.round(hi))}
      </text>
    </svg>
  );
}

export interface TornadoDriver {
  driver: string;
  low: number;
  high: number;
  swing: number;
}

export function Tornado({ drivers, base, w = 640 }: { drivers: TornadoDriver[]; base: number; w?: number }) {
  const h = drivers.length * 34 + 30;
  const pad = { l: 160, r: 70, t: 10, b: 10 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const lo = Math.min(base, ...drivers.map((d) => d.low));
  const hi = Math.max(base, ...drivers.map((d) => d.high));
  const span = hi - lo || 1;
  const x = (v: number) => pad.l + ((v - lo) / span) * iw;
  const rowH = ih / Math.max(drivers.length, 1);
  const bx = x(base);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: w }}>
      {drivers.map((d, i) => {
        const yc = pad.t + i * rowH + rowH * 0.2;
        const bh = rowH * 0.6;
        const x1 = x(Math.min(d.low, d.high));
        const x2 = x(Math.max(d.low, d.high));
        return (
          <g key={d.driver}>
            <text x={pad.l - 8} y={yc + bh * 0.7} fontSize={11} textAnchor="end" fill={CHART_COLORS.ink}>
              {d.driver}
            </text>
            <rect x={x1} y={yc} width={Math.max(2, x2 - x1)} height={bh} rx={3} fill={CHART_COLORS.sky} opacity={0.85}>
              <title>
                {d.driver}: {money0(d.low)} to {money0(d.high)}
              </title>
            </rect>
            <text x={x2 + 6} y={yc + bh * 0.7} fontSize={10} fill="#555">
              ±{money0(d.swing / 2)}
            </text>
          </g>
        );
      })}
      <line x1={bx} y1={pad.t} x2={bx} y2={h - pad.b} stroke={CHART_COLORS.force} strokeWidth={2} />
      <text x={bx} y={h - 1} fontSize={9.5} textAnchor="middle" fill={CHART_COLORS.force}>
        base
      </text>
    </svg>
  );
}
