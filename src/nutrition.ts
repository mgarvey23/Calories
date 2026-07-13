// ---------------------------------------------------------------------------
// Body profile and calorie-goal math.
//
// Uses the Mifflin-St Jeor equation for BMR, an activity multiplier for TDEE
// (maintenance calories), and a goal adjustment (deficit/surplus) to recommend
// a daily calorie target.
// ---------------------------------------------------------------------------

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type GoalType = 'lose' | 'maintain' | 'gain';
export type Units = 'imperial' | 'metric';

export interface Profile {
  age?: number;
  sex?: Sex;
  heightCm?: number;
  weightKg?: number;
  activity: ActivityLevel;
  goalType: GoalType;
  /** Target rate of change in lbs per week (for lose/gain). */
  ratePerWeek: number;
  units: Units;
}

export const DEFAULT_PROFILE: Profile = {
  activity: 'moderate',
  goalType: 'maintain',
  ratePerWeek: 1,
  units: 'imperial',
};

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (little/no exercise)',
  light: 'Lightly active (1–3 days/week)',
  moderate: 'Moderately active (3–5 days/week)',
  active: 'Very active (6–7 days/week)',
  very_active: 'Extra active (hard training/physical job)',
};

export const GOAL_LABELS: Record<GoalType, string> = {
  lose: 'Lose weight',
  maintain: 'Maintain weight',
  gain: 'Gain weight',
};

// --- Unit conversions ------------------------------------------------------

export const lbToKg = (lb: number) => lb * 0.45359237;
export const kgToLb = (kg: number) => kg / 0.45359237;
export const inToCm = (inches: number) => inches * 2.54;
export const cmToIn = (cm: number) => cm / 2.54;

/** Split total inches into feet + inches. */
export function inchesToFtIn(totalIn: number): { ft: number; inch: number } {
  const ft = Math.floor(totalIn / 12);
  return { ft, inch: Math.round(totalIn - ft * 12) };
}

// --- Calculations ----------------------------------------------------------

/** Mifflin-St Jeor basal metabolic rate, or null if inputs are incomplete. */
export function bmr(p: Profile): number | null {
  if (!p.age || !p.sex || !p.heightCm || !p.weightKg) return null;
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === 'male' ? base + 5 : base - 161;
}

/** Maintenance calories (TDEE), or null if incomplete. */
export function maintenanceCalories(p: Profile): number | null {
  const b = bmr(p);
  if (b === null) return null;
  return b * ACTIVITY_FACTORS[p.activity];
}

/**
 * Recommended daily calorie target for the profile's goal, or null if inputs
 * are incomplete. ~3500 kcal per pound, spread across the week. Floored at a
 * safe minimum so extreme inputs don't produce dangerous targets.
 */
export function recommendedCalories(p: Profile): number | null {
  const tdee = maintenanceCalories(p);
  if (tdee === null) return null;
  const dailyAdjust = (p.ratePerWeek || 0) * 3500 / 7;
  let target = tdee;
  if (p.goalType === 'lose') target -= dailyAdjust;
  else if (p.goalType === 'gain') target += dailyAdjust;
  const floor = p.sex === 'female' ? 1200 : 1500;
  return Math.max(floor, Math.round(target / 10) * 10);
}
