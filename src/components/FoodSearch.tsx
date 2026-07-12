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
  /** Recently-logged foods offered as one-tap quick-adds when the box is empty. */
  recent: FoodItem[];
  favorites: FoodItem[];
  recipes: Recipe[];
  onAdd: (food: FoodItem, quantity: number) => void;
  onToggleFavorite: (food: FoodItem) => void;
}

const SOURCE_LABELS: Record<FoodSearchResult['source'], string> = {
  off: 'Open Food Facts',
  usda: 'USDA',
  manual: 'Manual',
  recipe: 'Recipe',
};

/**
 * Type a food name, search the databases, pick a result. The chosen food's
 * calories are computed automatically from its label data; the user only sets
 * how many servings they ate. Also offers favorites/recipes/recent quick-adds
 * and, for scanned products, a pros/cons analysis with Jordan's Suggestion.
 */
export function FoodSearch(props: FoodSearchProps) {
  const { meal, usdaApiKey, jordanPriority, recent, favorites, recipes, onAdd, onToggleFavorite } = props;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [scanned, setScanned] = useState<ScannedProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
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
        const found = await searchFoods(trimmed, { usdaApiKey, signal: controller.signal });
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

  const showQuickAdds =
    query.trim().length < 2 && results.length === 0 && !scanned &&
    (favorites.length > 0 || recipes.length > 0 || recent.length > 0);

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
        setError(`No product found for barcode ${barcode}. Try searching or add it manually.`);
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
      {loading && <div className="search-status">Searching…</div>}
      {error && <div className="search-status error">{error}</div>}

      {showQuickAdds && (
        <div className="quick-adds">
          {favorites.length > 0 && (
            <ChipRow label="★ Favorites" foods={favorites} onPick={handleQuickAdd} />
          )}
          {recipes.length > 0 && (
            <div className="chip-section">
              <span className="chip-label">Recipes</span>
              <div className="chip-row">
                {recipes.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="quick-chip recipe-chip"
                    onClick={() => onAdd(recipeServingFood(r), 1)}
                    title={`Add 1 serving of ${r.name}`}
                  >
                    {r.name}
                    <span className="chip-cals">{recipeServingFood(r).calories}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {recent.length > 0 && (
            <ChipRow label="Recent" foods={recent} onPick={handleQuickAdd} />
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
                    {r.calories} kcal / {r.servingSize}{r.servingUnit}
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
            title={`Add ${food.name} (${food.calories} kcal)`}
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
  }

  return (
    <form className="manual-form" onSubmit={submit}>
      <input placeholder="Food name" value={name} onChange={(e) => setName(e.target.value)} />
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
