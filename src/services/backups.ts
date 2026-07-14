// ---------------------------------------------------------------------------
// Point-in-time diary backups. The live diary is one doc at users/{uid}; these
// are periodic full snapshots kept under backups/{uid}/snapshots/{id} so a diary
// can be restored if the live doc is lost or corrupted. Written by the owner (on
// a ~2h cadence, see useAutoBackup); readable by the owner and their coach.
// No-ops when Firebase isn't configured (local mode).
// ---------------------------------------------------------------------------

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { DiaryState } from '../types';
import { normalizeDiary } from './firestoreDiary';

/** Lightweight backup listing entry (no snapshot payload). */
export interface BackupMeta {
  id: string;
  /** ISO timestamp the snapshot was taken. */
  at: string;
}

/** Write a snapshot of `state`. The id is a sortable timestamp. */
export async function writeBackup(uid: string, state: DiaryState): Promise<void> {
  if (!db) return;
  const at = new Date().toISOString();
  const id = at.replace(/[:.]/g, '-');
  try {
    await setDoc(doc(db, 'backups', uid, 'snapshots', id), { at, snapshot: state });
  } catch (err) {
    console.warn('Backup failed:', err);
  }
}

/** List backups for a user, newest first. */
export async function listBackups(uid: string): Promise<BackupMeta[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(query(collection(db, 'backups', uid, 'snapshots'), orderBy('at', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, at: (d.data() as { at?: string }).at ?? '' }));
  } catch (err) {
    console.warn('Could not list backups:', err);
    return [];
  }
}

/** Fetch and normalise one backup snapshot for restoring. */
export async function getBackupSnapshot(uid: string, id: string): Promise<DiaryState | null> {
  if (!db) return null;
  try {
    const s = await getDoc(doc(db, 'backups', uid, 'snapshots', id));
    if (!s.exists()) return null;
    return normalizeDiary((s.data() as { snapshot?: Partial<DiaryState> }).snapshot);
  } catch (err) {
    console.warn('Could not read backup:', err);
    return null;
  }
}

/** Delete all but the newest `keep` snapshots. */
export async function pruneBackups(uid: string, keep = 12): Promise<void> {
  if (!db) return;
  try {
    const snap = await getDocs(query(collection(db, 'backups', uid, 'snapshots'), orderBy('at', 'desc')));
    await Promise.all(snap.docs.slice(keep).map((d) => deleteDoc(d.ref)));
  } catch (err) {
    console.warn('Could not prune backups:', err);
  }
}
