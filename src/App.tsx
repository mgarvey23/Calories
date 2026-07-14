import { useEffect, useState, type ReactNode } from 'react';
import { useAuth, usernameFromUser } from './auth';
import { isFirebaseConfigured } from './firebase';
import { useFirebaseDiary } from './hooks/useFirebaseDiary';
import { useLocalDiary } from './hooks/useLocalDiary';
import { useCoaching } from './hooks/useCoaching';
import { useAutoBackup } from './hooks/useAutoBackup';
import { Calendar } from './components/Calendar';
import { DayView } from './components/DayView';
import { SettingsPanel } from './components/SettingsPanel';
import { RecipesPanel } from './components/RecipesPanel';
import { ProfilePanel } from './components/ProfilePanel';
import { BodyScanPanel } from './components/BodyScanPanel';
import { Dashboard, type ScreenView } from './components/Dashboard';
import { CoachDashboard } from './components/CoachDashboard';
import { SignIn } from './components/SignIn';
import { saveSharedFood } from './services/sharedFoods';
import { isCoachAccount, upsertRoster } from './services/coach';
import { todayISO } from './dateUtils';
import type { CoachingDoc, DiaryApi, FoodItem, MealEntry, MealType } from './types';

const LOCAL_MODE_KEY = 'calorie-tracker:local-mode';

export default function App() {
  const { user, loading, signOutUser } = useAuth();
  const [localMode, setLocalMode] = useState(
    () => localStorage.getItem(LOCAL_MODE_KEY) === '1',
  );

  function enableLocalMode() {
    localStorage.setItem(LOCAL_MODE_KEY, '1');
    setLocalMode(true);
  }
  function exitLocalMode() {
    localStorage.removeItem(LOCAL_MODE_KEY);
    setLocalMode(false);
  }

  if (loading) {
    return <div className="app-loading">Loading…</div>;
  }
  if (user) {
    return <SignedIn uid={user.uid} label={usernameFromUser(user)} onSignOut={signOutUser} />;
  }
  if (localMode) {
    return <LocalTracker onSignIn={isFirebaseConfigured ? exitLocalMode : undefined} />;
  }
  return <SignIn onUseLocal={enableLocalMode} />;
}

/**
 * Signed-in router. Checks once whether this account is a coach; coaches get a
 * roster/master view they can toggle with their own personal tracker.
 */
function SignedIn({ uid, label, onSignOut }: { uid: string; label: string; onSignOut: () => void }) {
  const [isCoach, setIsCoach] = useState(false);
  const [view, setView] = useState<'coach' | 'me'>('coach');

  useEffect(() => {
    let alive = true;
    isCoachAccount(uid).then((c) => alive && setIsCoach(c));
    return () => { alive = false; };
  }, [uid]);

  if (isCoach && view === 'coach') {
    return (
      <CoachDashboard
        coachName={label}
        onOpenMyTracker={() => setView('me')}
        onSignOut={onSignOut}
      />
    );
  }
  return (
    <CloudTracker
      uid={uid}
      label={label}
      onSignOut={onSignOut}
      onBackToCoach={isCoach ? () => setView('coach') : undefined}
    />
  );
}

/** Cloud-synced path: waits for the Firestore subscription, then renders. */
function CloudTracker({
  uid,
  label,
  onSignOut,
  onBackToCoach,
}: {
  uid: string;
  label: string;
  onSignOut: () => void;
  onBackToCoach?: () => void;
}) {
  const diary = useFirebaseDiary(uid);
  const coaching = useCoaching(uid);
  useAutoBackup(uid, diary.state);

  // Keep this client on the coach's roster by real name (best-effort; no-op in
  // local mode). Re-runs once the diary loads and the name is known.
  const rosterName = diary.state?.settings.profile.name;
  useEffect(() => {
    void upsertRoster(uid, label, rosterName);
  }, [uid, label, rosterName]);

  if (diary.error && !diary.state) {
    return (
      <div className="app-loading">
        <div style={{ textAlign: 'center' }}>
          <p>Couldn't load your diary: {diary.error}</p>
          <button onClick={onSignOut}>Sign out</button>
        </div>
      </div>
    );
  }
  if (!diary.state) {
    return <div className="app-loading">Syncing your diary…</div>;
  }
  return (
    <TrackerView
      diary={diary as DiaryApi}
      coaching={coaching}
      uid={uid}
      onContributeFood={(food) => saveSharedFood(food, uid)}
      headerExtra={
        <>
          {onBackToCoach && <button onClick={onBackToCoach}>Coach view</button>}
          <span className="user-label" title={label}>{label}</span>
          <button onClick={onSignOut}>Sign out</button>
        </>
      }
    />
  );
}

/** Local-only path: on-device storage, no account required. */
function LocalTracker({ onSignIn }: { onSignIn?: () => void }) {
  const diary = useLocalDiary();
  return (
    <TrackerView
      diary={diary}
      headerExtra={
        <>
          <span className="user-label">Local mode</span>
          {onSignIn && <button onClick={onSignIn}>Sign in to sync</button>}
        </>
      }
    />
  );
}

/** The main tracker UI, backend-agnostic (works with either diary hook). */
function TrackerView({
  diary,
  headerExtra,
  onContributeFood,
  coaching,
  uid,
}: {
  diary: DiaryApi;
  headerExtra: ReactNode;
  onContributeFood?: (food: FoodItem) => void;
  coaching?: CoachingDoc | null;
  uid?: string;
}) {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [view, setView] = useState<'home' | ScreenView>('home');
  const home = () => setView('home');

  // Effective daily goals: a coach's pushed target overrides the user's own.
  const t = coaching?.target;
  const effectiveGoals = t
    ? { calories: t.calories, protein: t.protein, carbs: t.carbs, fat: t.fat }
    : {
        calories: diary.state.settings.dailyCalorieGoal,
        ...diary.state.settings.macroGoals,
      };

  function handleAdd(meal: MealType, food: FoodItem, quantity: number) {
    const entry: MealEntry = { id: crypto.randomUUID(), food, quantity };
    diary.addEntry(selectedDate, meal, entry);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          {view !== 'home' && (
            <button className="home-button" onClick={home} aria-label="Home">‹ Home</button>
          )}
          Calorie Tracker
        </h1>
        <div className="header-actions">
          {view === 'diary' && (
            <button onClick={() => setSelectedDate(todayISO())}>Today</button>
          )}
          {headerExtra}
        </div>
      </header>

      {view === 'home' && (
        <main className="app-main-single">
          <Dashboard state={diary.state} goal={effectiveGoals.calories} onNavigate={setView} />
        </main>
      )}

      {view === 'diary' && (
        <main className="app-main">
          <div className="calendar-column">
            <Calendar state={diary.state} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          </div>
          <div className="day-column">
            <DayView
              state={diary.state}
              date={selectedDate}
              onAdd={handleAdd}
              onRemove={(meal, id) => diary.removeEntry(selectedDate, meal, id)}
              onQuantityChange={(meal, id, qty) => diary.updateEntryQuantity(selectedDate, meal, id, qty)}
              onToggleFavorite={diary.toggleFavorite}
              onTogglePin={diary.togglePin}
              onContributeFood={onContributeFood}
              coaching={coaching}
            />
          </div>
        </main>
      )}

      {view === 'settings' && (
        <SettingsPanel
          state={diary.state}
          onUpdateSettings={diary.updateSettings}
          onReplaceState={diary.replaceState}
          onClose={home}
          uid={uid}
        />
      )}

      {view === 'recipes' && (
        <RecipesPanel
          recipes={diary.state.recipes}
          usdaApiKey={diary.state.settings.usdaApiKey}
          onSave={diary.saveRecipe}
          onDelete={diary.deleteRecipe}
          onClose={home}
        />
      )}

      {view === 'profile' && (
        <ProfilePanel
          profile={diary.state.settings.profile}
          onSave={diary.updateSettings}
          onClose={home}
          days={diary.state.days}
          goals={effectiveGoals}
        />
      )}

      {view === 'body' && (
        <BodyScanPanel
          scans={diary.state.bodyScans ?? []}
          units={diary.state.settings.profile.units}
          profile={diary.state.settings.profile}
          onAdd={diary.addBodyScan}
          onDelete={diary.deleteBodyScan}
          onUpdateSettings={diary.updateSettings}
          onClose={home}
        />
      )}
    </div>
  );
}
