import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { FoodItem, JordanPriority, MealType, Recipe } from '../types';
import { MEAL_LABELS, isFavorite, recipeServingFood } from '../types';
import {
  fetchProductByBarcode,
  searchFoods,
  toFoodItem,
  type FoodSearchResult,
  type ScannedProduct,
} from '../services/foodApi';
import { getSharedFoodByBarcode, searchSharedFoods } from '../services/sharedFoods';
import { ProductAnalysis } from './ProductAnalysis';

// The barcode scanner pulls in a heavy decoding library; load it on demand so
// it stays out of the initial bundle until the user taps "scan".
const BarcodeScanner = lazy(() =>
  import('./BarcodeScanner').then((m) => ({ default: m.BarcodeScanner })),
);

interface FoodSearchProps {
  meal: MealType;
  usdaApiKey: string;
  jordanPriority: JordanPriority;
  /** Foods the user pinned to this meal, offered as one-tap quick-adds. */
  pinned: FoodItem[];
  favorites: FoodItem[];
  recipes: Recipe[];
  onAdd: (food: FoodItem, quantity: number) => void;
  onToggleFavorite: (food: FoodItem) => void;
  /** Contribute a manually-entered food to the shared database (cloud only). */
  onContributeFood?: (food: FoodItem) => void;
}

const SOURCE_LABELS: Record<FoodSearchResult['source'], string> = {
  off: 'Open Food Facts',
  usda: 'USDA',
  manual: 'Manual',
  recipe: 'Recipe',
  community: 'Community',
};

/**
 * Type a food name, search the databases, pick a result. The chosen food's
 * calories are computed automatically from its label data; the user only sets
 * how many servings they ate. Also offers favorites/recipes/recent quick-adds
 * and, for scanned products, a pros/cons analysis with Jordan's Suggestion.
 */
export function FoodSearch(props: FoodSearchProps) {
  const { meal, usdaApiKey, jordanPriority, pinned, favorites, recipes, onAdd, onToggleFavorite, onContributeFood } = props;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [scanned, setScanned] = useState<ScannedProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [recipesOpen, setRecipesOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced search as the user types.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    setScanned(null);
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const [apiFound, shared] = await Promise.all([
          searchFoods(trimmed, { usdaApiKey, signal: controller.signal }),
          searchSharedFoods(trimmed, controller.signal),
        ]);
        // Community contributions first, then database results.
        const found = [...shared, ...apiFound];
        setResults(found);
        if (found.length === 0) setError('No matches found. Try a different name or add it manually.');
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setError('Search failed. Check your connection.');
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [query, usdaApiKey]);

  function clearSearch() {
    setQuery('');
    setResults([]);
    setScanned(null);
  }

  function handlePick(result: FoodSearchResult) {
    onAdd(toFoodItem(result), 1);
    clearSearch();
  }

  // Re-log a saved food. Clone with a fresh id so entries stay independent.
  function handleQuickAdd(food: FoodItem) {
    onAdd({ ...food, id: crypto.randomUUID() }, 1);
  }

  // Favorites and recipes live behind their own buttons (they get long); only
  // the small per-meal pinned list shows inline.
  const showQuickAdds =
    query.trim().length < 2 && results.length === 0 && !scanned && pinned.length > 0;

  async function handleBarcode(barcode: string) {
    setScannerOpen(false);
    setLoading(true);
    setError(null);
    setResults([]);
    setScanned(null);
    try {
      const product = await fetchProductByBarcode(barcode, { usdaApiKey });
      if (product) {
        setResults([product]);
        setScanned(product);
      } else {
        // Not in the food databases — check the community database (remembered
        // manual entries) before giving up.
        const shared = await getSharedFoodByBarcode(barcode);
        if (shared) {
          setResults([shared]);
        } else {
          setError(
            `No product found for barcode ${barcode}. Add it manually — you can attach this barcode so it's remembered.`,
          );
        }
      }
    } catch {
      setError('Barcode lookup failed. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="food-search">
      <div className="search-input-row">
        <input
          type="text"
          placeholder={`Add food to ${MEAL_LABELS[meal].toLowerCase()}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {favorites.length > 0 && (
          <button
            type="button"
            className={`scan-button ${favoritesOpen ? 'active' : ''}`}
            onClick={() => { setFavoritesOpen((o) => !o); setRecipesOpen(false); }}
            title="Your favorites"
            aria-label="Favorites"
          >
            ★
          </button>
        )}
        {recipes.length > 0 && (
          <button
            type="button"
            className={`scan-button ${recipesOpen ? 'active' : ''}`}
            onClick={() => { setRecipesOpen((o) => !o); setFavoritesOpen(false); }}
            title="Add one of your recipes"
            aria-label="Add a recipe"
          >
            📖
          </button>
        )}
        <button
          type="button"
          className="scan-button"
          onClick={() => setScannerOpen(true)}
          title="Scan a barcode"
          aria-label="Scan a barcode"
        >
          📷
        </button>
      </div>

      {favoritesOpen && favorites.length > 0 && (
        <div className="recipe-picker">
          <span className="chip-label">★ Favorites</span>
          <ul className="recipe-picker-list">
            {favorites.map((food) => (
              <li key={food.id} className="fav-picker-row">
                <button
                  type="button"
                  className="recipe-picker-row"
                  onClick={() => { handleQuickAdd(food); setFavoritesOpen(false); }}
                >
                  <span>{food.name}{food.brand ? ` · ${food.brand}` : ''}</span>
                  <span className="recipe-picker-cals">{food.calories} cal</span>
                </button>
                <button
                  type="button"
                  className="star-button active"
                  onClick={() => onToggleFavorite(food)}
                  title="Remove from favorites"
                  aria-label="Remove from favorites"
                >
                  ★
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recipesOpen && recipes.length > 0 && (
        <div className="recipe-picker">
          <span className="chip-label">Add a recipe</span>
          <ul className="recipe-picker-list">
            {recipes.map((r) => {
              const serving = recipeServingFood(r);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    className="recipe-picker-row"
                    onClick={() => { onAdd(serving, 1); setRecipesOpen(false); }}
                  >
                    <span>{r.name}</span>
                    <span className="recipe-picker-cals">{serving.calories} cal</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {loading && <div className="search-status">Searching…</div>}
      {error && <div className="search-status error">{error}</div>}

      {showQuickAdds && (
        <div className="quick-adds">
          {pinned.length > 0 && (
            <ChipRow label="📌 Pinned" foods={pinned} onPick={handleQuickAdd} />
          )}
        </div>
      )}

      {results.length > 0 && (
        <ul className="search-results">
          {results.map((r, i) => {
            const fav = isFavorite(favorites, toFoodItem(r));
            return (
              <li key={`${r.source}-${r.sourceId ?? i}`} className="result-row">
                <button className="result" onClick={() => handlePick(r)}>
                  <span className="result-name">
                    {r.name}
                    {r.brand && <span className="result-brand"> · {r.brand}</span>}
                  </span>
                  <span className="result-meta">
                    {r.calories} cal / {r.servingSize}{r.servingUnit}
                    {(r.protein !== undefined || r.carbs !== undefined || r.fat !== undefined) && (
                      <span className="result-macros">
                        P {Math.round(r.protein ?? 0)} · C {Math.round(r.carbs ?? 0)} · F {Math.round(r.fat ?? 0)}
                      </span>
                    )}
                    <span className="result-source">{SOURCE_LABELS[r.source]}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className={`star-button ${fav ? 'active' : ''}`}
                  onClick={() => onToggleFavorite(toFoodItem(r))}
                  title={fav ? 'Remove from favorites' : 'Save to favorites'}
                  aria-label="Toggle favorite"
                >
                  {fav ? '★' : '☆'}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {scanned && (
        <ProductAnalysis
          product={scanned}
          priority={jordanPriority}
          onAddAlternative={(food) => {
            onAdd(food, 1);
            clearSearch();
          }}
        />
      )}

      <button className="link-button" onClick={() => setManualOpen((o) => !o)}>
        {manualOpen ? 'Cancel manual entry' : "Can't find it? Add manually"}
      </button>
      {manualOpen && (
        <ManualEntryForm
          onAdd={(food) => {
            onAdd(food, 1);
            onContributeFood?.(food);
            setManualOpen(false);
            setQuery('');
          }}
        />
      )}

      {scannerOpen && (
        <Suspense fallback={<div className="search-status">Loading scanner…</div>}>
          <BarcodeScanner
            onDetected={handleBarcode}
            onClose={() => setScannerOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

/** A labelled row of one-tap food chips (favorites / recent). */
function ChipRow({
  label,
  foods,
  onPick,
}: {
  label: string;
  foods: FoodItem[];
  onPick: (food: FoodItem) => void;
}) {
  return (
    <div className="chip-section">
      <span className="chip-label">{label}</span>
      <div className="chip-row">
        {foods.map((food) => (
          <button
            key={food.id}
            type="button"
            className="quick-chip"
            onClick={() => onPick(food)}
            title={`Add ${food.name} (${food.calories} cal)`}
          >
            {food.name}
            <span className="chip-cals">{food.calories}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ManualEntryForm({ onAdd }: { onAdd: (food: FoodItem) => void }) {
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [servingSize, setServingSize] = useState('1');
  const [servingUnit, setServingUnit] = useState('serving');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [barcode, setBarcode] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  // Read a photo of the Nutrition Facts panel and pre-fill whatever fields we
  // can recognise. Runs entirely in the browser (Tesseract, lazy-loaded).
  async function handleLabelPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setOcrStatus('Reading label…');
    try {
      const { recognizeLabel, parseNutritionLabel } = await import('../services/labelOcr');
      const text = await recognizeLabel(file, (p) =>
        setOcrStatus(`Reading label… ${Math.round(p * 100)}%`),
      );
      const parsed = parseNutritionLabel(text);
      const filled: string[] = [];
      if (parsed.calories !== undefined) { setCalories(String(parsed.calories)); filled.push('calories'); }
      if (parsed.protein !== undefined) { setProtein(String(parsed.protein)); filled.push('protein'); }
      if (parsed.carbs !== undefined) { setCarbs(String(parsed.carbs)); filled.push('carbs'); }
      if (parsed.fat !== undefined) { setFat(String(parsed.fat)); filled.push('fat'); }
      if (parsed.servingSize !== undefined) {
        setServingSize(String(parsed.servingSize));
        filled.push('serving size');
      }
      if (parsed.servingUnit) setServingUnit(parsed.servingUnit);
      setOcrStatus(
        filled.length > 0
          ? `Filled ${filled.join(', ')} — double-check, then add.`
          : "Couldn't read the label. Try a clearer, straight-on photo or enter it by hand.",
      );
    } catch {
      setOcrStatus('Label scan failed. Enter the values by hand.');
    }
  }

  // Parse an optional numeric macro field; blank stays undefined.
  const optionalNum = (v: string): number | undefined => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cals = parseFloat(calories);
    if (!name.trim() || !Number.isFinite(cals)) return;
    onAdd(toFoodItem({
      name: name.trim(),
      source: 'manual',
      sourceId: barcode.trim() || undefined,
      servingSize: parseFloat(servingSize) || 1,
      servingUnit: servingUnit.trim() || 'serving',
      calories: Math.round(cals),
      protein: optionalNum(protein),
      carbs: optionalNum(carbs),
      fat: optionalNum(fat),
    }));
    setName('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setBarcode('');
  }

  return (
    <form className="manual-form" onSubmit={submit}>
      <input placeholder="Food name" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="manual-barcode">
        <button type="button" className="scan-button" onClick={() => setScannerOpen(true)}>
          📷 {barcode ? 'Rescan' : 'Scan UPC'}
        </button>
        <button
          type="button"
          className="scan-button"
          onClick={() => labelInputRef.current?.click()}
          title="Take a photo of the Nutrition Facts label to auto-fill"
        >
          🏷️ Scan label
        </button>
        {barcode && <span className="barcode-tag">UPC {barcode} — will be remembered</span>}
      </div>
      <input
        ref={labelInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleLabelPhoto}
      />
      {ocrStatus && <div className="search-status">{ocrStatus}</div>}
      {scannerOpen && (
        <Suspense fallback={<div className="search-status">Loading scanner…</div>}>
          <BarcodeScanner
            onDetected={(code) => { setBarcode(code); setScannerOpen(false); }}
            onClose={() => setScannerOpen(false)}
          />
        </Suspense>
      )}
      <div className="manual-row">
        <input
          type="number" placeholder="Calories" value={calories}
          onChange={(e) => setCalories(e.target.value)} min="0"
        />
        <input
          type="number" placeholder="Serving size" value={servingSize}
          onChange={(e) => setServingSize(e.target.value)} min="0" step="any"
        />
        <input
          placeholder="Unit" value={servingUnit}
          onChange={(e) => setServingUnit(e.target.value)}
        />
      </div>
      <div className="manual-row">
        <input
          type="number" placeholder="Protein (g)" value={protein}
          onChange={(e) => setProtein(e.target.value)} min="0" step="any"
        />
        <input
          type="number" placeholder="Carbs (g)" value={carbs}
          onChange={(e) => setCarbs(e.target.value)} min="0" step="any"
        />
        <input
          type="number" placeholder="Fat (g)" value={fat}
          onChange={(e) => setFat(e.target.value)} min="0" step="any"
        />
      </div>
      <small>Macros are optional.</small>
      <button type="submit">Add food</button>
    </form>
  );
}
