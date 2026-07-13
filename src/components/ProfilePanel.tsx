import { useMemo, useState } from 'react';
import type { Settings } from '../types';
import {
  ACTIVITY_LABELS,
  DEFAULT_PROFILE,
  GOAL_LABELS,
  cmToIn,
  inToCm,
  inchesToFtIn,
  kgToLb,
  lbToKg,
  maintenanceCalories,
  recommendedCalories,
  type ActivityLevel,
  type GoalType,
  type Profile,
  type Sex,
  type Units,
} from '../nutrition';

interface ProfilePanelProps {
  profile: Profile;
  onSave: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

const ACTIVITIES: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const GOALS: GoalType[] = ['lose', 'maintain', 'gain'];

/** Enter body stats and goal; get a recommended daily calorie target. */
export function ProfilePanel({ profile, onSave, onClose }: ProfilePanelProps) {
  const p = { ...DEFAULT_PROFILE, ...profile };
  const [units, setUnits] = useState<Units>(p.units);
  const [age, setAge] = useState(p.age ? String(p.age) : '');
  const [sex, setSex] = useState<Sex | ''>(p.sex ?? '');
  const [activity, setActivity] = useState<ActivityLevel>(p.activity);
  const [goalType, setGoalType] = useState<GoalType>(p.goalType);
  const [rate, setRate] = useState(String(p.ratePerWeek));

  const init = inchesToFtIn(p.heightCm ? cmToIn(p.heightCm) : 0);
  const [ft, setFt] = useState(p.heightCm ? String(init.ft) : '');
  const [inch, setInch] = useState(p.heightCm ? String(init.inch) : '');
  const [cm, setCm] = useState(p.heightCm ? String(Math.round(p.heightCm)) : '');
  const [lb, setLb] = useState(p.weightKg ? String(Math.round(kgToLb(p.weightKg))) : '');
  const [kg, setKg] = useState(p.weightKg ? String(Math.round(p.weightKg)) : '');

  const numOr = (s: string): number | undefined => {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : undefined;
  };

  const built = useMemo<Profile>(() => {
    let heightCm: number | undefined;
    let weightKg: number | undefined;
    if (units === 'imperial') {
      const f = numOr(ft);
      const i = numOr(inch) ?? 0;
      if (f !== undefined) heightCm = inToCm(f * 12 + i);
      const l = numOr(lb);
      if (l !== undefined) weightKg = lbToKg(l);
    } else {
      const c = numOr(cm);
      if (c !== undefined) heightCm = c;
      const k = numOr(kg);
      if (k !== undefined) weightKg = k;
    }
    return {
      age: numOr(age),
      sex: sex || undefined,
      heightCm,
      weightKg,
      activity,
      goalType,
      ratePerWeek: numOr(rate) ?? 0,
      units,
    };
  }, [units, ft, inch, cm, kg, lb, age, sex, activity, goalType, rate]);

  const maintenance = maintenanceCalories(built);
  const recommended = recommendedCalories(built);

  function save(applyGoal: boolean) {
    const patch: Partial<Settings> = { profile: built };
    if (applyGoal && recommended) patch.dailyCalorieGoal = recommended;
    onSave(patch);
    onClose();
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <header className="settings-header">
          <h2>Your profile</h2>
          <button className="remove-button" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="unit-toggle">
          <button className={units === 'imperial' ? 'active' : ''} onClick={() => setUnits('imperial')}>
            lb / ft
          </button>
          <button className={units === 'metric' ? 'active' : ''} onClick={() => setUnits('metric')}>
            kg / cm
          </button>
        </div>

        <div className="profile-grid">
          <label className="field">
            <span>Age</span>
            <input type="number" min="0" value={age} onChange={(e) => setAge(e.target.value)} />
          </label>
          <label className="field">
            <span>Sex</span>
            <select value={sex} onChange={(e) => setSex(e.target.value as Sex | '')}>
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>

          {units === 'imperial' ? (
            <>
              <label className="field">
                <span>Height</span>
                <div className="inline-inputs">
                  <input type="number" min="0" placeholder="ft" value={ft} onChange={(e) => setFt(e.target.value)} />
                  <input type="number" min="0" placeholder="in" value={inch} onChange={(e) => setInch(e.target.value)} />
                </div>
              </label>
              <label className="field">
                <span>Weight (lb)</span>
                <input type="number" min="0" value={lb} onChange={(e) => setLb(e.target.value)} />
              </label>
            </>
          ) : (
            <>
              <label className="field">
                <span>Height (cm)</span>
                <input type="number" min="0" value={cm} onChange={(e) => setCm(e.target.value)} />
              </label>
              <label className="field">
                <span>Weight (kg)</span>
                <input type="number" min="0" value={kg} onChange={(e) => setKg(e.target.value)} />
              </label>
            </>
          )}
        </div>

        <label className="field">
          <span>Activity level</span>
          <select value={activity} onChange={(e) => setActivity(e.target.value as ActivityLevel)}>
            {ACTIVITIES.map((a) => <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>)}
          </select>
        </label>

        <div className="profile-grid">
          <label className="field">
            <span>Goal</span>
            <select value={goalType} onChange={(e) => setGoalType(e.target.value as GoalType)}>
              {GOALS.map((g) => <option key={g} value={g}>{GOAL_LABELS[g]}</option>)}
            </select>
          </label>
          {goalType !== 'maintain' && (
            <label className="field">
              <span>Rate (lb/week)</span>
              <input type="number" min="0" step="0.25" value={rate} onChange={(e) => setRate(e.target.value)} />
            </label>
          )}
        </div>

        <div className="reco-card">
          {recommended ? (
            <>
              <div className="reco-main">
                <span className="reco-number">{recommended}</span>
                <span className="reco-unit">kcal / day</span>
              </div>
              <p className="reco-sub">
                Maintenance ≈ {Math.round(maintenance!)} kcal ·{' '}
                {goalType === 'maintain'
                  ? 'to stay the same'
                  : `to ${goalType} ~${rate || 0} lb/week`}
              </p>
            </>
          ) : (
            <p className="reco-sub">Fill in age, sex, height and weight to see your recommended calories.</p>
          )}
        </div>

        <div className="recipe-editor-actions">
          <button onClick={() => save(false)}>Save profile</button>
          <button className="primary-button" disabled={!recommended} onClick={() => save(true)}>
            Use as my daily goal
          </button>
        </div>
      </div>
    </div>
  );
}
