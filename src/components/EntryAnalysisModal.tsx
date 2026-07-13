import { useEffect, useState } from 'react';
import type { FoodItem, JordanPriority } from '../types';
import { fetchProductByBarcode, type ScannedProduct } from '../services/foodApi';
import { ProductAnalysis } from './ProductAnalysis';

interface EntryAnalysisModalProps {
  food: FoodItem;
  priority: JordanPriority;
  usdaApiKey: string;
  onAddAlternative: (food: FoodItem) => void;
  onClose: () => void;
}

/**
 * Re-opens the pros/cons + Jordan's Suggestion analysis for a food already
 * logged, by re-fetching the product from Open Food Facts by its code.
 */
export function EntryAnalysisModal({
  food,
  priority,
  usdaApiKey,
  onAddAlternative,
  onClose,
}: EntryAnalysisModalProps) {
  const [product, setProduct] = useState<ScannedProduct | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    if (food.source !== 'off' || !food.sourceId) {
      setStatus('unavailable');
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    fetchProductByBarcode(food.sourceId, { usdaApiKey, signal: controller.signal })
      .then((p) => {
        if (cancelled) return;
        if (p) {
          setProduct(p);
          setStatus('ready');
        } else {
          setStatus('unavailable');
        }
      })
      .catch(() => !cancelled && setStatus('unavailable'));
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [food, usdaApiKey]);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <header className="settings-header">
          <h2>{food.name}</h2>
          <button className="remove-button" onClick={onClose} aria-label="Close">×</button>
        </header>

        {status === 'loading' && <p className="setup-hint">Loading analysis…</p>}
        {status === 'unavailable' && (
          <p className="setup-hint">
            Pros/cons and Jordan's Suggestion are available for scanned or branded
            products with label data in Open Food Facts.
          </p>
        )}
        {status === 'ready' && product && (
          <ProductAnalysis
            product={product}
            priority={priority}
            onAddAlternative={(f) => {
              onAddAlternative(f);
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}
