interface CalorieRingProps {
  eaten: number;
  goal: number;
}

/** Circular progress ring showing calories eaten against the daily goal. */
export function CalorieRing({ eaten, goal }: CalorieRingProps) {
  const size = 160;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = goal > 0 ? Math.min(1, eaten / goal) : 0;
  const over = goal > 0 && eaten > goal;
  const remaining = goal - eaten;

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--ring-track)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={over ? 'var(--over)' : 'var(--accent)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div className="ring-center">
        <span className={`ring-number ${over ? 'over' : ''}`}>{Math.abs(remaining)}</span>
        <span className="ring-label">{over ? 'over' : 'left'}</span>
      </div>
    </div>
  );
}
