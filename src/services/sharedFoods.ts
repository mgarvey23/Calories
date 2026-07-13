// ---------------------------------------------------------------------------
// Community food database: a shared Firestore `foods` collection everyone can
// read and any signed-in user can contribute to. Manually-entered foods are
// saved here so other users can find them, and scanned barcodes are remembered.
// Requires the matching security rules (see firestore.rules) and a signed-in
// user; in local mode these functions no-op.
// ---------------------------------------------------------------------------

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { FoodItem } from '../types';
import type { FoodSearchResult } from './foodApi';

interface SharedFoodDoc {
  name: string;
  nameLower: string;
  brand?: string | null;
  barcode?: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
}

/** Stable document id: keyed by barcode when known, else by name+calories. */
function foodId(food: FoodItem): string {
  if (food.sourceId) return `bc_${food.sourceId.replace(/[^A-Za-z0-9]/g, '')}`;
  const slug = food.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `nm_${slug}_${food.calories}`;
}

function toResult(d: SharedFoodDoc): FoodSearchResult {
  return {
    name: d.name,
    brand: d.brand ?? undefined,
    source: 'community',
    sourceId: d.barcode ?? undefined,
    servingSize: d.servingSize,
    servingUnit: d.servingUnit,
    calories: d.calories,
    protein: d.protein ?? undefined,
    carbs: d.carbs ?? undefined,
    fat: d.fat ?? undefined,
  };
}

/** Contribute a food to the shared database (best-effort; ignores failures). */
export async function saveSharedFood(food: FoodItem, uid: string): Promise<void> {
  if (!db) return;
  const payload = {
    name: food.name,
    nameLower: food.name.toLowerCase(),
    brand: food.brand ?? null,
    barcode: food.sourceId ?? null,
    servingSize: food.servingSize,
    servingUnit: food.servingUnit,
    calories: food.calories,
    protein: food.protein ?? null,
    carbs: food.carbs ?? null,
    fat: food.fat ?? null,
    createdBy: uid,
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, 'foods', foodId(food)), payload, { merge: true });
  } catch (err) {
    console.warn('Could not save shared food:', err);
  }
}

/** Prefix search of the shared database by name. */
export async function searchSharedFoods(q: string, signal?: AbortSignal): Promise<FoodSearchResult[]> {
  if (!db) return [];
  const ql = q.trim().toLowerCase();
  if (ql.length < 2) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, 'foods'),
        orderBy('nameLower'),
        where('nameLower', '>=', ql),
        where('nameLower', '<=', ql + String.fromCharCode(0xf8ff)),
        limit(10),
      ),
    );
    if (signal?.aborted) return [];
    return snap.docs.map((d) => toResult(d.data() as SharedFoodDoc));
  } catch (err) {
    console.warn('Shared food search failed:', err);
    return [];
  }
}

/** Look up a remembered food by its barcode. */
export async function getSharedFoodByBarcode(barcode: string): Promise<FoodSearchResult | null> {
  if (!db) return null;
  try {
    const id = `bc_${barcode.replace(/[^A-Za-z0-9]/g, '')}`;
    const snap = await getDoc(doc(db, 'foods', id));
    return snap.exists() ? toResult(snap.data() as SharedFoodDoc) : null;
  } catch {
    return null;
  }
}
