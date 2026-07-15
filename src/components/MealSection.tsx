import type { FoodItem, JordanPriority, MealEntry, MealType, Recipe } from '../types';
import {
  MEAL_LABELS,
  entriesCalories,
  entriesMacros,
  entryCalories,
  entryMacros,
  hasMacros,
  isFavorite,
  isPinned,
  roundMacros,
} from '../types';
import { FoodSearch } from './FoodSearch';

interface MealSectionProps {
  meal: MealType;
  entries: MealEntry[];
  usdaApiKey: string;
  jordanPriority: JordanPriority;
  /** Foods pinned to this meal as quick-adds (opt-in). */
  pinned: FoodItem[];
  favorites: FoodItem[];
  recipes: Recipe[];
  onAdd: (food: FoodItem, quantity: number) => void;
  onRemove: (entryId: string) => void;
  onQuantityChange: (entryId: string, quantity: number) => void;
  onToggleFavorite: (food: FoodItem) => void;
  onTogglePin: (food: FoodItem) => void;
  onShowAnalysis: (food: FoodItem) => void;
  onContributeFood?: (food: FoodItem) => void;
}

/** One meal bucket for the selected day: its entries plus a search box. */
export function MealSection(props: MealSectionProps) {
  const {
    meal, entries, usdaApiKey, jordanPriority, pinned, favorites, recipes,
    onAdd, onRemove, onQuantityChange, onToggleFavorite, onTogglePin, onShowAnalysis, onContributeFood,
  } = props;
  const total = entriesCalories(entries);
  const macros = roundMacros(entriesMacros(entries));

  return (
    <section className="meal-section">
      <header className="meal-header">
        <h3>{MEAL_LABELS[meal]}</h3>
        <span className="meal-total">
          {total} cal
          {entries.length > 0 && (
            <span className="meal-macros"> · P {macros.protein} · C {macros.carbs} · F {macros.fat}</span>
          )}
        </span>
      </header>

      {entries.length > 0 && (
        <ul className="entry-list">
          {entries.map((entry) => (
            <li key={entry.id} className="entry">
              <div className="entry-main">
                {entry.food.source === 'off' && entry.food.sourceId ? (
                  <button
                    className="entry-name entry-name-button"
                    onClick={() => onShowAnalysis(entry.food)}
                    title="View pros/cons and Jordan's Suggestion"
                  >
                    {entry.food.name}
                    {entry.food.brand && <span className="entry-brand"> · {entry.food.brand}</span>}
                    <span className="entry-info">ⓘ</span>
                  </button>
                ) : (
                  <span className="entry-name">
                    {entry.food.name}
                    {entry.food.brand && <span className="entry-brand"> · {entry.food.brand}</span>}
                  </span>
                )}
                {hasMacros(entry.food) && (() => {
                  const m = roundMacros(entryMacros(entry));
                  return (
                    <span className="entry-serving">
                      <span className="entry-macros">P {m.protein} · C {m.carbs} · F {m.fat}</span>
                    </span>
                  );
                })()}
              </div>
              <div className="entry-controls">
                <input
                  className="qty-input"
                  type="number"
                  min="0"
                  step="any"
                  value={entry.quantity}
                  onChange={(e) => {
                    const q = parseFloat(e.target.value);
                    if (Number.isFinite(q) && q >= 0) onQuantityChange(entry.id, q);
                  }}
                  aria-label="Servings"
                />
                <span className="entry-cals">{entryCalories(entry)} cal</span>
                {entry.food.source !== 'recipe' && (
                  <>
                    <button
                      className={`star-button ${isPinned(pinned, entry.food) ? 'active' : ''}`}
                      onClick={() => onTogglePin(entry.food)}
                      title={isPinned(pinned, entry.food) ? 'Unpin from this meal' : 'Pin to this meal as a quick-add'}
                      aria-label="Toggle pin"
                    >
                      {isPinned(pinned, entry.food) ? '📌' : '📍'}
                    </button>
                    <button
                      className={`star-button ${isFavorite(favorites, entry.food) ? 'active' : ''}`}
                      onClick={() => onToggleFavorite(entry.food)}
                      title={isFavorite(favorites, entry.food) ? 'Remove from favorites' : 'Save to favorites'}
                      aria-label="Toggle favorite"
                    >
                      {isFavorite(favorites, entry.food) ? '★' : '☆'}
                    </button>
                  </>
                )}
                <button
                  className="remove-button"
                  onClick={() => onRemove(entry.id)}
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FoodSearch
        meal={meal}
        usdaApiKey={usdaApiKey}
        jordanPriority={jordanPriority}
        pinned={pinned}
        favorites={favorites}
        recipes={recipes}
        onAdd={onAdd}
        onToggleFavorite={onToggleFavorite}
        onContributeFood={onContributeFood}
      />
    </section>
  );
}
