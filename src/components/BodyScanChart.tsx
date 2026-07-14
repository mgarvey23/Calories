import { useMemo, useState } from 'react';
import type { BodyScan } from '../types';
import type { Units } from '../nutrition';
import { SCAN_FIELDS, SCAN_GROUPS, fieldUnit, toDisplay } from '../bodyScanFields';
import { formatShortDate } from '../dateUtils';

/**
 * A trend of any one body-scan metric across scans over time. The metric is
 * chosen from a grouped picker covering every numeric field on the Evolt sheet.
 * Scans missing the chosen metric are skipped so the line only connects real
 * data points.
 */
export function BodyScanChart({ scans, units }: { scans: BodyScan[]; units: Units }) {
  const [metricKey, setMetricKey] = useState(SCAN_FIELDS[0].key);
  const [hover, setHover] = useState<number | null>(null);

  const def = SCAN_FIELDS.find((f) => f.key === metricKey)!;
  const unit = fieldUnit(def, units);
  const color = `var(${def.varName})`;

  const points = useMemo(() => {
    const asc = [...scans].sort((a, b) => a.date.localeCompare(b.date));
    return asc
      .map((s) => {
        const raw = s[def.key];
        return typeof raw === 'number' ? { date: s.date, value: toDisplay(raw, def, units) } : null;
      })
      .filter((p): p is { date: string; value: number } => p !== null);
  }, [scans, metricKey, units]);

  const W = 340, H = 150, padL = 40, padR = 12, padT = 12, padB = 22;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const values = points.map((p) => p.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const span = max - min || Math.max(1, Math.abs(max) * 0.1);
  const yMin = min - span * 0.15, yMax = max + span * 0.15;
  const x = (i: number) => padL + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const latest = points[points.length - 1];
  const first = points[0];
  const delta = latest && first ? Math.round((latest.value - first.value) * 10) / 10 : 0;

  return (
    <div className="trend-chart">
      <div className="trend-head">
        <select
          className="scan-metric-select"
          value={metricKey}
          onChange={(e) => { setMetricKey(e.target.value as typeof metricKey); setHover(null); }}
        >
          {SCAN_GROUPS.map((g) => (
            <optgroup key={g} label={g}>
              {SCAN_FIELDS.filter((f) => f.group === g).map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {latest && (
          <span className="trend-avg">
            now <strong>{latest.value}</strong> {unit}
            {points.length > 1 && (
              <span className={delta === 0 ? '' : delta < 0 ? 'delta-down' : 'delta-up'}>
                {' '}({delta > 0 ? '+' : ''}{delta} since {formatShortDate(first.date)})
              </span>
            )}
          </span>
        )}
      </div>

      {points.length === 0 ? (
        <p className="trend-empty">No scans with a {def.label.toLowerCase()} value yet.</p>
      ) : (
        <svg className="trend-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
          role="img" aria-label={`${def.label} across ${points.length} scans`}>
          {[yMax, (yMax + yMin) / 2, yMin].map((v, i) => (
            <g key={i}>
              <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="var(--ring-track)" strokeWidth={1} />
              <text x={padL - 6} y={y(v) + 3} textAnchor="end" className="trend-axis">
                {Math.round(v * 10) / 10}
              </text>
            </g>
          ))}
          {points.length > 1 && (
            <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {points.map((p, i) => (
            <circle key={p.date + i} cx={x(i)} cy={y(p.value)} r={hover === i ? 4.5 : 3}
              fill={color} stroke="var(--surface)" strokeWidth={1.5}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          ))}
          <text x={x(0)} y={H - 6} textAnchor="start" className="trend-axis">{formatShortDate(points[0].date)}</text>
          {points.length > 1 && (
            <text x={x(points.length - 1)} y={H - 6} textAnchor="end" className="trend-axis">
              {formatShortDate(points[points.length - 1].date)}
            </text>
          )}
          {hover !== null && points[hover] && (
            <text x={Math.min(Math.max(x(hover), padL + 30), W - padR - 30)} y={padT + 2}
              textAnchor="middle" className="trend-tip">
              {formatShortDate(points[hover].date)}: {points[hover].value} {unit}
            </text>
          )}
        </svg>
      )}
    </div>
  );
}
