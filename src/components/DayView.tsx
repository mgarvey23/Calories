import type { DiaryState, FoodItem, MealType } from '../types';
import { MEAL_TYPES, dayCalories, emptyDay } from '../types';
import { formatLongDate } from '../dateUtils';
import { MealSection } from './MealSection';

interface DayViewProps {
  state: DiaryState;
  date: string;
  onAdd: (meal: MealType, food: FoodItem, quantity: number) => void;
  onRemove: (meal: MealType, entryId: string) => void;
  onQuantityChange: (meal: MealType, entryId: string, quantity: number) => void;
}

/** The selected day: a calorie summary against goal, then each meal. */
export function DayView({ state, date, onAdd, onRemove, onQuantityChange }: DayViewProps) {
  const day = state.days[date] ?? emptyDay(date);
  const total = dayCalories(day);
  const goal = state.settings.dailyCalorieGoal;
  const remaining = goal - total;
  const pct = goal > 0 ? Math.min(100, Math.round((total / goal) * 100)) : 0;

  return (
    <div className="day-view">
      <div className="day-summary">
        <h2>{formatLongDate(date)}</h2>
        <div className="summary-numbers">
          <div><strong>{total}</strong><span>eaten</span></div>
          <div><strong>{goal}</strong><span>goal</span></div>
          <div className={remaining < 0 ? 'over' : ''}>
            <strong>{Math.abs(remaining)}</strong>
            <span>{remaining < 0 ? 'over' : 'left'}</span>
          </div>
        </div>
        <div className="progress-bar">
          <div
            className={`progress-fill ${remaining < 0 ? 'over' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {MEAL_TYPES.map((meal) => (
        <MealSection
          key={meal}
          meal={meal}
          entries={day.meals[meal]}
          usdaApiKey={state.settings.usdaApiKey}
          onAdd={(food, qty) => onAdd(meal, food, qty)}
          onRemove={(id) => onRemove(meal, id)}
          onQuantityChange={(id, qty) => onQuantityChange(meal, id, qty)}
        />
      ))}
    </div>
  );
}
