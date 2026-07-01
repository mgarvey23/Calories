// Derives a list of recently-used foods from the diary so common items can be
// re-logged in one tap without searching again. Computed on the fly from
// existing entries — no extra data is stored.

import type { DiaryState, FoodItem } from './types';
import { MEAL_TYPES } from './types';

/** Identity for de-duping foods across entries (same product / manual food). */
function foodKey(f: FoodItem): string {
  return `${f.source}:${f.sourceId ?? ''}:${f.name.toLowerCase()}:${f.calories}`;
}

/**
 * Most-recently-logged distinct foods, newest first, tie-broken by how often
 * they've been logged. Scans every day's entries in date order.
 */
export function recentFoods(state: DiaryState, limit = 8): FoodItem[] {
  const seen = new Map<string, { food: FoodItem; count: number; order: number }>();
  let order = 0;

  for (const date of Object.keys(state.days).sort()) {
    const day = state.days[date];
    for (const meal of MEAL_TYPES) {
      for (const entry of day.meals[meal]) {
        const key = foodKey(entry.food);
        const existing = seen.get(key);
        if (existing) {
          existing.count += 1;
          existing.order = order++;
          existing.food = entry.food;
        } else {
          seen.set(key, { food: entry.food, count: 1, order: order++ });
        }
      }
    }
  }

  return [...seen.values()]
    .sort((a, b) => b.order - a.order || b.count - a.count)
    .slice(0, limit)
    .map((v) => v.food);
}
