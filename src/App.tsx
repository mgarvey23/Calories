import { useState, type ReactNode } from 'react';
import { useAuth, usernameFromUser } from './auth';
import { isFirebaseConfigured } from './firebase';
import { useFirebaseDiary } from './hooks/useFirebaseDiary';
import { useLocalDiary } from './hooks/useLocalDiary';
import { Calendar } from './components/Calendar';
import { DayView } from './components/DayView';
import { SettingsPanel } from './components/SettingsPanel';
import { RecipesPanel } from './components/RecipesPanel';
import { ProfilePanel } from './components/ProfilePanel';
import { SignIn } from './components/SignIn';
import { saveSharedFood } from './services/sharedFoods';
import { todayISO } from './dateUtils';
import type { DiaryApi, FoodItem, MealEntry, MealType } from './types';

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
    return (
      <CloudTracker uid={user.uid} label={usernameFromUser(user)} onSignOut={signOutUser} />
    );
  }
  if (localMode) {
    return <LocalTracker onSignIn={isFirebaseConfigured ? exitLocalMode : undefined} />;
  }
  return <SignIn onUseLocal={enableLocalMode} />;
}

/** Cloud-synced path: waits for the Firestore subscription, then renders. */
function CloudTracker({ uid, label, onSignOut }: { uid: string; label: string; onSignOut: () => void }) {
  const diary = useFirebaseDiary(uid);
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
      onContributeFood={(food) => saveSharedFood(food, uid)}
      headerExtra={
        <>
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
}: {
  diary: DiaryApi;
  headerExtra: ReactNode;
  onContributeFood?: (food: FoodItem) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recipesOpen, setRecipesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

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
            onContributeFood={onContributeFood}
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
        />
      )}
    </div>
  );
}
