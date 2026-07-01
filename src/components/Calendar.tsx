import { useState } from 'react';
import type { DiaryState } from '../types';
import { dayCalories } from '../types';
import {
  MONTH_NAMES,
  WEEKDAY_NAMES,
  daysInMonth,
  firstWeekday,
  parseISODate,
  toISODate,
  todayISO,
} from '../dateUtils';

interface CalendarProps {
  state: DiaryState;
  selectedDate: string;
  onSelectDate: (iso: string) => void;
}

/** Month grid. Each cell shows the day number and total calories logged. */
export function Calendar({ state, selectedDate, onSelectDate }: CalendarProps) {
  const selected = parseISODate(selectedDate);
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  const goal = state.settings.dailyCalorieGoal;
  const today = todayISO();
  const total = daysInMonth(viewYear, viewMonth);
  const offset = firstWeekday(viewYear, viewMonth);

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  const cells: (string | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let day = 1; day <= total; day++) {
    cells.push(toISODate(new Date(viewYear, viewMonth, day)));
  }

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
        <h2>{MONTH_NAMES[viewMonth]} {viewYear}</h2>
        <button onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
      </div>

      <div className="calendar-grid weekdays">
        {WEEKDAY_NAMES.map((w) => (
          <div key={w} className="weekday">{w}</div>
        ))}
      </div>

      <div className="calendar-grid">
        {cells.map((iso, i) => {
          if (!iso) return <div key={`empty-${i}`} className="day-cell empty" />;
          const cals = dayCalories(state.days[iso]);
          const dayNum = parseISODate(iso).getDate();
          const classes = ['day-cell'];
          if (iso === selectedDate) classes.push('selected');
          if (iso === today) classes.push('today');
          if (cals > 0 && cals > goal) classes.push('over-goal');
          return (
            <button key={iso} className={classes.join(' ')} onClick={() => onSelectDate(iso)}>
              <span className="day-num">{dayNum}</span>
              {cals > 0 && <span className="day-cals">{cals}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
