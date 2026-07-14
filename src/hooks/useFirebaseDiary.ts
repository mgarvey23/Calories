import { useCallback, useEffect, useRef, useState } from 'react';
import type { BodyScan, DiaryState, FoodItem, MealEntry, MealType, Recipe, Settings } from '../types';
import {
  addBodyScanOp,
  addEntryOp,
  deleteBodyScanOp,
  deleteRecipeOp,
  removeEntryOp,
  saveRecipeOp,
  toggleFavoriteOp,
  togglePinOp,
  updateEntryQuantityOp,
  updateSettingsOp,
} from '../diaryOps';
import { defaultState, loadState } from '../storage';
import { saveDiary, subscribeDiary } from '../services/firestoreDiary';
import { auth } from '../firebase';

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    setState(null);
    setError(null);
    const unsub = subscribeDiary(
      uid,
      (remote) => setState(remote),
      () => {
        // No cloud document yet: seed from any local diary, else defaults.
        const local = loadState();
        const seed = Object.keys(local.days).length > 0 ? local : defaultState();
        // Seed the real name from the account's display name (set at sign-up).
        const displayName = auth?.currentUser?.displayName?.trim();
        if (displayName && !seed.settings.profile.name) {
          seed.settings.profile.name = displayName;
        }
        setState(seed);
        void saveDiary(uid, seed);
      },
      (err) => setError(err.message),
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
          saveDiary(uid, next).catch((err) => {
            // Surface the failure instead of silently losing the write.
            console.error('Failed to save diary:', err);
            setError('Could not save your latest changes — check your connection.');
          });
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
  const addBodyScan = useCallback((scan: BodyScan) => mutate((s) => addBodyScanOp(s, scan)), [mutate]);
  const deleteBodyScan = useCallback(
    (scanId: string) => mutate((s) => deleteBodyScanOp(s, scanId)),
    [mutate],
  );
  const togglePin = useCallback(
    (meal: MealType, food: FoodItem) => mutate((s) => togglePinOp(s, meal, food)),
    [mutate],
  );

  return {
    state,
    error,
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
    togglePin,
  };
}
