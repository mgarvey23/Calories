// ---------------------------------------------------------------------------
// Product analysis for scanned items: pros/cons, a "goodness" score by the
// user's chosen priority, and "Jordan's Suggestion" — the best alternative in
// the same category with a short reason why.
// ---------------------------------------------------------------------------

import type { JordanPriority } from '../types';
import type { ScannedProduct } from './foodApi';

export interface ProsCons {
  pros: string[];
  cons: string[];
}

const NUTRISCORE_VALUE: Record<string, number> = { a: 5, b: 4, c: 3, d: 2, e: 1 };

/** Short human-readable pros and cons derived from label/nutrition signals. */
export function generateProsCons(p: ScannedProduct): ProsCons {
  const pros: string[] = [];
  const cons: string[] = [];
  const levels = p.nutrientLevels ?? {};

  const protein = p.protein ?? 0;
  if (protein >= 10) pros.push(`Good source of protein (${Math.round(protein)}g per 100g)`);
  if ((p.fiber100g ?? 0) >= 5) pros.push('High in fiber');
  if (levels.sugars === 'low') pros.push('Low in sugar');
  if (levels['saturated-fat'] === 'low') pros.push('Low in saturated fat');
  if (levels.salt === 'low') pros.push('Low in salt');
  if (p.nutriScore && NUTRISCORE_VALUE[p.nutriScore] >= 4) {
    pros.push(`Nutri-Score ${p.nutriScore.toUpperCase()}`);
  }
  if (p.nova === 1 || p.nova === 2) pros.push('Minimally processed');

  if (levels.sugars === 'high' || (p.sugars100g ?? 0) >= 22.5) cons.push('High in sugar');
  if (levels['saturated-fat'] === 'high') cons.push('High in saturated fat');
  if (levels.salt === 'high') cons.push('High in salt');
  if (p.nutriScore && NUTRISCORE_VALUE[p.nutriScore] <= 2) {
    cons.push(`Nutri-Score ${p.nutriScore.toUpperCase()}`);
  }
  if (p.nova === 4) cons.push('Ultra-processed');
  if (p.calories >= 400) cons.push(`Calorie-dense (${p.calories} kcal per 100g)`);

  if (pros.length === 0) pros.push('Fits your day if the portion is right');
  if (cons.length === 0) cons.push('No major nutritional red flags');
  return { pros, cons };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** A 0-100 "goodness" score for a product under the given priority. Higher = better. */
export function scoreProduct(p: ScannedProduct, priority: JordanPriority): number {
  const cal = p.calories || 0; // per 100g
  const protein = p.protein ?? 0;
  const sugar = p.sugars100g ?? (p.nutrientLevels?.sugars === 'high' ? 30 : p.nutrientLevels?.sugars === 'moderate' ? 12 : 2);
  const nutri = p.nutriScore ? NUTRISCORE_VALUE[p.nutriScore] ?? 3 : 3; // 1-5
  const nova = p.nova ?? 2; // 1-4

  const calScore = clamp(100 - cal / 6, 0, 100); // 600 kcal/100g -> 0
  const proteinScore = clamp((protein / Math.max(cal, 1)) * 1500, 0, 100); // protein per calorie
  const sugarScore = clamp(100 - sugar * 3, 0, 100);
  const cleanScore = clamp(nutri * 12 + (4 - nova) * 10, 0, 100);

  switch (priority) {
    case 'calories':
      return calScore;
    case 'protein':
      return proteinScore;
    case 'clean':
      return cleanScore;
    case 'balanced':
    default:
      return calScore * 0.3 + proteinScore * 0.3 + sugarScore * 0.2 + cleanScore * 0.2;
  }
}

export interface Suggestion {
  /** The recommended product, or null if the scanned item is already best. */
  best: ScannedProduct | null;
  /** True when the scanned product is already the top pick. */
  alreadyBest: boolean;
  /** Short reasons the suggestion (or the scanned item) wins. */
  reasons: string[];
}

/** Explain why `winner` beats `baseline` under the priority. */
function reasonsFor(winner: ScannedProduct, baseline: ScannedProduct, priority: JordanPriority): string[] {
  const reasons: string[] = [];
  const calDiff = baseline.calories - winner.calories;
  const protDiff = (winner.protein ?? 0) - (baseline.protein ?? 0);

  if (priority === 'calories' || priority === 'balanced') {
    if (calDiff >= 15) reasons.push(`${Math.round(calDiff)} fewer calories per 100g`);
  }
  if (priority === 'protein' || priority === 'balanced') {
    if (protDiff >= 2) reasons.push(`${Math.round(protDiff)}g more protein per 100g`);
  }
  if (priority === 'clean' || priority === 'balanced') {
    if (winner.nutriScore && baseline.nutriScore &&
        (NUTRISCORE_VALUE[winner.nutriScore] ?? 0) > (NUTRISCORE_VALUE[baseline.nutriScore] ?? 0)) {
      reasons.push(`Better Nutri-Score (${winner.nutriScore.toUpperCase()} vs ${baseline.nutriScore.toUpperCase()})`);
    }
    if ((winner.nova ?? 4) < (baseline.nova ?? 4)) reasons.push('Less processed');
  }
  if ((winner.sugars100g ?? 99) < (baseline.sugars100g ?? 99) - 3) {
    reasons.push('Less sugar');
  }
  if (reasons.length === 0) reasons.push('A better overall match for your goal');
  return reasons;
}

/**
 * Pick "Jordan's Suggestion" — the highest-scoring alternative that beats the
 * scanned product by a meaningful margin, else declare the scanned item best.
 */
export function pickSuggestion(
  scanned: ScannedProduct,
  alternatives: ScannedProduct[],
  priority: JordanPriority,
): Suggestion {
  const scannedScore = scoreProduct(scanned, priority);

  let best: ScannedProduct | null = null;
  let bestScore = scannedScore;
  for (const alt of alternatives) {
    const s = scoreProduct(alt, priority);
    if (s > bestScore) {
      best = alt;
      bestScore = s;
    }
  }

  // Require a real improvement, not a rounding-level edge.
  if (!best || bestScore - scannedScore < 5) {
    return { best: null, alreadyBest: true, reasons: [] };
  }
  return { best, alreadyBest: false, reasons: reasonsFor(best, scanned, priority) };
}
