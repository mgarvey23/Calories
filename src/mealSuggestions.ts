// Suggests goal-friendly foods for the rest of the day based on how much room
// is left against the calorie and macro goals. Pure and offline — a small
// curated list of common, low-impact, mostly high-protein options.

import type { FoodItem, Macros } from './types';

interface SuggestionFood {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: number;
  servingUnit: string;
}

// Per single serving. Ordered roughly protein-dense first, then light produce.
const FOODS: SuggestionFood[] = [
  { name: 'Grilled chicken breast', calories: 185, protein: 35, carbs: 0, fat: 4, servingSize: 4, servingUnit: 'oz' },
  { name: 'Egg whites', calories: 125, protein: 26, carbs: 2, fat: 0, servingSize: 1, servingUnit: 'cup' },
  { name: 'Tuna (canned in water)', calories: 100, protein: 22, carbs: 0, fat: 1, servingSize: 1, servingUnit: 'can' },
  { name: 'Whey protein shake', calories: 120, protein: 24, carbs: 3, fat: 2, servingSize: 1, servingUnit: 'scoop' },
  { name: 'Turkey breast', calories: 90, protein: 19, carbs: 0, fat: 1, servingSize: 3, servingUnit: 'oz' },
  { name: 'Nonfat Greek yogurt', calories: 90, protein: 16, carbs: 6, fat: 0, servingSize: 0.75, servingUnit: 'cup' },
  { name: 'Cottage cheese (low-fat)', calories: 90, protein: 12, carbs: 5, fat: 2.5, servingSize: 0.5, servingUnit: 'cup' },
  { name: 'Beef jerky', calories: 80, protein: 13, carbs: 3, fat: 1, servingSize: 1, servingUnit: 'oz' },
  { name: 'Edamame', calories: 100, protein: 9, carbs: 8, fat: 4, servingSize: 0.5, servingUnit: 'cup' },
  { name: 'String cheese', calories: 80, protein: 7, carbs: 1, fat: 6, servingSize: 1, servingUnit: 'stick' },
  { name: 'Two eggs', calories: 140, protein: 12, carbs: 1, fat: 10, servingSize: 2, servingUnit: 'eggs' },
  { name: 'Protein bar', calories: 200, protein: 20, carbs: 22, fat: 7, servingSize: 1, servingUnit: 'bar' },
  { name: 'Apple', calories: 95, protein: 0, carbs: 25, fat: 0, servingSize: 1, servingUnit: 'medium' },
  { name: 'Banana', calories: 105, protein: 1, carbs: 27, fat: 0, servingSize: 1, servingUnit: 'medium' },
  { name: 'Almonds', calories: 165, protein: 6, carbs: 6, fat: 14, servingSize: 1, servingUnit: 'oz' },
  { name: 'Mixed green salad (light dressing)', calories: 60, protein: 2, carbs: 6, fat: 3, servingSize: 1, servingUnit: 'bowl' },
  { name: 'Steamed broccoli', calories: 55, protein: 4, carbs: 11, fat: 1, servingSize: 1, servingUnit: 'cup' },
  { name: 'Baby carrots', calories: 50, protein: 1, carbs: 12, fat: 0, servingSize: 1, servingUnit: 'cup' },
  { name: 'Cucumber slices', calories: 16, protein: 1, carbs: 4, fat: 0, servingSize: 1, servingUnit: 'cup' },
  { name: 'Cherry tomatoes', calories: 27, protein: 1, carbs: 6, fat: 0, servingSize: 1, servingUnit: 'cup' },
];

function toFood(f: SuggestionFood): FoodItem {
  return {
    id: crypto.randomUUID(),
    name: f.name,
    source: 'manual',
    servingSize: f.servingSize,
    servingUnit: f.servingUnit,
    calories: f.calories,
    protein: f.protein,
    carbs: f.carbs,
    fat: f.fat,
  };
}

export interface SuggestionResult {
  message: string;
  foods: FoodItem[];
}

/**
 * Given calories left and the remaining macro gaps for the day, suggest a few
 * foods that help close them without blowing the calorie budget. When already
 * over on calories, only very light options are offered.
 */
export function suggestFoods(remainingCal: number, gaps: Macros, limit = 4): SuggestionResult {
  const proteinGap = Math.max(0, Math.round(gaps.protein));

  // Over budget: only light, high-volume options.
  if (remainingCal <= 0) {
    const foods = FOODS.filter((f) => f.calories <= 60)
      .sort((a, b) => a.calories - b.calories)
      .slice(0, limit)
      .map(toFood);
    return {
      message: "You're over your calorie goal — if you're still hungry, these are low-impact:",
      foods,
    };
  }

  const budget = remainingCal + 50; // allow a small overshoot
  const affordable = FOODS.filter((f) => f.calories <= budget);
  const pool = affordable.length > 0 ? affordable : FOODS.filter((f) => f.calories <= 60);

  // Protein still short and it's the priority → protein-dense picks.
  if (proteinGap >= 12) {
    const foods = [...pool]
      .sort((a, b) => b.protein - a.protein || a.calories - b.calories)
      .slice(0, limit)
      .map(toFood);
    return {
      message: `About ${remainingCal} kcal and ${proteinGap}g protein left — protein-forward picks:`,
      foods,
    };
  }

  // Otherwise round out the day with lighter options.
  const foods = [...pool]
    .sort((a, b) => a.calories - b.calories)
    .slice(0, limit)
    .map(toFood);
  return {
    message: `About ${remainingCal} kcal left — light options to finish your day:`,
    foods,
  };
}
