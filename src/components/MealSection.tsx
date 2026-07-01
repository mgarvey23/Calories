import type { FoodItem, MealEntry, MealType } from '../types';
import { MEAL_LABELS, entriesCalories, entryCalories } from '../types';
import { FoodSearch } from './FoodSearch';

interface MealSectionProps {
  meal: MealType;
  entries: MealEntry[];
  usdaApiKey: string;
  onAdd: (food: FoodItem, quantity: number) => void;
  onRemove: (entryId: string) => void;
  onQuantityChange: (entryId: string, quantity: number) => void;
}

/** One meal bucket for the selected day: its entries plus a search box. */
export function MealSection(props: MealSectionProps) {
  const { meal, entries, usdaApiKey, onAdd, onRemove, onQuantityChange } = props;
  const total = entriesCalories(entries);

  return (
    <section className="meal-section">
      <header className="meal-header">
        <h3>{MEAL_LABELS[meal]}</h3>
        <span className="meal-total">{total} kcal</span>
      </header>

      {entries.length > 0 && (
        <ul className="entry-list">
          {entries.map((entry) => (
            <li key={entry.id} className="entry">
              <div className="entry-main">
                <span className="entry-name">
                  {entry.food.name}
                  {entry.food.brand && <span className="entry-brand"> · {entry.food.brand}</span>}
                </span>
                <span className="entry-serving">
                  {entry.food.servingSize * entry.quantity}
                  {entry.food.servingUnit}
                </span>
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
                <span className="entry-cals">{entryCalories(entry)} kcal</span>
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

      <FoodSearch meal={meal} usdaApiKey={usdaApiKey} onAdd={onAdd} />
    </section>
  );
}
