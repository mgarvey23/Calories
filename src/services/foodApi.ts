// ---------------------------------------------------------------------------
// Food lookup service.
//
// Two free data sources are queried directly from the browser:
//   - Open Food Facts: real packaged products with brands, barcodes and label
//     nutrition. Best for branded/scanned items. No API key required.
//   - USDA FoodData Central: generic/whole foods (e.g. "banana"). Requires an
//     API key; falls back to the shared, rate-limited DEMO_KEY.
//
// Both are normalized into a common FoodSearchResult shape so the UI does not
// care where a result came from.
// ---------------------------------------------------------------------------

import type { FoodItem, FoodSource } from '../types';

/** A candidate returned by a search, not yet logged. */
export interface FoodSearchResult {
  name: string;
  brand?: string;
  source: FoodSource;
  sourceId?: string;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

/** Turn a search result into a persistable FoodItem with a fresh id. */
export function toFoodItem(result: FoodSearchResult): FoodItem {
  return { id: crypto.randomUUID(), ...result };
}

// --- Open Food Facts -------------------------------------------------------

const OFF_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  nutriments?: Record<string, number | string | undefined>;
}

function num(v: number | string | undefined): number | undefined {
  if (v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

async function searchOpenFoodFacts(query: string, signal?: AbortSignal): Promise<FoodSearchResult[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '20',
    fields: 'code,product_name,brands,nutriments',
  });
  const res = await fetch(`${OFF_SEARCH_URL}?${params}`, { signal });
  if (!res.ok) throw new Error(`Open Food Facts error ${res.status}`);
  const data = (await res.json()) as { products?: OffProduct[] };
  const products = data.products ?? [];

  const results: FoodSearchResult[] = [];
  for (const p of products) {
    const name = p.product_name?.trim();
    const kcal = num(p.nutriments?.['energy-kcal_100g']);
    // Skip products with no name or no usable calorie value.
    if (!name || kcal === undefined) continue;
    results.push({
      name,
      brand: p.brands?.split(',')[0]?.trim() || undefined,
      source: 'off',
      sourceId: p.code,
      servingSize: 100,
      servingUnit: 'g',
      calories: Math.round(kcal),
      protein: num(p.nutriments?.['proteins_100g']),
      carbs: num(p.nutriments?.['carbohydrates_100g']),
      fat: num(p.nutriments?.['fat_100g']),
    });
  }
  return results;
}

// --- USDA FoodData Central -------------------------------------------------

const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

interface UsdaNutrient {
  nutrientName?: string;
  unitName?: string;
  value?: number;
}

interface UsdaFood {
  fdcId?: number;
  description?: string;
  brandOwner?: string;
  foodNutrients?: UsdaNutrient[];
}

function findNutrient(nutrients: UsdaNutrient[] | undefined, name: string): number | undefined {
  const match = nutrients?.find((n) => n.nutrientName?.toLowerCase().includes(name));
  return match?.value;
}

async function searchUsda(
  query: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<FoodSearchResult[]> {
  const params = new URLSearchParams({
    query,
    pageSize: '20',
    api_key: apiKey || 'DEMO_KEY',
  });
  const res = await fetch(`${USDA_SEARCH_URL}?${params}`, { signal });
  if (!res.ok) throw new Error(`USDA error ${res.status}`);
  const data = (await res.json()) as { foods?: UsdaFood[] };
  const foods = data.foods ?? [];

  const results: FoodSearchResult[] = [];
  for (const f of foods) {
    const name = f.description?.trim();
    const kcal = findNutrient(f.foodNutrients, 'energy');
    if (!name || kcal === undefined) continue;
    // USDA nutrients are reported per 100 g.
    results.push({
      name,
      brand: f.brandOwner?.trim() || undefined,
      source: 'usda',
      sourceId: f.fdcId !== undefined ? String(f.fdcId) : undefined,
      servingSize: 100,
      servingUnit: 'g',
      calories: Math.round(kcal),
      protein: findNutrient(f.foodNutrients, 'protein'),
      carbs: findNutrient(f.foodNutrients, 'carbohydrate'),
      fat: findNutrient(f.foodNutrients, 'total lipid'),
    });
  }
  return results;
}

// --- Combined search -------------------------------------------------------

export interface SearchOptions {
  usdaApiKey?: string;
  signal?: AbortSignal;
}

/**
 * Search both sources in parallel and merge. If one source fails (network,
 * rate limit) the other's results are still returned rather than failing the
 * whole search.
 */
export async function searchFoods(
  query: string,
  { usdaApiKey = '', signal }: SearchOptions = {},
): Promise<FoodSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const [off, usda] = await Promise.allSettled([
    searchOpenFoodFacts(trimmed, signal),
    searchUsda(trimmed, usdaApiKey, signal),
  ]);

  const results: FoodSearchResult[] = [];
  if (off.status === 'fulfilled') results.push(...off.value);
  else console.warn('Open Food Facts search failed:', off.reason);
  if (usda.status === 'fulfilled') results.push(...usda.value);
  else console.warn('USDA search failed:', usda.reason);

  return results;
}
