// ---------------------------------------------------------------------------
// Coaching ("focus meeting") backend. A coach account — flagged by a
// `coaches/{uid}` document created once in the Firebase console — can read every
// client's diary, see the roster of who's using the app, and write per-client
// adjustments (notes + a pushed daily target) to `coaching/{clientUid}`.
//
// The coaching doc is deliberately separate from `users/{uid}`: the client
// rewrites its own user doc wholesale (see firestoreDiary.saveDiary), so coach
// writes would be clobbered if they lived there. Requires the matching security
// rules (see firestore.rules). In local mode (no Firebase) every function is a
// safe no-op.
// ---------------------------------------------------------------------------

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { CoachingDoc, DiaryState, RosterEntry } from '../types';
import { normalizeDiary } from './firestoreDiary';

/** True if this account has been marked as a coach in the Firebase console. */
export async function isCoachAccount(uid: string): Promise<boolean> {
  if (!db) return false;
  try {
    const snap = await getDoc(doc(db, 'coaches', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

/**
 * Record/refresh this client's roster entry so a coach can list everyone by
 * name. Best-effort; ignores failures (e.g. offline).
 */
export async function upsertRoster(uid: string, username: string, displayName?: string): Promise<void> {
  if (!db) return;
  try {
    await setDoc(
      doc(db, 'roster', uid),
      { uid, username, displayName: displayName?.trim() || username, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (err) {
    console.warn('Could not update roster:', err);
  }
}

/** List every client on the roster (coach-only per rules). Newest activity first. */
export async function listRoster(): Promise<RosterEntry[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'roster'));
    const rows = snap.docs.map((d) => {
      const data = d.data() as { uid?: string; username?: string; displayName?: string; updatedAt?: { toMillis?: () => number } };
      return {
        uid: data.uid ?? d.id,
        username: data.username ?? d.id,
        displayName: data.displayName,
        updatedAt:
          data.updatedAt?.toMillis?.() != null
            ? new Date(data.updatedAt.toMillis!()).toISOString()
            : '',
      } as RosterEntry;
    });
    rows.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    return rows;
  } catch (err) {
    console.warn('Could not load roster:', err);
    return [];
  }
}

/** Read one client's full diary once (coach-only per rules). */
export async function getUserDiaryOnce(uid: string): Promise<DiaryState | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return normalizeDiary(snap.data() as Partial<DiaryState>);
  } catch (err) {
    console.warn('Could not load client diary:', err);
    return null;
  }
}

/** Read one client's coaching doc once (for the coach's editor). */
export async function getCoachingOnce(clientUid: string): Promise<CoachingDoc | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'coaching', clientUid));
    return snap.exists() ? (snap.data() as CoachingDoc) : null;
  } catch {
    return null;
  }
}

/**
 * Subscribe to the coaching doc for a client (used client-side to show the
 * coach's latest notes/target). Calls back with null when none exists.
 */
export function subscribeCoaching(
  clientUid: string,
  onData: (doc: CoachingDoc | null) => void,
): Unsubscribe {
  if (!db) {
    onData(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, 'coaching', clientUid),
    (snap) => onData(snap.exists() ? (snap.data() as CoachingDoc) : null),
    (err) => {
      console.warn('Coaching subscription error:', err);
      onData(null);
    },
  );
}

/** Write a client's coaching doc (coach-only per rules). */
export async function saveCoaching(clientUid: string, coachName: string, next: Omit<CoachingDoc, 'updatedAt'>): Promise<void> {
  if (!db) return;
  await setDoc(
    doc(db, 'coaching', clientUid),
    { ...next, coachName, updatedAt: new Date().toISOString() },
    { merge: true },
  );
}
