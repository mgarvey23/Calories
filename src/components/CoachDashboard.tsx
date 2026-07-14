import { useEffect, useState } from 'react';
import type { RosterEntry } from '../types';
import { formatShortDate } from '../dateUtils';
import { listRoster } from '../services/coach';
import { ClientReview } from './ClientReview';

interface CoachDashboardProps {
  coachName: string;
  /** Switch to the coach's own personal tracker. */
  onOpenMyTracker: () => void;
  onSignOut: () => void;
}

/**
 * The master/coach view: a roster of everyone using the app. Pick a name to open
 * their full review (trends, day-to-day eating, and adjustments). Only accounts
 * flagged as coaches in the console reach this screen (enforced by rules).
 */
export function CoachDashboard({ coachName, onOpenMyTracker, onSignOut }: CoachDashboardProps) {
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RosterEntry | null>(null);

  useEffect(() => {
    let alive = true;
    listRoster()
      .then((r) => alive && setRoster(r))
      .catch(() => alive && setError('Could not load the roster.'));
    return () => { alive = false; };
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Coach · Focus Meetings</h1>
        <div className="header-actions">
          <button onClick={onOpenMyTracker}>My tracker</button>
          <span className="user-label">{coachName}</span>
          <button onClick={onSignOut}>Sign out</button>
        </div>
      </header>

      <main className="app-main coach-main">
        {selected ? (
          <ClientReview client={selected} coachName={coachName} onBack={() => setSelected(null)} />
        ) : (
          <div className="roster">
            <h2>Your people</h2>
            {error && <p className="search-status error">{error}</p>}
            {roster === null && !error && <p className="search-status">Loading roster…</p>}
            {roster && roster.length === 0 && (
              <p className="search-status">
                No one on the roster yet. People appear here after they sign in and log food.
              </p>
            )}
            {roster && roster.length > 0 && (
              <ul className="roster-list">
                {roster.map((r) => (
                  <li key={r.uid}>
                    <button className="roster-row" onClick={() => setSelected(r)}>
                      <span className="roster-name">
                        {r.displayName || r.username}
                        {r.displayName && r.displayName !== r.username && (
                          <span className="roster-username"> @{r.username}</span>
                        )}
                      </span>
                      {r.updatedAt && (
                        <span className="roster-seen">active {formatShortDate(r.updatedAt.slice(0, 10))}</span>
                      )}
                      <span className="roster-open">Review ›</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
