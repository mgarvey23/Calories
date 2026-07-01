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

/** Macronutrient totals in grams. */
export interface Macros {
  protein: number;
  carbs: number;
  fat: number;
}

export const ZERO_MACROS: Macros = { protein: 0, carbs: 0, fat: 0 };

/** Calories contributed by a single entry (per-serving calories * quantity). */
export function entryCalories(entry: MealEntry): number {
  return Math.round(entry.food.calories * entry.quantity);
}

/** Macros contributed by a single entry, scaled by quantity. */
export function entryMacros(entry: MealEntry): Macros {
  const { food, quantity } = entry;
  return {
    protein: (food.protein ?? 0) * quantity,
    carbs: (food.carbs ?? 0) * quantity,
    fat: (food.fat ?? 0) * quantity,
  };
}

/** True if the food carries any macro data at all. */
export function hasMacros(food: FoodItem): boolean {
  return food.protein !== undefined || food.carbs !== undefined || food.fat !== undefined;
}

/** Sum macros across a list of entries. */
export function entriesMacros(entries: MealEntry[]): Macros {
  return entries.reduce<Macros>((acc, e) => {
    const m = entryMacros(e);
    return { protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat };
  }, { ...ZERO_MACROS });
}

/** Sum macros across every meal in a day. */
export function dayMacros(day: DayLog | undefined): Macros {
  if (!day) return { ...ZERO_MACROS };
  return MEAL_TYPES.reduce<Macros>((acc, m) => {
    const mm = entriesMacros(day.meals[m]);
    return { protein: acc.protein + mm.protein, carbs: acc.carbs + mm.carbs, fat: acc.fat + mm.fat };
  }, { ...ZERO_MACROS });
}

/** Round each macro to the nearest gram, for display. */
export function roundMacros(m: Macros): Macros {
  return { protein: Math.round(m.protein), carbs: Math.round(m.carbs), fat: Math.round(m.fat) };
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
