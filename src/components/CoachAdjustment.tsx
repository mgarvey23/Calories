import type { CoachingDoc } from '../types';
import { formatShortDate } from '../dateUtils';

interface CoachAdjustmentProps {
  coaching: CoachingDoc;
}

/**
 * Client-facing banner showing the coach's active adjustment: the pushed daily
 * target (which is what the rings now use) and the latest notes.
 */
export function CoachAdjustment({ coaching }: CoachAdjustmentProps) {
  const { target, notes, coachName } = coaching;
  const latest = notes?.slice(0, 2) ?? [];
  const who = coachName || 'Your coach';

  return (
    <div className="coach-banner">
      <div className="coach-banner-head">
        <span className="coach-badge">Coach</span>
        <strong>{who}'s adjustments</strong>
      </div>
      {target && (
        <p className="coach-banner-target">
          New daily target: <strong>{target.calories}</strong> cal ·{' '}
          {target.protein}P / {target.carbs}C / {target.fat}F
          <span className="coach-banner-note"> — applied to your rings</span>
        </p>
      )}
      {latest.length > 0 && (
        <ul className="coach-banner-notes">
          {latest.map((n) => (
            <li key={n.id}>
              <span className="coach-note-date">{formatShortDate(n.createdAt.slice(0, 10))}</span>
              {n.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
