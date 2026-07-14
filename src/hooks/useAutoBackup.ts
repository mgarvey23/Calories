import { useEffect, useRef } from 'react';
import type { DiaryState } from '../types';
import { pruneBackups, writeBackup } from '../services/backups';

const TWO_HOURS = 2 * 60 * 60 * 1000;

/**
 * While signed in, snapshot the diary to Firestore roughly every 2 hours (and
 * when the tab is hidden, if it's been that long) so there's a point-in-time
 * backup to restore from. A localStorage timestamp de-dupes across reloads.
 * No-op in local mode (writeBackup guards on `db`).
 */
export function useAutoBackup(uid: string | undefined, state: DiaryState | null): void {
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    if (!uid) return;
    const key = `calorie-tracker:last-backup:${uid}`;
    const due = () => Date.now() - Number(localStorage.getItem(key) || 0) >= TWO_HOURS;
    const run = async () => {
      if (!stateRef.current || !due()) return;
      localStorage.setItem(key, String(Date.now())); // claim the slot first
      await writeBackup(uid, stateRef.current);
      await pruneBackups(uid, 12);
    };
    const first = setTimeout(() => { void run(); }, 15000);
    const interval = setInterval(() => { void run(); }, 30 * 60 * 1000); // re-check every 30m
    const onHide = () => { if (document.visibilityState === 'hidden') void run(); };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [uid]);
}
