import type { Macros } from '../types';

interface MacroRingsProps {
  eaten: Macros;
  goals: Macros;
}

const MACROS: { key: keyof Macros; label: string; varName: string }[] = [
  { key: 'protein', label: 'Protein', varName: '--protein' },
  { key: 'carbs', label: 'Carbs', varName: '--carbs' },
  { key: 'fat', label: 'Fat', varName: '--fat' },
];

/** Three small progress rings for protein / carbs / fat against their goals. */
export function MacroRings({ eaten, goals }: MacroRingsProps) {
  return (
    <div className="macro-rings">
      {MACROS.map(({ key, label, varName }) => {
        const value = Math.round(eaten[key]);
        const goal = Math.round(goals[key]);
        const size = 62;
        const stroke = 7;
        const r = (size - stroke) / 2;
        const c = 2 * Math.PI * r;
        const pct = goal > 0 ? Math.min(1, value / goal) : 0;
        const over = goal > 0 && value > goal;
        return (
          <div className="macro-ring" key={key}>
            <div className="mini-ring" style={{ width: size, height: size }}>
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                  stroke="var(--ring-track)" strokeWidth={stroke} />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                  stroke={over ? 'var(--over)' : `var(${varName})`}
                  strokeWidth={stroke} strokeLinecap="round"
                  strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  style={{ transition: 'stroke-dashoffset 0.4s ease' }} />
              </svg>
              <span className="mini-ring-value">{value}</span>
            </div>
            <span className="macro-ring-label">{label}</span>
            <span className="macro-ring-goal">/ {goal}g</span>
          </div>
        );
      })}
    </div>
  );
}
