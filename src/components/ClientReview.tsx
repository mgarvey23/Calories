import { useEffect, useMemo, useState } from 'react';
import type { CoachingDoc, CoachNote, CoachTarget, DiaryState, RosterEntry } from '../types';
import {
  MEAL_LABELS,
  MEAL_TYPES,
  dayCalories,
  dayMacros,
  emptyDay,
  entriesCalories,
  entriesMacros,
  entryMacros,
  hasMacros,
  roundMacros,
} from '../types';
import { GOAL_LABELS } from '../nutrition';
import { formatLongDate, formatShortDate, todayISO } from '../dateUtils';
import { getCoachingOnce, getUserDiaryOnce, saveCoaching } from '../services/coach';
import { Calendar } from './Calendar';
import { CalorieRing } from './CalorieRing';
import { MacroRings } from './MacroRings';
import { TrendChart } from './TrendChart';

interface ClientReviewProps {
  client: RosterEntry;
  coachName: string;
  onBack: () => void;
}

/**
 * A coach's read-only review of one client: their progress trends, day-to-day
 * eating, and an editor to push a daily target and leave notes — an async
 * "focus meeting." Loads the client's diary and coaching doc on open.
 */
export function ClientReview({ client, coachName, onBack }: ClientReviewProps) {
  const [state, setState] = useState<DiaryState | null>(null);
  const [coaching, setCoaching] = useState<CoachingDoc | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayISO());

  useEffect(() => {
    let alive = true;
    setState(null);
    setLoadError(null);
    Promise.all([getUserDiaryOnce(client.uid), getCoachingOnce(client.uid)])
      .then(([diary, coach]) => {
        if (!alive) return;
        if (!diary) setLoadError('This client has no diary yet.');
        setState(diary);
        setCoaching(coach);
      })
      .catch(() => alive && setLoadError('Could not load this client.'));
    return () => { alive = false; };
  }, [client.uid]);

  // Effective goals for trend + rings: pushed target if present, else the
  // client's own goals.
  const goals = useMemo(() => {
    if (coaching?.target) return coaching.target;
    if (!state) return { calories: 2000, protein: 0, carbs: 0, fat: 0 };
    return { calories: state.settings.dailyCalorieGoal, ...state.settings.macroGoals };
  }, [coaching, state]);

  if (loadError && !state) {
    return (
      <div className="client-review">
        <button className="link-button" onClick={onBack}>‹ Back to roster</button>
        <p className="search-status error">{loadError}</p>
      </div>
    );
  }
  if (!state) {
    return (
      <div className="client-review">
        <button className="link-button" onClick={onBack}>‹ Back to roster</button>
        <p className="search-status">Loading {client.username}…</p>
      </div>
    );
  }

  const day = state.days[selectedDate] ?? emptyDay(selectedDate);
  const p = state.settings.profile;

  return (
    <div className="client-review">
      <div className="review-topbar">
        <button className="link-button" onClick={onBack}>‹ Back to roster</button>
        <h2>{client.username}</h2>
      </div>

      <section className="review-card">
        <div className="review-facts">
          {p.age && <span>Age {p.age}</span>}
          {p.sex && <span>{p.sex === 'male' ? 'Male' : 'Female'}</span>}
          {p.weightKg && <span>{Math.round(p.weightKg * 2.20462)} lb</span>}
          <span>Goal: {GOAL_LABELS[p.goalType]}</span>
          <span>Target: {goals.calories} kcal</span>
        </div>
      </section>

      <section className="review-card">
        <h3>Progress</h3>
        <TrendChart days={state.days} goals={goals} />
      </section>

      <CoachEditor
        clientUid={client.uid}
        coachName={coachName}
        coaching={coaching}
        clientGoals={{ calories: state.settings.dailyCalorieGoal, ...state.settings.macroGoals }}
        onSaved={setCoaching}
      />

      <section className="review-card">
        <h3>Day-to-day</h3>
        <div className="review-day">
          <Calendar state={state} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <div className="review-day-detail">
            <h4>{formatLongDate(selectedDate)}</h4>
            <div className="review-rings">
              <CalorieRing eaten={dayCalories(day)} goal={goals.calories} />
              <MacroRings eaten={roundMacros(dayMacros(day))} goals={goals} />
            </div>
            {MEAL_TYPES.map((meal) => {
              const entries = day.meals[meal];
              if (entries.length === 0) return null;
              const m = roundMacros(entriesMacros(entries));
              return (
                <div className="review-meal" key={meal}>
                  <div className="review-meal-head">
                    <strong>{MEAL_LABELS[meal]}</strong>
                    <span>{entriesCalories(entries)} kcal · P {m.protein} · C {m.carbs} · F {m.fat}</span>
                  </div>
                  <ul className="review-entries">
                    {entries.map((e) => {
                      const em = roundMacros(entryMacros(e));
                      return (
                        <li key={e.id}>
                          <span>{e.food.name}{e.food.brand ? ` · ${e.food.brand}` : ''}</span>
                          <span className="review-entry-meta">
                            {e.food.servingSize * e.quantity}{e.food.servingUnit} ·{' '}
                            {Math.round(e.food.calories * e.quantity)} kcal
                            {hasMacros(e.food) && ` · P ${em.protein} · C ${em.carbs} · F ${em.fat}`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            {dayCalories(day) === 0 && <p className="review-empty">Nothing logged this day.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

/** The coach's adjustment editor: push a daily target and add notes. */
function CoachEditor({
  clientUid,
  coachName,
  coaching,
  clientGoals,
  onSaved,
}: {
  clientUid: string;
  coachName: string;
  coaching: CoachingDoc | null;
  clientGoals: CoachTarget;
  onSaved: (doc: CoachingDoc) => void;
}) {
  const preset = coaching?.target ?? clientGoals;
  const [calories, setCalories] = useState(String(preset.calories));
  const [protein, setProtein] = useState(String(preset.protein));
  const [carbs, setCarbs] = useState(String(preset.carbs));
  const [fat, setFat] = useState(String(preset.fat));
  const [noteText, setNoteText] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const notes = coaching?.notes ?? [];

  async function persist(nextNotes: CoachNote[], target: CoachTarget | undefined) {
    setSaving(true);
    setStatus(null);
    try {
      await saveCoaching(clientUid, coachName, { notes: nextNotes, target });
      onSaved({ notes: nextNotes, target, coachName, updatedAt: new Date().toISOString() });
      setStatus('Saved — the client will see this.');
    } catch {
      setStatus('Could not save. Check your connection and coach access.');
    } finally {
      setSaving(false);
    }
  }

  function pushTarget() {
    const t: CoachTarget = {
      calories: Math.round(parseFloat(calories) || 0),
      protein: Math.round(parseFloat(protein) || 0),
      carbs: Math.round(parseFloat(carbs) || 0),
      fat: Math.round(parseFloat(fat) || 0),
    };
    void persist(notes, t);
  }

  function addNote() {
    const text = noteText.trim();
    if (!text) return;
    const note: CoachNote = { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() };
    setNoteText('');
    void persist([note, ...notes], coaching?.target);
  }

  return (
    <section className="review-card coach-editor">
      <h3>Adjustments</h3>
      <p className="coach-disclaimer">Coaching guidance for accountability — not clinical/medical nutrition advice.</p>

      <div className="coach-target">
        <span className="coach-target-label">Daily target</span>
        <div className="coach-target-grid">
          <label><span>Calories</span>
            <input type="number" min="0" value={calories} onChange={(e) => setCalories(e.target.value)} /></label>
          <label><span>Protein (g)</span>
            <input type="number" min="0" value={protein} onChange={(e) => setProtein(e.target.value)} /></label>
          <label><span>Carbs (g)</span>
            <input type="number" min="0" value={carbs} onChange={(e) => setCarbs(e.target.value)} /></label>
          <label><span>Fat (g)</span>
            <input type="number" min="0" value={fat} onChange={(e) => setFat(e.target.value)} /></label>
        </div>
        <button className="primary-button" onClick={pushTarget} disabled={saving}>
          Push target to their rings
        </button>
      </div>

      <div className="coach-notes">
        <span className="coach-target-label">Notes</span>
        <div className="coach-note-compose">
          <textarea
            placeholder="e.g. Great protein this week — let's add a veg at dinner."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={2}
          />
          <button onClick={addNote} disabled={saving || !noteText.trim()}>Add note</button>
        </div>
        {notes.length > 0 && (
          <ul className="coach-note-list">
            {notes.map((n) => (
              <li key={n.id}>
                <span className="coach-note-date">{formatShortDate(n.createdAt.slice(0, 10))}</span>
                <span>{n.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {status && <p className="search-status">{status}</p>}
    </section>
  );
}
