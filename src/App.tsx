import { useEffect, useState, type ReactNode } from 'react';
import { useAuth, usernameFromUser } from './auth';
import { isFirebaseConfigured } from './firebase';
import { useFirebaseDiary } from './hooks/useFirebaseDiary';
import { useLocalDiary } from './hooks/useLocalDiary';
import { useCoaching } from './hooks/useCoaching';
import { Calendar } from './components/Calendar';
import { DayView } from './components/DayView';
import { SettingsPanel } from './components/SettingsPanel';
import { RecipesPanel } from './components/RecipesPanel';
import { ProfilePanel } from './components/ProfilePanel';
import { BodyScanPanel } from './components/BodyScanPanel';
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

  // Keep this client on the coach's roster (best-effort, no-op in local mode).
  useEffect(() => {
    void upsertRoster(uid, label);
  }, [uid, label]);

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
}: {
  diary: DiaryApi;
  headerExtra: ReactNode;
  onContributeFood?: (food: FoodItem) => void;
  coaching?: CoachingDoc | null;
}) {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recipesOpen, setRecipesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [bodyOpen, setBodyOpen] = useState(false);

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
        <h1>Calorie Tracker</h1>
        <div className="header-actions">
          <button onClick={() => setSelectedDate(todayISO())}>Today</button>
          <button onClick={() => setProfileOpen(true)}>Profile</button>
          <button onClick={() => setBodyOpen(true)}>Body</button>
          <button onClick={() => setRecipesOpen(true)}>Recipes</button>
          <button onClick={() => setSettingsOpen(true)}>Settings</button>
          {headerExtra}
        </div>
      </header>

      <main className="app-main">
        <div className="calendar-column">
          <Calendar
            state={diary.state}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </div>
        <div className="day-column">
          <DayView
            state={diary.state}
            date={selectedDate}
            onAdd={handleAdd}
            onRemove={(meal, id) => diary.removeEntry(selectedDate, meal, id)}
            onQuantityChange={(meal, id, qty) =>
              diary.updateEntryQuantity(selectedDate, meal, id, qty)
            }
            onToggleFavorite={diary.toggleFavorite}
            onTogglePin={diary.togglePin}
            onContributeFood={onContributeFood}
            coaching={coaching}
          />
        </div>
      </main>

      {settingsOpen && (
        <SettingsPanel
          state={diary.state}
          onUpdateSettings={diary.updateSettings}
          onReplaceState={diary.replaceState}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {recipesOpen && (
        <RecipesPanel
          recipes={diary.state.recipes}
          usdaApiKey={diary.state.settings.usdaApiKey}
          onSave={diary.saveRecipe}
          onDelete={diary.deleteRecipe}
          onClose={() => setRecipesOpen(false)}
        />
      )}

      {profileOpen && (
        <ProfilePanel
          profile={diary.state.settings.profile}
          onSave={diary.updateSettings}
          onClose={() => setProfileOpen(false)}
          days={diary.state.days}
          goals={effectiveGoals}
        />
      )}

      {bodyOpen && (
        <BodyScanPanel
          scans={diary.state.bodyScans ?? []}
          units={diary.state.settings.profile.units}
          profile={diary.state.settings.profile}
          onAdd={diary.addBodyScan}
          onDelete={diary.deleteBodyScan}
          onUpdateSettings={diary.updateSettings}
          onClose={() => setBodyOpen(false)}
        />
      )}
    </div>
  );
}
