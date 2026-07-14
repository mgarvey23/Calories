import { useEffect, useState } from 'react';
import type { CoachingDoc } from '../types';
import { subscribeCoaching } from '../services/coach';

/**
 * Subscribe to the coach's adjustments for the signed-in client. Returns the
 * latest coaching doc (notes + optional pushed target), or null when there are
 * none / in local mode.
 */
export function useCoaching(uid: string | undefined): CoachingDoc | null {
  const [coaching, setCoaching] = useState<CoachingDoc | null>(null);

  useEffect(() => {
    if (!uid) {
      setCoaching(null);
      return;
    }
    const unsub = subscribeCoaching(uid, setCoaching);
    return unsub;
  }, [uid]);

  return coaching;
}
