import type { Profile } from './nutrition';

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
export type FoodSource = 'off' | 'usda' | 'manual' | 'recipe' | 'community';

/** How "Jordan's Suggestion" ranks alternative products. Chosen per profile. */
export type JordanPriority = 'balanced' | 'calories' | 'protein' | 'clean';

export const JORDAN_PRIORITIES: JordanPriority[] = ['balanced', 'calories', 'protein', 'clean'];

export const JORDAN_PRIORITY_LABELS: Record<JordanPriority, string> = {
  balanced: 'Balanced (calories, protein, sugar, processing)',
  calories: 'Fewest calories per serving',
  protein: 'Most protein per calorie',
  clean: 'Least processed (Nutri-Score / NOVA)',
};

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

/** A user-saved recipe: named list of ingredients that yields N servings. */
export interface Recipe {
  id: string;
  name: string;
  /** Ingredients, each a food with a quantity (in that food's servings). */
  ingredients: MealEntry[];
  /** How many servings the whole recipe makes. */
  servings: number;
}

/** User-level settings, persisted alongside the diary. */
export interface Settings {
  /** Daily calorie target, used for progress display. */
  dailyCalorieGoal: number;
  /** Optional USDA FoodData Central API key. Falls back to DEMO_KEY if empty. */
  usdaApiKey: string;
  /** How "Jordan's Suggestion" ranks alternatives. */
  jordanPriority: JordanPriority;
  /** Body profile used to recommend a calorie goal. */
  profile: Profile;
  /** Daily macro targets in grams (protein/carbs/fat). */
  macroGoals: Macros;
}

// --- Coaching ("focus meeting") ---------------------------------------------

/** A daily target a coach can push to a client; drives their rings when set. */
export interface CoachTarget {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** One written note/suggestion from the coach to a client. */
export interface CoachNote {
  id: string;
  text: string;
  /** ISO timestamp the note was written. */
  createdAt: string;
}

/**
 * The coach's adjustments for one client, stored at `coaching/{clientUid}` —
 * separate from the client's own `users/{uid}` doc (which the client rewrites
 * wholesale) so coach writes are never clobbered.
 */
export interface CoachingDoc {
  notes: CoachNote[];
  /** Optional pushed daily target; when present it overrides the client's goals. */
  target?: CoachTarget;
  /** Display name of the coach, for the client-facing banner. */
  coachName?: string;
  /** ISO timestamp of the last coach edit. */
  updatedAt: string;
}

/** Lean + fat mass (kg) for one body segment in the Evolt segmental analysis. */
export interface SegmentMass {
  leanKg?: number;
  fatKg?: number;
}

export type SupplementGoal = 'fat_loss' | 'muscle_gain' | 'optimal_health';

/**
 * One body-composition scan (e.g. from an Evolt 360), logged by date. Captures
 * the full Evolt sheet. Mass/length fields are stored canonically (kg, cm); the
 * UI converts for display based on the user's unit preference. Every metric is
 * optional so a partial scan (or a partial OCR read) still saves.
 */
export interface BodyScan {
  id: string;
  /** ISO date "YYYY-MM-DD" of the scan. */
  date: string;

  // --- Body composition (Evolt 1–13) ---
  /** Body weight (kg). */
  weightKg?: number;
  /** Lean body mass (kg). */
  leanBodyMassKg?: number;
  /** Skeletal muscle mass (kg). */
  muscleMassKg?: number;
  /** Protein mass (kg). */
  proteinKg?: number;
  /** Mineral mass (kg). */
  mineralKg?: number;
  /** Total body water (kg). */
  totalBodyWaterKg?: number;
  /** Body fat mass (kg). */
  bodyFatMassKg?: number;
  /** Subcutaneous fat mass (kg). */
  subcutaneousFatMassKg?: number;
  /** Visceral fat mass (kg). */
  visceralFatMassKg?: number;
  /** Visceral fat area (cm²). */
  visceralFatAreaCm2?: number;
  /** Total body fat percentage (%). */
  bodyFatPct?: number;
  /** Visceral fat level (index). */
  visceralFatLevel?: number;
  /** Intracellular fluid (kg). */
  icfKg?: number;
  /** Extracellular fluid (kg). */
  ecfKg?: number;

  // --- Energy (Evolt 14–15) ---
  /** Basal metabolic rate (kcal/day). */
  bmr?: number;
  /** Total energy expenditure (kcal/day). */
  tee?: number;

  // --- Indices (Evolt 16–17, 19–20) ---
  /** Biological age (years). */
  bioAge?: number;
  /** BWI score (out of 10). */
  bwiScore?: number;
  /** Abdominal circumference (cm). */
  abdominalCircumferenceCm?: number;
  /** Waist-to-hip ratio. */
  waistToHipRatio?: number;

  // --- Segmental analysis (Evolt 18) ---
  segmental?: {
    leftArm?: SegmentMass;
    rightArm?: SegmentMass;
    torso?: SegmentMass;
    leftLeg?: SegmentMass;
    rightLeg?: SegmentMass;
  };
  /** Upper-lower body balance (true = balanced). */
  upperLowerBalanced?: boolean;
  /** Left-right body balance (true = balanced). */
  leftRightBalanced?: boolean;

  // --- Evolt nutrition recommendation (Evolt 21–24) ---
  recCaloriesLow?: number;
  recCaloriesHigh?: number;
  recProteinG?: number;
  recCarbsG?: number;
  recFatG?: number;

  // --- Supplement recommendation ---
  supplementGoal?: SupplementGoal;
  supplements?: string[];

  /** Optional free-text note. */
  note?: string;
}

/** A lightweight roster entry so the coach can enumerate clients by name. */
export interface RosterEntry {
  uid: string;
  username: string;
  /** ISO timestamp of the client's last activity/sign-in. */
  updatedAt: string;
}

/** The full persisted state: settings, saved foods/recipes, and every day. */
export interface DiaryState {
  version: number;
  settings: Settings;
  days: Record<string, DayLog>;
  /** Foods the user has starred for one-tap re-logging. */
  favorites: FoodItem[];
  /** User-created recipes. */
  recipes: Recipe[];
  /** Body-composition scans over time (e.g. Evolt 360). */
  bodyScans: BodyScan[];
  /** Foods the user has pinned as quick-adds, per meal (opt-in, not automatic). */
  pinnedFoods: Partial<Record<MealType, FoodItem[]>>;
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

// --- Favorites & recipes ---------------------------------------------------

/** Stable identity for a food, used to match favorites. */
export function foodKey(f: FoodItem): string {
  return `${f.source}:${f.sourceId ?? ''}:${f.name.toLowerCase()}:${f.calories}`;
}

/** True if a food is already in the favorites list. */
export function isFavorite(favorites: FoodItem[], food: FoodItem): boolean {
  const key = foodKey(food);
  return favorites.some((f) => foodKey(f) === key);
}

/** True if a food is already pinned to the given meal's quick-adds. */
export function isPinned(pinned: FoodItem[] | undefined, food: FoodItem): boolean {
  if (!pinned) return false;
  const key = foodKey(food);
  return pinned.some((f) => foodKey(f) === key);
}

/** Total calories + macros for an entire recipe (all servings). */
export function recipeTotals(recipe: Recipe): { calories: number } & Macros {
  const calories = entriesCalories(recipe.ingredients);
  const m = entriesMacros(recipe.ingredients);
  return { calories, ...m };
}

/** A FoodItem representing one serving of a recipe, ready to log. */
export function recipeServingFood(recipe: Recipe): FoodItem {
  const totals = recipeTotals(recipe);
  const servings = recipe.servings > 0 ? recipe.servings : 1;
  return {
    id: crypto.randomUUID(),
    name: recipe.name,
    source: 'recipe',
    sourceId: recipe.id,
    servingSize: 1,
    servingUnit: 'serving',
    calories: Math.round(totals.calories / servings),
    protein: Math.round((totals.protein / servings) * 10) / 10,
    carbs: Math.round((totals.carbs / servings) * 10) / 10,
    fat: Math.round((totals.fat / servings) * 10) / 10,
  };
}

/**
 * The diary operations the main UI needs, independent of where the data is
 * stored. Both the local (localStorage) and Firebase-backed hooks return this
 * shape so the view doesn't care which backend is active.
 */
export interface DiaryApi {
  state: DiaryState;
  addEntry: (date: string, meal: MealType, entry: MealEntry) => void;
  removeEntry: (date: string, meal: MealType, entryId: string) => void;
  updateEntryQuantity: (date: string, meal: MealType, entryId: string, quantity: number) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  replaceState: (next: DiaryState) => void;
  toggleFavorite: (food: FoodItem) => void;
  saveRecipe: (recipe: Recipe) => void;
  deleteRecipe: (recipeId: string) => void;
  addBodyScan: (scan: BodyScan) => void;
  deleteBodyScan: (scanId: string) => void;
  togglePin: (meal: MealType, food: FoodItem) => void;
}
