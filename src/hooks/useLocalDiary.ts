import { useCallback, useEffect, useState } from 'react';
import type { BodyScan, DiaryState, FoodItem, MealEntry, MealType, Recipe, Settings } from '../types';
import {
  addBodyScanOp,
  addEntryOp,
  deleteBodyScanOp,
  deleteRecipeOp,
  removeEntryOp,
  saveRecipeOp,
  toggleFavoriteOp,
  updateEntryQuantityOp,
  updateSettingsOp,
} from '../diaryOps';
import { loadState, saveState } from '../storage';

/**
 * On-device diary backed by localStorage. Used in "local mode" (no sign-in),
 * so the app is fully usable without Firebase configured. Shares the same
 * mutation ops and API shape as the Firebase-backed hook.
 */
export function useLocalDiary() {
  const [state, setState] = useState<DiaryState>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  const addEntry = useCallback(
    (date: string, meal: MealType, entry: MealEntry) =>
      setState((s) => addEntryOp(s, date, meal, entry)),
    [],
  );
  const removeEntry = useCallback(
    (date: string, meal: MealType, entryId: string) =>
      setState((s) => removeEntryOp(s, date, meal, entryId)),
    [],
  );
  const updateEntryQuantity = useCallback(
    (date: string, meal: MealType, entryId: string, quantity: number) =>
      setState((s) => updateEntryQuantityOp(s, date, meal, entryId, quantity)),
    [],
  );
  const updateSettings = useCallback(
    (patch: Partial<Settings>) => setState((s) => updateSettingsOp(s, patch)),
    [],
  );
  const replaceState = useCallback((next: DiaryState) => setState(next), []);
  const toggleFavorite = useCallback(
    (food: FoodItem) => setState((s) => toggleFavoriteOp(s, food)),
    [],
  );
  const saveRecipe = useCallback((recipe: Recipe) => setState((s) => saveRecipeOp(s, recipe)), []);
  const deleteRecipe = useCallback(
    (recipeId: string) => setState((s) => deleteRecipeOp(s, recipeId)),
    [],
  );
  const addBodyScan = useCallback((scan: BodyScan) => setState((s) => addBodyScanOp(s, scan)), []);
  const deleteBodyScan = useCallback(
    (scanId: string) => setState((s) => deleteBodyScanOp(s, scanId)),
    [],
  );

  return {
    state,
    addEntry,
    removeEntry,
    updateEntryQuantity,
    updateSettings,
    replaceState,
    toggleFavorite,
    saveRecipe,
    deleteRecipe,
    addBodyScan,
    deleteBodyScan,
  };
}
