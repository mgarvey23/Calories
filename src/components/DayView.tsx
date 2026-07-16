import { useMemo, useState } from 'react';
import type { CoachingDoc, DiaryState, FoodItem, MealType } from '../types';
import { MEAL_TYPES, dayCalories, dayMacros, emptyDay, roundMacros } from '../types';
import { formatLongDate, todayISO } from '../dateUtils';
import { suggestFoods } from '../mealSuggestions';
import { MealSection } from './MealSection';
import { CalorieRing } from './CalorieRing';
import { MacroRings } from './MacroRings';
import { CoachAdjustment } from './CoachAdjustment';
import { EntryAnalysisModal } from './EntryAnalysisModal';

interface DayViewProps {
  state: DiaryState;
  date: string;
  onAdd: (meal: MealType, food: FoodItem, quantity: number) => void;
  onRemove: (meal: MealType, entryId: string) => void;
  onQuantityChange: (meal: MealType, entryId: string, quantity: number) => void;
  onToggleFavorite: (food: FoodItem) => void;
  onTogglePin: (meal: MealType, food: FoodItem) => void;
  onContributeFood?: (food: FoodItem) => void;
  /** Coach adjustments; a pushed target overrides the day's goal + macro goals. */
  coaching?: CoachingDoc | null;
}

/** The selected day: a calorie summary against goal, then each meal. */
export function DayView({ state, date, onAdd, onRemove, onQuantityChange, onToggleFavorite, onTogglePin, onContributeFood, coaching }: DayViewProps) {
  const day = state.days[date] ?? emptyDay(date);
  const total = dayCalories(day);
  const macros = roundMacros(dayMacros(day));
  // A coach's pushed target takes precedence over the user's own goals.
  const target = coaching?.target;
  const goal = target?.calories ?? state.settings.dailyCalorieGoal;
  const macroGoals = target
    ? { protein: target.protein, carbs: target.carbs, fat: target.fat }
    : state.settings.macroGoals;
  const [analysis, setAnalysis] = useState<{ food: FoodItem; meal: MealType } | null>(null);

  // End-of-day balance suggestions: once the day is well underway (and only for
  // today), suggest low-impact foods to help finish out the calorie/macro goals.
  const suggestion = useMemo(() => {
    if (date !== todayISO()) return null;
    if (total <= 0 || total < goal * 0.5) return null;
    const gaps = {
      protein: macroGoals.protein - macros.protein,
      carbs: macroGoals.carbs - macros.carbs,
      fat: macroGoals.fat - macros.fat,
    };
    return suggestFoods(goal - total, gaps);
  }, [date, total, goal, macroGoals, macros]);

  return (
    <div className="day-view">
      <div className="day-summary">
        <h2>{formatLongDate(date)}</h2>
        <div className="summary-body">
          <CalorieRing eaten={total} goal={goal} />
          <div className="summary-side">
            <div className="summary-stats">
              <div className="summary-stat">
                <strong>{total}</strong><span>eaten</span>
              </div>
              <div className="summary-stat">
                <strong>{goal}</strong><span>goal</span>
              </div>
            </div>
            <MacroRings eaten={macros} goals={macroGoals} />
          </div>
        </div>
        {coaching && (coaching.target || (coaching.notes && coaching.notes.length > 0)) && (
          <CoachAdjustment coaching={coaching} />
        )}
      </div>

      {suggestion && suggestion.foods.length > 0 && (
        <div className="suggestion-card">
          <span className="suggestion-msg">{suggestion.message}</span>
          <div className="chip-row">
            {suggestion.foods.map((food) => (
              <button
                key={food.id}
                type="button"
                className="quick-chip"
                onClick={() => onAdd('snack', { ...food, id: crypto.randomUUID() }, 1)}
                title={`Add ${food.name} to snacks (${food.calories} cal)`}
              >
                {food.name}
                <span className="chip-macros">P {Math.round(food.protein ?? 0)} · C {Math.round(food.carbs ?? 0)} · F {Math.round(food.fat ?? 0)}</span>
              </button>
            ))}
          </div>
          <span className="suggestion-hint">Tap to add to snacks</span>
        </div>
      )}

      {MEAL_TYPES.map((meal) => (
        <MealSection
          key={meal}
          meal={meal}
          entries={day.meals[meal]}
          usdaApiKey={state.settings.usdaApiKey}
          jordanPriority={state.settings.jordanPriority}
          pinned={state.pinnedFoods?.[meal] ?? []}
          favorites={state.favorites}
          recipes={state.recipes}
          onAdd={(food, qty) => onAdd(meal, food, qty)}
          onRemove={(id) => onRemove(meal, id)}
          onQuantityChange={(id, qty) => onQuantityChange(meal, id, qty)}
          onToggleFavorite={onToggleFavorite}
          onTogglePin={(food) => onTogglePin(meal, food)}
          onShowAnalysis={(food) => setAnalysis({ food, meal })}
          onContributeFood={onContributeFood}
        />
      ))}

      {analysis && (
        <EntryAnalysisModal
          food={analysis.food}
          priority={state.settings.jordanPriority}
          usdaApiKey={state.settings.usdaApiKey}
          onAddAlternative={(f) => onAdd(analysis.meal, f, 1)}
          onClose={() => setAnalysis(null)}
        />
      )}
    </div>
  );
}
