import { useCallback, useEffect, useState } from 'react';
import type { DiaryState, MealEntry, MealType, Settings } from '../types';
import { emptyDay } from '../types';
import { loadState, saveState } from '../storage';

/**
 * Central diary state. Owns the persisted DiaryState and exposes mutation
 * helpers. Every change is written back to localStorage.
 */
export function useDiary() {
  const [state, setState] = useState<DiaryState>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  const addEntry = useCallback((date: string, meal: MealType, entry: MealEntry) => {
    setState((prev) => {
      const day = prev.days[date] ?? emptyDay(date);
      return {
        ...prev,
        days: {
          ...prev.days,
          [date]: { ...day, meals: { ...day.meals, [meal]: [...day.meals[meal], entry] } },
        },
      };
    });
  }, []);

  const removeEntry = useCallback((date: string, meal: MealType, entryId: string) => {
    setState((prev) => {
      const day = prev.days[date];
      if (!day) return prev;
      return {
        ...prev,
        days: {
          ...prev.days,
          [date]: {
            ...day,
            meals: { ...day.meals, [meal]: day.meals[meal].filter((e) => e.id !== entryId) },
          },
        },
      };
    });
  }, []);

  const updateEntryQuantity = useCallback(
    (date: string, meal: MealType, entryId: string, quantity: number) => {
      setState((prev) => {
        const day = prev.days[date];
        if (!day) return prev;
        return {
          ...prev,
          days: {
            ...prev.days,
            [date]: {
              ...day,
              meals: {
                ...day.meals,
                [meal]: day.meals[meal].map((e) =>
                  e.id === entryId ? { ...e, quantity } : e,
                ),
              },
            },
          },
        };
      });
    },
    [],
  );

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  }, []);

  const replaceState = useCallback((next: DiaryState) => setState(next), []);

  return { state, addEntry, removeEntry, updateEntryQuantity, updateSettings, replaceState };
}
