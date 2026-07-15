// ---------------------------------------------------------------------------
// Food lookup service.
//
// Two free data sources are queried directly from the browser:
//   - Open Food Facts: real packaged products with brands, barcodes and label
//     nutrition. Best for branded/scanned items. No API key required.
//   - USDA FoodData Central: generic/whole foods (e.g. "egg", "banana") plus a
//     large US branded database. Uses a key from settings or the optional
//     VITE_USDA_API_KEY build var, falling back to the shared DEMO_KEY.
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

/**
 * A scanned/looked-up product enriched with the extra Open Food Facts fields
 * used for the pros/cons analysis and "Jordan's Suggestion" comparison.
 */
export interface ScannedProduct extends FoodSearchResult {
  nutriScore?: string; // a-e
  nova?: number; // 1-4 processing level
  nutrientLevels?: Record<string, string>; // fat / saturated-fat / sugars / salt -> low|moderate|high
  categories?: string[]; // OFF category tags
  // Per-100g values, kept for analysis/scoring regardless of the logged serving.
  caloriesPer100g?: number;
  proteinPer100g?: number;
  sugars100g?: number;
  satFat100g?: number;
  fiber100g?: number;
}

/** Turn a search result into a persistable FoodItem with a fresh id. */
export function toFoodItem(result: FoodSearchResult): FoodItem {
  return {
    id: crypto.randomUUID(),
    name: result.name,
    brand: result.brand,
    source: result.source,
    sourceId: result.sourceId,
    servingSize: result.servingSize,
    servingUnit: result.servingUnit,
    calories: result.calories,
    protein: result.protein,
    carbs: result.carbs,
    fat: result.fat,
  };
}

/** Resolve the USDA API key: explicit setting > build-time var > shared demo. */
function usdaKey(apiKey?: string): string {
  return apiKey?.trim() || import.meta.env.VITE_USDA_API_KEY || 'DEMO_KEY';
}

function num(v: number | string | undefined): number | undefined {
  if (v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

// --- Open Food Facts -------------------------------------------------------

const OFF_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const OFF_PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  nutriments?: Record<string, number | string | undefined>;
  nutriscore_grade?: string;
  nova_group?: number;
  nutrient_levels?: Record<string, string>;
  categories_tags?: string[];
  serving_quantity?: number | string;
  serving_size?: string;
}

const OFF_ANALYSIS_FIELDS =
  'code,product_name,brands,nutriments,serving_quantity,serving_size,' +
  'nutriscore_grade,nova_group,nutrient_levels,categories_tags';

function round1(v: number | undefined): number | undefined {
  return v === undefined ? undefined : Math.round(v * 10) / 10;
}

/**
 * Pull calories per 100 g from an Open Food Facts nutriments object, tolerating
 * the several ways energy is recorded (kcal directly, or kJ that we convert).
 */
function offKcalPer100g(n: OffProduct['nutriments']): number | undefined {
  const kcal = num(n?.['energy-kcal_100g']);
  if (kcal !== undefined) return kcal;
  const kj = num(n?.['energy-kj_100g']);
  if (kj !== undefined) return kj / 4.184;
  // energy_100g is usually kJ, but honour an explicit kcal unit.
  const energy = num(n?.['energy_100g']);
  if (energy !== undefined) {
    return n?.['energy_unit'] === 'kcal' ? energy : energy / 4.184;
  }
  return undefined;
}

function offProductToResult(p: OffProduct, fallbackCode?: string): ScannedProduct | null {
  const name = p.product_name?.trim();
  const kcal100 = offKcalPer100g(p.nutriments);
  if (!name || kcal100 === undefined) return null;
  const n = p.nutriments;
  const prot100 = num(n?.['proteins_100g']);
  const carb100 = num(n?.['carbohydrates_100g']);
  const fat100 = num(n?.['fat_100g']);

  // If the product declares a serving size (grams), log ONE serving using its
  // per-serving nutrition (or per-100g scaled to the serving). Otherwise fall
  // back to a 100 g reference serving.
  const servingG = num(p.serving_quantity);
  const hasServing = servingG !== undefined && servingG > 0 && servingG <= 2000;
  const factor = hasServing ? servingG / 100 : 1;

  const perServing = (per100: number | undefined, servingKey: string): number | undefined => {
    if (!hasServing) return per100;
    const direct = num(n?.[servingKey]);
    if (direct !== undefined) return direct;
    return per100 !== undefined ? per100 * factor : undefined;
  };

  const calories = hasServing
    ? Math.round(num(n?.['energy-kcal_serving']) ?? kcal100 * factor)
    : Math.round(kcal100);

  return {
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    source: 'off',
    sourceId: p.code ?? fallbackCode,
    servingSize: hasServing ? Math.round(servingG!) : 100,
    servingUnit: 'g',
    calories,
    protein: round1(perServing(prot100, 'proteins_serving')),
    carbs: round1(perServing(carb100, 'carbohydrates_serving')),
    fat: round1(perServing(fat100, 'fat_serving')),
    caloriesPer100g: Math.round(kcal100),
    proteinPer100g: prot100,
    nutriScore: p.nutriscore_grade && p.nutriscore_grade.length === 1 ? p.nutriscore_grade : undefined,
    nova: typeof p.nova_group === 'number' ? p.nova_group : undefined,
    nutrientLevels: p.nutrient_levels,
    categories: p.categories_tags,
    sugars100g: num(n?.['sugars_100g']),
    satFat100g: num(n?.['saturated-fat_100g']),
    fiber100g: num(n?.['fiber_100g']),
  };
}

async function searchOpenFoodFacts(query: string, signal?: AbortSignal): Promise<FoodSearchResult[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '20',
    fields: 'code,product_name,brands,nutriments,serving_quantity,serving_size',
  });
  const res = await fetch(`${OFF_SEARCH_URL}?${params}`, { signal });
  if (!res.ok) throw new Error(`Open Food Facts error ${res.status}`);
  const data = (await res.json()) as { products?: OffProduct[] };
  const results: FoodSearchResult[] = [];
  for (const p of data.products ?? []) {
    const r = offProductToResult(p);
    if (r) results.push(r);
  }
  return results;
}

async function offByBarcode(barcode: string, signal?: AbortSignal): Promise<ScannedProduct | null> {
  const params = new URLSearchParams({ fields: OFF_ANALYSIS_FIELDS });
  const res = await fetch(`${OFF_PRODUCT_URL}/${encodeURIComponent(barcode)}.json?${params}`, {
    signal,
  });
  if (!res.ok) throw new Error(`Open Food Facts error ${res.status}`);
  const data = (await res.json()) as { status?: number; product?: OffProduct };
  if (data.status !== 1 || !data.product) return null;
  return offProductToResult(data.product, barcode);
}

/**
 * Fetch similar products in the same Open Food Facts category, for comparing a
 * scanned item against alternatives. Uses the most specific category tag.
 */
export async function fetchAlternatives(
  product: ScannedProduct,
  signal?: AbortSignal,
): Promise<ScannedProduct[]> {
  const category = product.categories?.[product.categories.length - 1];
  if (!category) return [];
  const params = new URLSearchParams({
    action: 'process',
    json: '1',
    page_size: '40',
    fields: OFF_ANALYSIS_FIELDS,
    tagtype_0: 'categories',
    tag_contains_0: 'contains',
    tag_0: category,
  });
  const res = await fetch(`${OFF_SEARCH_URL}?${params}`, { signal });
  if (!res.ok) throw new Error(`Open Food Facts error ${res.status}`);
  const data = (await res.json()) as { products?: OffProduct[] };
  const out: ScannedProduct[] = [];
  for (const p of data.products ?? []) {
    const r = offProductToResult(p);
    // Exclude the scanned product itself and near-empty entries.
    if (r && r.sourceId !== product.sourceId) out.push(r);
  }
  return out;
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
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: UsdaNutrient[];
}

function findNutrient(nutrients: UsdaNutrient[] | undefined, name: string): number | undefined {
  const match = nutrients?.find((n) => n.nutrientName?.toLowerCase().includes(name));
  return match?.value;
}

/**
 * Resolve energy in kcal. USDA foods often list energy twice — once in kcal and
 * once in kJ (~4.184× larger) — so we must pick the kcal entry by its unit, not
 * just the first "energy" match, or calories come out ~4× too high. Falls back
 * to converting a kJ-only value.
 */
function usdaEnergyKcal(nutrients: UsdaNutrient[] | undefined): number | undefined {
  const energies = (nutrients ?? []).filter(
    (n) => n.nutrientName?.toLowerCase().includes('energy') && n.value !== undefined,
  );
  const kcal = energies.find((n) => n.unitName?.toUpperCase() === 'KCAL');
  if (kcal) return kcal.value;
  const kj = energies.find((n) => n.unitName?.toUpperCase() === 'KJ');
  if (kj?.value !== undefined) return kj.value / 4.184;
  return energies[0]?.value;
}

function usdaFoodToResult(f: UsdaFood): ScannedProduct | null {
  const name = f.description?.trim();
  const kcal100 = usdaEnergyKcal(f.foodNutrients);
  if (!name || kcal100 === undefined) return null;
  const prot100 = findNutrient(f.foodNutrients, 'protein');
  const carb100 = findNutrient(f.foodNutrients, 'carbohydrate');
  const fat100 = findNutrient(f.foodNutrients, 'total lipid');

  // USDA foodNutrients are per 100 g/ml. Branded foods declare a serving size;
  // log one serving of that size rather than a flat 100 g.
  const unit = f.servingSizeUnit?.toLowerCase();
  const hasServing =
    f.servingSize !== undefined && f.servingSize > 0 && (unit === 'g' || unit === 'ml');
  const factor = hasServing ? f.servingSize! / 100 : 1;
  const scale = (v: number | undefined) =>
    v === undefined ? undefined : Math.round(v * factor * 10) / 10;

  return {
    name,
    brand: f.brandOwner?.trim() || undefined,
    source: 'usda',
    sourceId: f.fdcId !== undefined ? String(f.fdcId) : undefined,
    servingSize: hasServing ? Math.round(f.servingSize!) : 100,
    servingUnit: hasServing ? unit! : 'g',
    calories: Math.round(kcal100 * factor),
    protein: scale(prot100),
    carbs: scale(carb100),
    fat: scale(fat100),
    caloriesPer100g: Math.round(kcal100),
    proteinPer100g: prot100,
  };
}

async function usdaSearch(query: string, apiKey: string | undefined, signal?: AbortSignal): Promise<UsdaFood[]> {
  const params = new URLSearchParams({
    query,
    pageSize: '25',
    api_key: usdaKey(apiKey),
  });
  const res = await fetch(`${USDA_SEARCH_URL}?${params}`, { signal });
  if (!res.ok) throw new Error(`USDA error ${res.status}`);
  const data = (await res.json()) as { foods?: UsdaFood[] };
  return data.foods ?? [];
}

async function searchUsda(query: string, apiKey: string | undefined, signal?: AbortSignal): Promise<FoodSearchResult[]> {
  const foods = await usdaSearch(query, apiKey, signal);
  const results: FoodSearchResult[] = [];
  for (const f of foods) {
    const r = usdaFoodToResult(f);
    if (r) results.push(r);
  }
  return results;
}

/** Find a USDA branded food by its barcode/GTIN (US products often live here). */
async function usdaByUpc(barcode: string, apiKey: string | undefined, signal?: AbortSignal): Promise<FoodSearchResult | null> {
  const foods = await usdaSearch(barcode, apiKey, signal);
  const normalized = barcode.replace(/^0+/, '');
  const exact = foods.find((f) => f.gtinUpc && f.gtinUpc.replace(/^0+/, '') === normalized);
  return usdaFoodToResult(exact ?? foods[0]) ?? null;
}

// --- Barcode lookup (combines both sources) --------------------------------

export interface BarcodeOptions {
  usdaApiKey?: string;
  signal?: AbortSignal;
}

/**
 * Look up a scanned barcode. Tries Open Food Facts (including a UPC-A → EAN-13
 * zero-pad retry), then falls back to the USDA branded database. Returns null
 * only when neither source has the product.
 */
export async function fetchProductByBarcode(
  barcode: string,
  { usdaApiKey, signal }: BarcodeOptions = {},
): Promise<ScannedProduct | null> {
  const code = barcode.trim();

  // 1. Open Food Facts by exact code.
  try {
    const off = await offByBarcode(code, signal);
    if (off) return off;
    // 12-digit UPC-A is stored in OFF as a zero-padded 13-digit EAN-13.
    if (code.length === 12) {
      const padded = await offByBarcode(`0${code}`, signal);
      if (padded) return padded;
    }
  } catch (err) {
    console.warn('Open Food Facts barcode lookup failed:', err);
  }

  // 2. USDA branded database by GTIN/UPC.
  try {
    return await usdaByUpc(code, usdaApiKey, signal);
  } catch (err) {
    console.warn('USDA barcode lookup failed:', err);
    return null;
  }
}

// --- Built-in generic foods ------------------------------------------------
// A small local database of common whole/generic foods so staples always turn
// up instantly and correctly, even when the USDA API is slow or rate-limited.
// Values are per the stated serving (grams); portion hints live in the name.

interface Generic { name: string; g: number; cal: number; p: number; c: number; f: number; }

const GENERIC_FOODS: Generic[] = [
  { name: 'Canadian bacon (2 slices)', g: 57, cal: 90, p: 12, c: 1, f: 4 },
  { name: 'Bacon (2 slices, cooked)', g: 16, cal: 90, p: 6, c: 0, f: 7 },
  { name: 'Ham, deli sliced (2 slices)', g: 56, cal: 60, p: 10, c: 2, f: 1.5 },
  { name: 'Pork sausage (2 links)', g: 68, cal: 210, p: 12, c: 1, f: 18 },
  { name: 'Egg (1 large)', g: 50, cal: 72, p: 6, c: 0.4, f: 5 },
  { name: 'Egg white (1 large)', g: 33, cal: 17, p: 3.6, c: 0.2, f: 0 },
  { name: 'Grilled chicken breast (4 oz)', g: 113, cal: 185, p: 35, c: 0, f: 4 },
  { name: 'Chicken thigh, boneless skinless (3 oz, cooked)', g: 85, cal: 145, p: 19, c: 0, f: 7 },
  { name: 'Turkey breast, deli (2 oz)', g: 56, cal: 50, p: 11, c: 1, f: 0.5 },
  { name: 'Ground beef, 90/10 (3 oz, cooked)', g: 85, cal: 184, p: 22, c: 0, f: 10 },
  { name: 'Salmon (3 oz, cooked)', g: 85, cal: 175, p: 19, c: 0, f: 10 },
  { name: 'Tuna, canned in water (1 can)', g: 142, cal: 100, p: 22, c: 0, f: 1 },
  { name: 'Shrimp (3 oz, cooked)', g: 85, cal: 84, p: 20, c: 0, f: 1 },
  { name: 'White rice (1 cup, cooked)', g: 158, cal: 205, p: 4, c: 45, f: 0.4 },
  { name: 'Brown rice (1 cup, cooked)', g: 195, cal: 216, p: 5, c: 45, f: 1.8 },
  { name: 'Oatmeal (1 cup, cooked)', g: 234, cal: 158, p: 6, c: 27, f: 3 },
  { name: 'Whole wheat bread (1 slice)', g: 43, cal: 110, p: 5, c: 20, f: 1.5 },
  { name: 'White bread (1 slice)', g: 25, cal: 66, p: 2, c: 13, f: 0.8 },
  { name: 'English muffin (1)', g: 57, cal: 134, p: 4, c: 26, f: 1 },
  { name: 'Bagel (1 medium)', g: 98, cal: 257, p: 10, c: 50, f: 1.5 },
  { name: 'Cheddar cheese (1 oz)', g: 28, cal: 115, p: 7, c: 0.4, f: 9 },
  { name: 'American cheese (1 slice)', g: 19, cal: 60, p: 3, c: 2, f: 4.5 },
  { name: 'Milk, 2% (1 cup)', g: 244, cal: 122, p: 8, c: 12, f: 5 },
  { name: 'Nonfat Greek yogurt (3/4 cup)', g: 170, cal: 100, p: 17, c: 6, f: 0 },
  { name: 'Banana (1 medium)', g: 118, cal: 105, p: 1.3, c: 27, f: 0.4 },
  { name: 'Apple (1 medium)', g: 182, cal: 95, p: 0.5, c: 25, f: 0.3 },
  { name: 'Avocado (1/2)', g: 68, cal: 114, p: 1.3, c: 6, f: 10.5 },
  { name: 'Peanut butter (2 tbsp)', g: 32, cal: 190, p: 7, c: 7, f: 16 },
  { name: 'Almonds (1 oz)', g: 28, cal: 164, p: 6, c: 6, f: 14 },
  { name: 'Broccoli (1 cup, cooked)', g: 156, cal: 55, p: 4, c: 11, f: 0.6 },
  { name: 'Sweet potato (1 medium, baked)', g: 114, cal: 103, p: 2, c: 24, f: 0.2 },
  { name: 'Baked potato (1 medium)', g: 173, cal: 161, p: 4, c: 37, f: 0.2 },
  { name: 'Butter (1 tbsp)', g: 14, cal: 102, p: 0, c: 0, f: 11.5 },
];

function genericToResult(g: Generic): FoodSearchResult {
  return {
    name: g.name,
    source: 'usda',
    servingSize: g.g,
    servingUnit: 'g',
    calories: g.cal,
    protein: g.p,
    carbs: g.c,
    fat: g.f,
  };
}

/** Local matches for a query — every whitespace-separated term must appear. */
function searchGenericFoods(query: string): FoodSearchResult[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return GENERIC_FOODS.filter((g) => {
    const name = g.name.toLowerCase();
    return terms.every((t) => name.includes(t));
  }).map(genericToResult);
}

// --- Combined text search --------------------------------------------------

export interface SearchOptions {
  usdaApiKey?: string;
  signal?: AbortSignal;
}

/** Rank generic whole-foods first, then branded packaged products. */
function rankOf(r: FoodSearchResult): number {
  if (r.source === 'usda' && !r.brand) return 0; // generic USDA (egg, banana…)
  if (r.source === 'off') return 1; // branded, with label data
  return 2; // USDA branded
}

/**
 * Search both sources in parallel and merge, floating generic whole-foods to
 * the top so typing "egg" surfaces "Egg, whole, raw" (with macros) first. If
 * one source fails (network, rate limit) the other's results are still shown.
 */
export async function searchFoods(
  query: string,
  { usdaApiKey, signal }: SearchOptions = {},
): Promise<FoodSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const [off, usda] = await Promise.allSettled([
    searchOpenFoodFacts(trimmed, signal),
    searchUsda(trimmed, usdaApiKey, signal),
  ]);

  // Built-in staples first so common foods always appear, even if an API is
  // slow, down, or rate-limited.
  const results: FoodSearchResult[] = [...searchGenericFoods(trimmed)];
  if (off.status === 'fulfilled') results.push(...off.value);
  else console.warn('Open Food Facts search failed:', off.reason);
  if (usda.status === 'fulfilled') results.push(...usda.value);
  else console.warn('USDA search failed:', usda.reason);

  // Stable sort keeps each source's relevance order within a rank tier.
  return results.map((r, i) => ({ r, i })).sort((a, b) => rankOf(a.r) - rankOf(b.r) || a.i - b.i).map((x) => x.r);
}
