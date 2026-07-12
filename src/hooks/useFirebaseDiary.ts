import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiaryState, FoodItem, MealEntry, MealType, Recipe, Settings } from '../types';
import {
  addEntryOp,
  deleteRecipeOp,
  removeEntryOp,
  saveRecipeOp,
  toggleFavoriteOp,
  updateEntryQuantityOp,
  updateSettingsOp,
} from '../diaryOps';
import { defaultState, loadState } from '../storage';
import { saveDiary, subscribeDiary } from '../services/firestoreDiary';

const SAVE_DEBOUNCE_MS = 700;

/**
 * Cloud-synced diary for a signed-in user. Subscribes to the Firestore document
 * for `uid`, applies mutations optimistically, and writes changes back
 * (debounced). On first sign-in with no cloud document, any existing local diary
 * is migrated up.
 */
export function useFirebaseDiary(uid: string) {
  const [state, setState] = useState<DiaryState | null>(null);
  const stateRef = useRef<DiaryState | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    setState(null);
    const unsub = subscribeDiary(
      uid,
      (remote) => setState(remote),
      () => {
        // No cloud document yet: seed from any local diary, else defaults.
        const local = loadState();
        const seed = Object.keys(local.days).length > 0 ? local : defaultState();
        setState(seed);
        void saveDiary(uid, seed);
      },
    );
    return () => {
      unsub();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [uid]);

  // Apply a pure op, update local state immediately, and schedule a cloud write.
  const mutate = useCallback(
    (fn: (s: DiaryState) => DiaryState) => {
      setState((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        stateRef.current = next;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          void saveDiary(uid, next);
        }, SAVE_DEBOUNCE_MS);
        return next;
      });
    },
    [uid],
  );

  const addEntry = useCallback(
    (date: string, meal: MealType, entry: MealEntry) =>
      mutate((s) => addEntryOp(s, date, meal, entry)),
    [mutate],
  );
  const removeEntry = useCallback(
    (date: string, meal: MealType, entryId: string) =>
      mutate((s) => removeEntryOp(s, date, meal, entryId)),
    [mutate],
  );
  const updateEntryQuantity = useCallback(
    (date: string, meal: MealType, entryId: string, quantity: number) =>
      mutate((s) => updateEntryQuantityOp(s, date, meal, entryId, quantity)),
    [mutate],
  );
  const updateSettings = useCallback(
    (patch: Partial<Settings>) => mutate((s) => updateSettingsOp(s, patch)),
    [mutate],
  );
  const replaceState = useCallback((next: DiaryState) => mutate(() => next), [mutate]);
  const toggleFavorite = useCallback(
    (food: FoodItem) => mutate((s) => toggleFavoriteOp(s, food)),
    [mutate],
  );
  const saveRecipe = useCallback((recipe: Recipe) => mutate((s) => saveRecipeOp(s, recipe)), [mutate]);
  const deleteRecipe = useCallback(
    (recipeId: string) => mutate((s) => deleteRecipeOp(s, recipeId)),
    [mutate],
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
  };
}
