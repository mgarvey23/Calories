import { useMemo } from 'react';
import type { DiaryState, FoodItem, MealType } from '../types';
import { MEAL_TYPES, dayCalories, dayMacros, emptyDay, roundMacros } from '../types';
import { formatLongDate } from '../dateUtils';
import { recentFoods } from '../foodHistory';
import { MealSection } from './MealSection';
import { CalorieRing } from './CalorieRing';

interface DayViewProps {
  state: DiaryState;
  date: string;
  onAdd: (meal: MealType, food: FoodItem, quantity: number) => void;
  onRemove: (meal: MealType, entryId: string) => void;
  onQuantityChange: (meal: MealType, entryId: string, quantity: number) => void;
  onToggleFavorite: (food: FoodItem) => void;
}

/** The selected day: a calorie summary against goal, then each meal. */
export function DayView({ state, date, onAdd, onRemove, onQuantityChange, onToggleFavorite }: DayViewProps) {
  const day = state.days[date] ?? emptyDay(date);
  const total = dayCalories(day);
  const macros = roundMacros(dayMacros(day));
  const goal = state.settings.dailyCalorieGoal;
  const recent = useMemo(() => recentFoods(state), [state.days]);

  return (
    <div className="day-view">
      <div className="day-summary">
        <h2>{formatLongDate(date)}</h2>
        <div className="summary-body">
          <CalorieRing eaten={total} goal={goal} />
          <div className="summary-side">
            <div className="summary-stat">
              <strong>{total}</strong><span>eaten</span>
            </div>
            <div className="summary-stat">
              <strong>{goal}</strong><span>goal</span>
            </div>
            <div className="macro-bar">
              <span className="macro protein"><strong>{macros.protein}g</strong> Protein</span>
              <span className="macro carbs"><strong>{macros.carbs}g</strong> Carbs</span>
              <span className="macro fat"><strong>{macros.fat}g</strong> Fat</span>
            </div>
          </div>
        </div>
      </div>

      {MEAL_TYPES.map((meal) => (
        <MealSection
          key={meal}
          meal={meal}
          entries={day.meals[meal]}
          usdaApiKey={state.settings.usdaApiKey}
          jordanPriority={state.settings.jordanPriority}
          recent={recent}
          favorites={state.favorites}
          recipes={state.recipes}
          onAdd={(food, qty) => onAdd(meal, food, qty)}
          onRemove={(id) => onRemove(meal, id)}
          onQuantityChange={(id, qty) => onQuantityChange(meal, id, qty)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}
