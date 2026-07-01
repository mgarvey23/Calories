import { useEffect, useRef, useState } from 'react';
import type { FoodItem, MealType } from '../types';
import { MEAL_LABELS } from '../types';
import { searchFoods, toFoodItem, type FoodSearchResult } from '../services/foodApi';

interface FoodSearchProps {
  meal: MealType;
  usdaApiKey: string;
  onAdd: (food: FoodItem, quantity: number) => void;
}

const SOURCE_LABELS: Record<FoodSearchResult['source'], string> = {
  off: 'Open Food Facts',
  usda: 'USDA',
  manual: 'Manual',
};

/**
 * Type a food name, search the databases, pick a result. The chosen food's
 * calories are computed automatically from its label data; the user only sets
 * how many servings they ate.
 */
export function FoodSearch({ meal, usdaApiKey, onAdd }: FoodSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced search as the user types.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
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

  function handlePick(result: FoodSearchResult) {
    onAdd(toFoodItem(result), 1);
    setQuery('');
    setResults([]);
  }

  return (
    <div className="food-search">
      <input
        type="text"
        placeholder={`Add food to ${MEAL_LABELS[meal].toLowerCase()}…`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {loading && <div className="search-status">Searching…</div>}
      {error && <div className="search-status error">{error}</div>}

      {results.length > 0 && (
        <ul className="search-results">
          {results.map((r, i) => (
            <li key={`${r.source}-${r.sourceId ?? i}`}>
              <button className="result" onClick={() => handlePick(r)}>
                <span className="result-name">
                  {r.name}
                  {r.brand && <span className="result-brand"> · {r.brand}</span>}
                </span>
                <span className="result-meta">
                  {r.calories} kcal / {r.servingSize}{r.servingUnit}
                  <span className="result-source">{SOURCE_LABELS[r.source]}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
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
    </div>
  );
}

function ManualEntryForm({ onAdd }: { onAdd: (food: FoodItem) => void }) {
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [servingSize, setServingSize] = useState('1');
  const [servingUnit, setServingUnit] = useState('serving');

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
    }));
    setName('');
    setCalories('');
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
      <button type="submit">Add food</button>
    </form>
  );
}
