// Pure, storage-agnostic diary mutations. Each takes the current DiaryState and
// returns a new one. Both the local and the Firebase-backed hooks build on
// these so the mutation logic lives in exactly one place.

import type { DiaryState, MealEntry, MealType, Settings } from './types';
import { emptyDay } from './types';

export function addEntryOp(
  state: DiaryState,
  date: string,
  meal: MealType,
  entry: MealEntry,
): DiaryState {
  const day = state.days[date] ?? emptyDay(date);
  return {
    ...state,
    days: {
      ...state.days,
      [date]: { ...day, meals: { ...day.meals, [meal]: [...day.meals[meal], entry] } },
    },
  };
}

export function removeEntryOp(
  state: DiaryState,
  date: string,
  meal: MealType,
  entryId: string,
): DiaryState {
  const day = state.days[date];
  if (!day) return state;
  return {
    ...state,
    days: {
      ...state.days,
      [date]: {
        ...day,
        meals: { ...day.meals, [meal]: day.meals[meal].filter((e) => e.id !== entryId) },
      },
    },
  };
}

export function updateEntryQuantityOp(
  state: DiaryState,
  date: string,
  meal: MealType,
  entryId: string,
  quantity: number,
): DiaryState {
  const day = state.days[date];
  if (!day) return state;
  return {
    ...state,
    days: {
      ...state.days,
      [date]: {
        ...day,
        meals: {
          ...day.meals,
          [meal]: day.meals[meal].map((e) => (e.id === entryId ? { ...e, quantity } : e)),
        },
      },
    },
  };
}

export function updateSettingsOp(state: DiaryState, patch: Partial<Settings>): DiaryState {
  return { ...state, settings: { ...state.settings, ...patch } };
}
