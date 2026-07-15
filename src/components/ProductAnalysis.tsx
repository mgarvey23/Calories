import { useEffect, useState } from 'react';
import type { FoodItem, JordanPriority } from '../types';
import { JORDAN_PRIORITY_LABELS } from '../types';
import { fetchAlternatives, toFoodItem, type ScannedProduct } from '../services/foodApi';
import { generateProsCons, pickSuggestion, type Suggestion } from '../services/productAnalysis';

interface ProductAnalysisProps {
  product: ScannedProduct;
  priority: JordanPriority;
  /** Log the suggested alternative instead of the scanned product. */
  onAddAlternative: (food: FoodItem) => void;
}

/**
 * Shows pros/cons for a scanned product and "Jordan's Suggestion": the best
 * alternative in the same category for the user's chosen priority.
 */
export function ProductAnalysis({ product, priority, onAddAlternative }: ProductAnalysisProps) {
  const { pros, cons } = generateProsCons(product);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setSuggestion(null);
    fetchAlternatives(product, controller.signal)
      .then((alts) => {
        if (!cancelled) setSuggestion(pickSuggestion(product, alts, priority));
      })
      .catch(() => {
        if (!cancelled) setSuggestion({ best: null, alreadyBest: true, reasons: [] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [product, priority]);

  return (
    <div className="analysis">
      <div className="analysis-proscons">
        <div className="analysis-col pros">
          <h5>Pros</h5>
          <ul>{pros.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
        <div className="analysis-col cons">
          <h5>Cons</h5>
          <ul>{cons.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      </div>

      <div className="jordan">
        <div className="jordan-head">
          <span className="jordan-title">💡 Jordan's Suggestion</span>
          <span className="jordan-mode">{JORDAN_PRIORITY_LABELS[priority]}</span>
        </div>
        {loading ? (
          <p className="jordan-loading">Jordan is comparing similar products…</p>
        ) : suggestion?.best ? (
          <div className="jordan-pick">
            <p>
              Jordan recommends <strong>{suggestion.best.name}</strong>
              {suggestion.best.brand && <span className="muted"> · {suggestion.best.brand}</span>} instead:
            </p>
            <ul className="jordan-reasons">
              {suggestion.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
            <div className="jordan-actions">
              <span className="jordan-cals">{suggestion.best.calories} cal / 100g</span>
              <button
                className="primary-button small"
                onClick={() => onAddAlternative(toFoodItem(suggestion.best!))}
              >
                Add this instead
              </button>
            </div>
          </div>
        ) : (
          <p className="jordan-best">
            Jordan says this is already a great pick for your goal — nothing similar scored better.
          </p>
        )}
      </div>
    </div>
  );
}
