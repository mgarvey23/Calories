import { useMemo, useState } from 'react';
import type { DayLog, Macros } from '../types';
import { dayCalories, dayMacros } from '../types';
import { addDays, todayISO, formatShortDate } from '../dateUtils';

type Metric = 'calories' | 'protein' | 'carbs' | 'fat';

const METRICS: { key: Metric; label: string; unit: string; varName: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal', varName: '--accent' },
  { key: 'protein', label: 'Protein', unit: 'g', varName: '--protein' },
  { key: 'carbs', label: 'Carbs', unit: 'g', varName: '--carbs' },
  { key: 'fat', label: 'Fat', unit: 'g', varName: '--fat' },
];

interface TrendChartProps {
  days: Record<string, DayLog>;
  /** Goal values used to draw the reference line for each metric. */
  goals: { calories: number } & Macros;
  /** How many days back to plot (inclusive of today). */
  rangeDays?: number;
}

interface Point {
  date: string;
  value: number;
  logged: boolean;
}

/**
 * A progress trend for one metric at a time (calories / protein / carbs / fat)
 * over the last N days, with a dashed goal reference line. Only days that were
 * actually logged plot a point, so the line reflects real activity rather than
 * treating unlogged days as zeros. Pure — reads only from `days`, so it works in
 * local mode too.
 */
export function TrendChart({ days, goals, rangeDays = 30 }: TrendChartProps) {
  const [metric, setMetric] = useState<Metric>('calories');
  const [hover, setHover] = useState<number | null>(null);

  const meta = METRICS.find((m) => m.key === metric)!;
  const goal = metric === 'calories' ? goals.calories : goals[metric];

  const points = useMemo<Point[]>(() => {
    const today = todayISO();
    const out: Point[] = [];
    for (let i = rangeDays - 1; i >= 0; i--) {
      const date = addDays(today, -i);
      const day = days[date];
      const logged = !!day && Object.values(day.meals).some((m) => m.length > 0);
      const value =
        !day ? 0 : metric === 'calories' ? dayCalories(day) : Math.round(dayMacros(day)[metric]);
      out.push({ date, value, logged });
    }
    return out;
  }, [days, metric, rangeDays]);

  const loggedPoints = points.filter((p) => p.logged);
  const avg =
    loggedPoints.length > 0
      ? Math.round(loggedPoints.reduce((s, p) => s + p.value, 0) / loggedPoints.length)
      : 0;

  // Geometry (viewBox units; scales responsively).
  const W = 340;
  const H = 168;
  const padL = 34;
  const padR = 10;
  const padT = 12;
  const padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxVal = Math.max(goal, ...points.map((p) => p.value), 1);
  const yMax = maxVal * 1.15;
  const x = (i: number) => padL + (points.length <= 1 ? 0 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / yMax) * innerH;

  // Build the line path across logged points, breaking on gaps.
  let path = '';
  let penDown = false;
  points.forEach((p, i) => {
    if (p.logged) {
      path += `${penDown ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)} `;
      penDown = true;
    } else {
      penDown = false;
    }
  });

  const color = `var(${meta.varName})`;
  const goalY = y(goal);

  return (
    <div className="trend-chart">
      <div className="trend-head">
        <div className="trend-tabs">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`trend-tab ${metric === m.key ? 'active' : ''}`}
              onClick={() => { setMetric(m.key); setHover(null); }}
            >
              {m.label}
            </button>
          ))}
        </div>
        <span className="trend-avg">
          avg <strong>{avg}</strong> {meta.unit} · goal {Math.round(goal)}
        </span>
      </div>

      {loggedPoints.length === 0 ? (
        <p className="trend-empty">No logged days yet in the last {rangeDays} days.</p>
      ) : (
        <svg
          className="trend-svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`${meta.label} over the last ${rangeDays} days, averaging ${avg} ${meta.unit}`}
        >
          {/* y grid + labels at 0, mid, max */}
          {[0, yMax / 2, yMax].map((v, i) => (
            <g key={i}>
              <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="var(--ring-track)" strokeWidth={1} />
              <text x={padL - 6} y={y(v) + 3} textAnchor="end" className="trend-axis">{Math.round(v)}</text>
            </g>
          ))}

          {/* goal reference line */}
          <line
            x1={padL} y1={goalY} x2={W - padR} y2={goalY}
            stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.8}
          />

          {/* the trend line */}
          <path d={path.trim()} fill="none" stroke={color} strokeWidth={2}
            strokeLinejoin="round" strokeLinecap="round" />

          {/* dots + hover targets on logged days */}
          {points.map((p, i) =>
            p.logged ? (
              <g key={p.date}>
                <circle cx={x(i)} cy={y(p.value)} r={hover === i ? 4 : 2.6}
                  fill={color} stroke="var(--surface)" strokeWidth={1.5} />
                <rect
                  x={x(i) - innerW / points.length / 2} y={padT}
                  width={Math.max(6, innerW / points.length)} height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            ) : null,
          )}

          {/* x labels: first and last */}
          <text x={padL} y={H - 6} textAnchor="start" className="trend-axis">
            {formatShortDate(points[0].date)}
          </text>
          <text x={W - padR} y={H - 6} textAnchor="end" className="trend-axis">
            {formatShortDate(points[points.length - 1].date)}
          </text>

          {/* hover tooltip */}
          {hover !== null && points[hover].logged && (
            <g>
              <line x1={x(hover)} y1={padT} x2={x(hover)} y2={padT + innerH}
                stroke="var(--muted)" strokeWidth={1} opacity={0.5} />
              <text
                x={Math.min(Math.max(x(hover), padL + 24), W - padR - 24)}
                y={padT + 2} textAnchor="middle" className="trend-tip"
              >
                {formatShortDate(points[hover].date)}: {points[hover].value} {meta.unit}
              </text>
            </g>
          )}
        </svg>
      )}
    </div>
  );
}
