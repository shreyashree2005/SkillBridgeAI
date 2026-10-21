// Lightweight SVG charts (no chart library). Colours come from CSS tokens so
// they switch with the theme; text uses text tokens, never the series colour.
// Every chart has a hover tooltip and a screen-reader data table.
import { useState } from 'react';

const niceMax = (v) => {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
};

// Bar path: 4px rounded data-end, square at the baseline.
const barPath = (x, y, w, h, r = 4) => {
  if (h <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
};
const hbarPath = (x, y, w, h, r = 4) => {
  if (w <= 0) return '';
  const rr = Math.min(r, w, h / 2);
  return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`;
};

function Tip({ tip }) {
  if (!tip) return null;
  return <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>{tip.content}</div>;
}

function DataTable({ caption, columns, rows }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead><tr>{columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
    </table>
  );
}

/** Grouped columns over categories. series: [{ key, label, color }] */
export function GroupedBars({ data, xKey, series, height = 200, caption, formatX = (v) => v }) {
  const [tip, setTip] = useState(null);
  const W = 560; const H = height; const pad = { l: 28, r: 8, t: 10, b: 24 };
  const max = niceMax(Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.key] || 0))));
  const iw = W - pad.l - pad.r; const ih = H - pad.t - pad.b;
  const band = iw / data.length;
  const barW = Math.min(18, (band - 10) / series.length - 2);
  const groupW = series.length * barW + (series.length - 1) * 2;
  const y = (v) => pad.t + ih - (v / max) * ih;
  const ticks = [0, max / 2, max];

  return (
    <div className="stack" style={{ gap: 8 }}>
      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}
        </div>
      )}
      <div className="chart-wrap" onMouseLeave={() => setTip(null)}>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={caption}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid-line" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
              <text x={pad.l - 6} y={y(t) + 4} textAnchor="end">{Math.round(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const gx = pad.l + i * band + (band - groupW) / 2;
            return (
              <g key={i}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
                  setTip({
                    x: ((pad.l + i * band + band / 2) / W) * rect.width,
                    y: (pad.t / H) * rect.height,
                    content: <><b>{formatX(d[xKey])}</b>{series.map((s) => <div key={s.key}>{s.label}: <b>{d[s.key] || 0}</b></div>)}</>,
                  });
                }}>
                <rect className="hover-band" x={pad.l + i * band + 2} y={pad.t} width={band - 4} height={ih} rx={4} />
                {series.map((s, j) => {
                  const v = d[s.key] || 0;
                  return <path key={s.key} d={barPath(gx + j * (barW + 2), y(v), barW, pad.t + ih - y(v))} fill={s.color} />;
                })}
                <text x={pad.l + i * band + band / 2} y={H - 6} textAnchor="middle">{formatX(d[xKey])}</text>
                <rect className="hit" x={pad.l + i * band} y={pad.t} width={band} height={ih} />
              </g>
            );
          })}
        </svg>
        <Tip tip={tip} />
      </div>
      <DataTable caption={caption} columns={[xKey, ...series.map((s) => s.label)]}
        rows={data.map((d) => [formatX(d[xKey]), ...series.map((s) => d[s.key] || 0)])} />
    </div>
  );
}

/** Horizontal bars with an ordinal ramp. items: [{ label, value }] */
export function HBars({ items, caption, colors }) {
  const [tip, setTip] = useState(null);
  const W = 560; const rowH = 30; const labelW = 110; const valueW = 36;
  const H = items.length * rowH;
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((s, i) => s + i.value, 0);
  return (
    <div className="chart-wrap" onMouseLeave={() => setTip(null)}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={caption}>
        {items.map((it, i) => {
          const w = ((W - labelW - valueW) * it.value) / max;
          const yy = i * rowH + 7;
          return (
            <g key={it.label}
              onMouseMove={(e) => {
                const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
                setTip({ x: ((labelW + Math.max(w, 20) / 2) / W) * rect.width, y: (yy / H) * rect.height,
                  content: <><b>{it.label}</b>: {it.value}{total ? ` (${Math.round((it.value / total) * 100)}%)` : ''}</> });
              }}>
              <rect className="hover-band" x={0} y={i * rowH + 1} width={W} height={rowH - 2} rx={4} />
              <text x={0} y={yy + 12} style={{ fill: 'var(--text-2)', fontSize: 12 }}>{it.label}</text>
              <rect x={labelW} y={yy} width={W - labelW - valueW} height={16} rx={4} fill="var(--surface-2)" />
              <path d={hbarPath(labelW, yy, w, 16)} fill={colors[i % colors.length]} />
              <text x={W} y={yy + 12} textAnchor="end" className="tnum" style={{ fill: 'var(--text)', fontSize: 12 }}>{it.value}</text>
              <rect className="hit" x={0} y={i * rowH} width={W} height={rowH} />
            </g>
          );
        })}
      </svg>
      <Tip tip={tip} />
      <DataTable caption={caption} columns={['Category', 'Count']} rows={items.map((i) => [i.label, i.value])} />
    </div>
  );
}

/** Single-series line with end label. points: [{ x: label, y: number, detail }] */
export function LineChart({ points, caption, max = 100, height = 180, color = 'var(--series-1)' }) {
  const [tip, setTip] = useState(null);
  const W = 560; const H = height; const pad = { l: 28, r: 36, t: 12, b: 24 };
  const iw = W - pad.l - pad.r; const ih = H - pad.t - pad.b;
  const x = (i) => pad.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v) => pad.t + ih - (v / max) * ih;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.y)}`).join('');
  const last = points[points.length - 1];
  return (
    <div className="chart-wrap" onMouseLeave={() => setTip(null)}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={caption}>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line className="grid-line" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end">{t}</text>
          </g>
        ))}
        <path d={`${d}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill={color} opacity="0.1" />
        <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i} onMouseMove={(e) => {
            const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
            setTip({ x: (x(i) / W) * rect.width, y: (y(p.y) / H) * rect.height, content: <><b>{p.y}</b> · {p.x}{p.detail ? ` · ${p.detail}` : ''}</> });
          }}>
            <circle cx={x(i)} cy={y(p.y)} r="4.5" fill={color} stroke="var(--viz-surface)" strokeWidth="2" />
            <circle className="hit" cx={x(i)} cy={y(p.y)} r="14" />
          </g>
        ))}
        {last && <text x={x(points.length - 1) + 10} y={y(last.y) + 4} style={{ fill: 'var(--text)', fontSize: 12, fontWeight: 600 }}>{last.y}</text>}
      </svg>
      <Tip tip={tip} />
      <DataTable caption={caption} columns={['Point', 'Value']} rows={points.map((p) => [p.x, p.y])} />
    </div>
  );
}
