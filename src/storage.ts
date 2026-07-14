// ---------------------------------------------------------------------------
// Persistence layer. The diary lives in localStorage so the app works with no
// backend and no login. Export/import lets the user back up or move the data
// between browsers/devices.
// ---------------------------------------------------------------------------

import type { DiaryState, Settings } from './types';
import { DEFAULT_PROFILE, macroGoalsFromCalories } from './nutrition';

const STORAGE_KEY = 'calorie-tracker:diary';
const CURRENT_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  dailyCalorieGoal: 2000,
  usdaApiKey: '',
  jordanPriority: 'balanced',
  profile: { ...DEFAULT_PROFILE },
  macroGoals: macroGoalsFromCalories(2000),
};

export function defaultState(): DiaryState {
  return {
    version: CURRENT_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    days: {},
    favorites: [],
    recipes: [],
    bodyScans: [],
  };
}

/** Load and validate the diary from localStorage, falling back to defaults. */
export function loadState(): DiaryState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<DiaryState>;
    return normalize(parsed);
  } catch (err) {
    console.warn('Failed to load diary, starting fresh:', err);
    return defaultState();
  }
}

/** Persist the diary to localStorage. */
export function saveState(state: DiaryState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save diary:', err);
  }
}

/**
 * Coerce an arbitrary parsed object into a valid DiaryState. Spreads the stored
 * input first so any fields a newer version may have added are preserved (never
 * dropped) even if this client doesn't know about them.
 */
function normalize(input: Partial<DiaryState>): DiaryState {
  const base = defaultState();
  const settingsIn: Partial<Settings> = input.settings ?? {};
  return {
    ...input,
    version: CURRENT_VERSION,
    settings: {
      ...base.settings,
      ...settingsIn,
      profile: { ...base.settings.profile, ...(settingsIn.profile ?? {}) },
      macroGoals: { ...base.settings.macroGoals, ...(settingsIn.macroGoals ?? {}) },
    },
    days: input.days ?? {},
    favorites: input.favorites ?? [],
    recipes: input.recipes ?? [],
    bodyScans: input.bodyScans ?? [],
  };
}

/** Serialize the diary as a downloadable JSON string. */
export function exportState(state: DiaryState): string {
  return JSON.stringify(state, null, 2);
}

/** Parse an imported JSON string back into a DiaryState. Throws on bad input. */
export function importState(json: string): DiaryState {
  const parsed = JSON.parse(json) as Partial<DiaryState>;
  if (typeof parsed !== 'object' || parsed === null || !('days' in parsed)) {
    throw new Error('This file does not look like a calorie-tracker export.');
  }
  return normalize(parsed);
}
