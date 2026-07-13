import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { MealEntry, Recipe } from '../types';
import { entryCalories, recipeServingFood, recipeTotals } from '../types';
import {
  fetchProductByBarcode,
  searchFoods,
  toFoodItem,
  type FoodSearchResult,
} from '../services/foodApi';

const BarcodeScanner = lazy(() =>
  import('./BarcodeScanner').then((m) => ({ default: m.BarcodeScanner })),
);

interface RecipesPanelProps {
  recipes: Recipe[];
  usdaApiKey: string;
  onSave: (recipe: Recipe) => void;
  onDelete: (recipeId: string) => void;
  onClose: () => void;
}

/** Modal to create, view and delete recipes. */
export function RecipesPanel({ recipes, usdaApiKey, onSave, onDelete, onClose }: RecipesPanelProps) {
  const [editing, setEditing] = useState<Recipe | null>(null);

  function startNew() {
    setEditing({ id: crypto.randomUUID(), name: '', ingredients: [], servings: 1 });
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel recipes-panel" onClick={(e) => e.stopPropagation()}>
        <header className="settings-header">
          <h2>Recipes</h2>
          <button className="remove-button" onClick={onClose} aria-label="Close">×</button>
        </header>

        {editing ? (
          <RecipeEditor
            recipe={editing}
            usdaApiKey={usdaApiKey}
            onCancel={() => setEditing(null)}
            onSave={(r) => {
              onSave(r);
              setEditing(null);
            }}
          />
        ) : (
          <>
            <button className="primary-button" onClick={startNew}>+ New recipe</button>
            {recipes.length === 0 ? (
              <p className="setup-hint">No recipes yet. Create one to log a whole meal in one tap.</p>
            ) : (
              <ul className="recipe-list">
                {recipes.map((r) => {
                  const perServing = recipeServingFood(r);
                  return (
                    <li key={r.id} className="recipe-item">
                      <div>
                        <span className="recipe-name">{r.name}</span>
                        <span className="recipe-meta">
                          {perServing.calories} kcal/serving · {r.servings} serving{r.servings === 1 ? '' : 's'} · {r.ingredients.length} ingredients
                        </span>
                      </div>
                      <div className="recipe-item-actions">
                        <button onClick={() => setEditing(r)}>Edit</button>
                        <button className="remove-button" onClick={() => onDelete(r.id)} aria-label="Delete">×</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RecipeEditor({
  recipe,
  usdaApiKey,
  onSave,
  onCancel,
}: {
  recipe: Recipe;
  usdaApiKey: string;
  onSave: (r: Recipe) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(recipe.name);
  const [servings, setServings] = useState(String(recipe.servings));
  const [ingredients, setIngredients] = useState<MealEntry[]>(recipe.ingredients);

  const totals = recipeTotals({ ...recipe, name, ingredients, servings: parseFloat(servings) || 1 });
  const perServingCals = Math.round(totals.calories / (parseFloat(servings) || 1));

  function addIngredient(result: FoodSearchResult) {
    setIngredients((prev) => [...prev, { id: crypto.randomUUID(), food: toFoodItem(result), quantity: 1 }]);
  }
  function setQty(id: string, q: number) {
    setIngredients((prev) => prev.map((e) => (e.id === id ? { ...e, quantity: q } : e)));
  }
  function removeIngredient(id: string) {
    setIngredients((prev) => prev.filter((e) => e.id !== id));
  }

  const canSave = name.trim().length > 0 && ingredients.length > 0;

  return (
    <div className="recipe-editor">
      <label className="field">
        <span>Recipe name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Turkey chili" />
      </label>
      <label className="field">
        <span>Servings this makes</span>
        <input type="number" min="1" step="any" value={servings} onChange={(e) => setServings(e.target.value)} />
      </label>

      <div className="field">
        <span>Ingredients</span>
        {ingredients.length > 0 && (
          <ul className="ingredient-list">
            {ingredients.map((ing) => (
              <li key={ing.id} className="ingredient">
                <span className="ingredient-name">{ing.food.name}</span>
                <input
                  className="qty-input"
                  type="number"
                  min="0"
                  step="any"
                  value={ing.quantity}
                  onChange={(e) => {
                    const q = parseFloat(e.target.value);
                    if (Number.isFinite(q) && q >= 0) setQty(ing.id, q);
                  }}
                  aria-label="Quantity"
                />
                <span className="entry-cals">{entryCalories(ing)} kcal</span>
                <button className="remove-button" onClick={() => removeIngredient(ing.id)} aria-label="Remove">×</button>
              </li>
            ))}
          </ul>
        )}
        <IngredientSearch usdaApiKey={usdaApiKey} onPick={addIngredient} />
      </div>

      <p className="recipe-totals">
        Total {Math.round(totals.calories)} kcal · {perServingCals} kcal per serving
      </p>

      <div className="recipe-editor-actions">
        <button onClick={onCancel}>Cancel</button>
        <button
          className="primary-button"
          disabled={!canSave}
          onClick={() => onSave({ id: recipe.id, name: name.trim(), ingredients, servings: parseFloat(servings) || 1 })}
        >
          Save recipe
        </button>
      </div>
    </div>
  );
}

/** A minimal food search used to add recipe ingredients. */
function IngredientSearch({
  usdaApiKey,
  onPick,
}: {
  usdaApiKey: string;
  onPick: (result: FoodSearchResult) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function handleBarcode(barcode: string) {
    setScannerOpen(false);
    setLoading(true);
    setError(null);
    try {
      const product = await fetchProductByBarcode(barcode, { usdaApiKey });
      if (product) {
        onPick(product);
        setQuery('');
        setResults([]);
      } else {
        setError(`No product found for barcode ${barcode}.`);
      }
    } catch {
      setError('Barcode lookup failed.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        setResults(await searchFoods(trimmed, { usdaApiKey, signal: controller.signal }));
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [query, usdaApiKey]);

  return (
    <div className="food-search">
      <div className="search-input-row">
        <input placeholder="Add an ingredient…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button
          type="button"
          className="scan-button"
          onClick={() => setScannerOpen(true)}
          title="Scan an ingredient"
          aria-label="Scan an ingredient"
        >
          📷
        </button>
      </div>
      {loading && <div className="search-status">Searching…</div>}
      {error && <div className="search-status error">{error}</div>}
      {results.length > 0 && (
        <ul className="search-results">
          {results.slice(0, 12).map((r, i) => (
            <li key={`${r.source}-${r.sourceId ?? i}`}>
              <button
                className="result"
                onClick={() => {
                  onPick(r);
                  setQuery('');
                  setResults([]);
                }}
              >
                <span className="result-name">
                  {r.name}
                  {r.brand && <span className="result-brand"> · {r.brand}</span>}
                </span>
                <span className="result-meta">{r.calories} kcal / {r.servingSize}{r.servingUnit}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {scannerOpen && (
        <Suspense fallback={<div className="search-status">Loading scanner…</div>}>
          <BarcodeScanner onDetected={handleBarcode} onClose={() => setScannerOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
