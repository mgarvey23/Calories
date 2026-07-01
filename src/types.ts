// ---------------------------------------------------------------------------
// Core data model for the calorie tracker.
//
// The hierarchy is: DayLog (one calendar day) -> meals (breakfast/lunch/...) ->
// MealEntry (a food logged with a quantity) -> FoodItem (the underlying food
// and its per-serving nutrition, sourced from a food database or entered by
// hand).
// ---------------------------------------------------------------------------

/** The meal buckets a day is segregated into. */
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

/** Where the nutrition data for a food came from. */
export type FoodSource = 'off' | 'usda' | 'manual';

/**
 * A food and its nutrition for one reference serving. Calories/macros are
 * expressed per single serving (see `servingSize`/`servingUnit`); the amount
 * actually eaten is captured by the `quantity` on a MealEntry.
 */
export interface FoodItem {
  /** Stable id, unique within the diary. */
  id: string;
  name: string;
  brand?: string;
  source: FoodSource;
  /** Barcode (Open Food Facts) or fdcId (USDA); absent for manual entries. */
  sourceId?: string;
  /** Numeric size of one serving, e.g. 100. */
  servingSize: number;
  /** Unit of one serving, e.g. "g", "ml", "item". */
  servingUnit: string;
  /** Calories in one serving. */
  calories: number;
  /** Macronutrients in one serving, in grams. Optional. */
  protein?: number;
  carbs?: number;
  fat?: number;
}

/** A food logged into a meal, with how many servings were eaten. */
export interface MealEntry {
  id: string;
  food: FoodItem;
  /** Number of servings of `food` eaten. */
  quantity: number;
}

/** Everything logged on a single calendar day. */
export interface DayLog {
  /** ISO date, "YYYY-MM-DD", in the user's local timezone. */
  date: string;
  meals: Record<MealType, MealEntry[]>;
}

/** User-level settings, persisted alongside the diary. */
export interface Settings {
  /** Daily calorie target, used for progress display. */
  dailyCalorieGoal: number;
  /** Optional USDA FoodData Central API key. Falls back to DEMO_KEY if empty. */
  usdaApiKey: string;
}

/** The full persisted state: settings plus every day keyed by ISO date. */
export interface DiaryState {
  version: number;
  settings: Settings;
  days: Record<string, DayLog>;
}

// --- Derived helpers -------------------------------------------------------

/** Calories contributed by a single entry (per-serving calories * quantity). */
export function entryCalories(entry: MealEntry): number {
  return Math.round(entry.food.calories * entry.quantity);
}

/** Total calories for a list of entries. */
export function entriesCalories(entries: MealEntry[]): number {
  return entries.reduce((sum, e) => sum + entryCalories(e), 0);
}

/** Total calories logged for a whole day across all meals. */
export function dayCalories(day: DayLog | undefined): number {
  if (!day) return 0;
  return MEAL_TYPES.reduce((sum, m) => sum + entriesCalories(day.meals[m]), 0);
}

/** An empty day skeleton for a given ISO date. */
export function emptyDay(date: string): DayLog {
  return {
    date,
    meals: { breakfast: [], lunch: [], dinner: [], snack: [] },
  };
}
