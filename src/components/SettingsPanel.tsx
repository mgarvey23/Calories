import { useEffect, useRef, useState } from 'react';
import type { DiaryState, JordanPriority, Settings } from '../types';
import { JORDAN_PRIORITIES, JORDAN_PRIORITY_LABELS } from '../types';
import { macroGoalsFromCalories } from '../nutrition';
import { exportState, importState } from '../storage';
import { getBackupSnapshot, listBackups, type BackupMeta } from '../services/backups';

interface SettingsPanelProps {
  state: DiaryState;
  onUpdateSettings: (patch: Partial<Settings>) => void;
  onReplaceState: (next: DiaryState) => void;
  onClose: () => void;
  /** Signed-in user id; enables cloud backups/restore (absent in local mode). */
  uid?: string;
}

/** Daily goal, USDA key, and data backup (export/import + cloud snapshots). */
export function SettingsPanel({ state, onUpdateSettings, onReplaceState, onClose, uid }: SettingsPanelProps) {
  const [goal, setGoal] = useState(String(state.settings.dailyCalorieGoal));
  const [key, setKey] = useState(state.settings.usdaApiKey);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const mg = state.settings.macroGoals;
  const [protein, setProtein] = useState(String(mg.protein));
  const [carbs, setCarbs] = useState(String(mg.carbs));
  const [fat, setFat] = useState(String(mg.fat));

  function saveGoal() {
    const g = parseInt(goal, 10);
    if (Number.isFinite(g) && g > 0) onUpdateSettings({ dailyCalorieGoal: g });
  }

  function saveMacros() {
    const p = parseInt(protein, 10);
    const c = parseInt(carbs, 10);
    const f = parseInt(fat, 10);
    onUpdateSettings({
      macroGoals: {
        protein: Number.isFinite(p) && p >= 0 ? p : mg.protein,
        carbs: Number.isFinite(c) && c >= 0 ? c : mg.carbs,
        fat: Number.isFinite(f) && f >= 0 ? f : mg.fat,
      },
    });
  }

  function autoMacros() {
    const g = parseInt(goal, 10) || state.settings.dailyCalorieGoal;
    const auto = macroGoalsFromCalories(g);
    setProtein(String(auto.protein));
    setCarbs(String(auto.carbs));
    setFat(String(auto.fat));
    onUpdateSettings({ macroGoals: auto });
  }

  function handleExport() {
    const blob = new Blob([exportState(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calorie-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const next = importState(await file.text());
      onReplaceState(next);
      setImportError(null);
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <header className="settings-header">
          <h2>Settings</h2>
          <button className="remove-button" onClick={onClose} aria-label="Close">×</button>
        </header>

        <label className="field">
          <span>Daily calorie goal</span>
          <input
            type="number" value={goal} min="0"
            onChange={(e) => setGoal(e.target.value)} onBlur={saveGoal}
          />
        </label>

        <div className="field">
          <span>Daily macro goals (g)</span>
          <div className="macro-goal-inputs">
            <label><small>Protein</small>
              <input type="number" min="0" value={protein}
                onChange={(e) => setProtein(e.target.value)} onBlur={saveMacros} />
            </label>
            <label><small>Carbs</small>
              <input type="number" min="0" value={carbs}
                onChange={(e) => setCarbs(e.target.value)} onBlur={saveMacros} />
            </label>
            <label><small>Fat</small>
              <input type="number" min="0" value={fat}
                onChange={(e) => setFat(e.target.value)} onBlur={saveMacros} />
            </label>
          </div>
          <button className="link-button" onClick={autoMacros}>
            Auto-set from calorie goal (30% protein / 40% carbs / 30% fat)
          </button>
        </div>

        <label className="field">
          <span>Jordan's Suggestion priority</span>
          <select
            value={state.settings.jordanPriority}
            onChange={(e) => onUpdateSettings({ jordanPriority: e.target.value as JordanPriority })}
          >
            {JORDAN_PRIORITIES.map((p) => (
              <option key={p} value={p}>{JORDAN_PRIORITY_LABELS[p]}</option>
            ))}
          </select>
          <small>How Jordan ranks better product alternatives when you scan an item.</small>
        </label>

        <label className="field">
          <span>USDA API key (optional)</span>
          <input
            type="text" value={key} placeholder="Leave blank to use shared DEMO_KEY"
            onChange={(e) => setKey(e.target.value)}
            onBlur={() => onUpdateSettings({ usdaApiKey: key.trim() })}
          />
          <small>
            Free key from fdc.nal.usda.gov/api-key-signup. The shared demo key is
            heavily rate-limited.
          </small>
        </label>

        <div className="field">
          <span>Backup &amp; restore</span>
          <div className="backup-buttons">
            <button onClick={handleExport}>Export data</button>
            <button onClick={() => fileRef.current?.click()}>Import data</button>
            <input
              ref={fileRef} type="file" accept="application/json"
              style={{ display: 'none' }} onChange={handleImport}
            />
          </div>
          {importError && <small className="error">{importError}</small>}
        </div>

        {uid && <CloudBackups uid={uid} onRestore={onReplaceState} />}
      </div>
    </div>
  );
}

/** Cloud snapshots list with a two-step restore. */
function CloudBackups({ uid, onRestore }: { uid: string; onRestore: (s: DiaryState) => void }) {
  const [backups, setBackups] = useState<BackupMeta[] | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listBackups(uid).then((b) => alive && setBackups(b));
    return () => { alive = false; };
  }, [uid]);

  async function restore(id: string) {
    setStatus('Restoring…');
    const snap = await getBackupSnapshot(uid, id);
    if (snap) { onRestore(snap); setStatus('Restored from backup.'); }
    else setStatus('Could not load that backup.');
    setConfirmId(null);
  }

  return (
    <div className="field">
      <span>Automatic backups</span>
      <small>Snapshots are saved automatically while the app is open (about every 2 hours). Restore one if something goes wrong.</small>
      {backups === null && <small>Loading…</small>}
      {backups && backups.length === 0 && <small>No backups yet — one will be saved shortly.</small>}
      {backups && backups.length > 0 && (
        <ul className="backup-list">
          {backups.map((b) => (
            <li key={b.id}>
              <span>{new Date(b.at).toLocaleString()}</span>
              {confirmId === b.id ? (
                <span className="backup-confirm">
                  <button className="primary-button small" onClick={() => restore(b.id)}>Confirm restore</button>
                  <button className="link-button" onClick={() => setConfirmId(null)}>Cancel</button>
                </span>
              ) : (
                <button className="link-button" onClick={() => setConfirmId(b.id)}>Restore</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {status && <small>{status}</small>}
    </div>
  );
}
