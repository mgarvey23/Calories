// Firestore persistence for a user's diary. The whole DiaryState is stored in a
// single document at users/{uid} — simple and well within Firestore's 1MB doc
// limit for personal use.

import { doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import type { DiaryState } from '../types';
import { defaultState } from '../storage';

function userDoc(uid: string) {
  if (!db) throw new Error('Firestore is not configured');
  return doc(db, 'users', uid);
}

/** Coerce a Firestore document payload into a valid DiaryState. */
function normalize(data: Partial<DiaryState> | undefined): DiaryState {
  const base = defaultState();
  return {
    version: base.version,
    settings: { ...base.settings, ...(data?.settings ?? {}) },
    days: data?.days ?? {},
    favorites: data?.favorites ?? [],
    recipes: data?.recipes ?? [],
  };
}

/**
 * Subscribe to a user's diary. Calls `onData` with the current state whenever it
 * changes (including local, offline-cached updates). `onMissing` fires once when
 * the user has no document yet, so the caller can seed it (e.g. migrate local
 * data).
 */
export function subscribeDiary(
  uid: string,
  onData: (state: DiaryState) => void,
  onMissing: () => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    userDoc(uid),
    { includeMetadataChanges: true },
    (snap) => {
      // Skip echoes of our own not-yet-acknowledged writes so they don't clobber
      // the optimistic local state.
      if (snap.metadata.hasPendingWrites) return;

      if (snap.exists()) {
        onData(normalize(snap.data() as Partial<DiaryState>));
      } else if (!snap.metadata.fromCache) {
        // Only seed a new document once the server has confirmed none exists,
        // to avoid overwriting server data during an offline-first load.
        onMissing();
      }
    },
    (err) => {
      console.error('Diary subscription error:', err);
      onError?.(err);
    },
  );
}

/** Overwrite a user's diary document. */
export async function saveDiary(uid: string, state: DiaryState): Promise<void> {
  await setDoc(userDoc(uid), state);
}
