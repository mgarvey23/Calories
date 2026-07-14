import { useEffect, useRef, useState } from 'react';
import type { BodyScan, Settings, SupplementGoal } from '../types';
import {
  lbToKg,
  macroGoalsFromCalories,
  recommendedFromBmr,
  type Profile,
  type Units,
} from '../nutrition';
import {
  SCAN_FIELDS,
  SCAN_GROUPS,
  SEGMENTS,
  fieldUnit,
  toCanonical,
} from '../bodyScanFields';
import { todayISO } from '../dateUtils';
import { ScanHistory } from './ScanHistory';

interface BodyScanPanelProps {
  scans: BodyScan[];
  units: Units;
  profile: Profile;
  onAdd: (scan: BodyScan) => void;
  onDelete: (scanId: string) => void;
  onUpdateSettings: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

const SUPPLEMENT_GOALS: { value: SupplementGoal; label: string }[] = [
  { value: 'fat_loss', label: 'Fat loss' },
  { value: 'muscle_gain', label: 'Muscle gain' },
  { value: 'optimal_health', label: 'Optimal health' },
];

const numOr = (s: string | undefined): number | undefined => {
  const n = parseFloat(s ?? '');
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Track body-composition scans (e.g. Evolt 360) over time. Captures the full
 * Evolt sheet — laid out in the same sections — with a trend chart for any
 * metric, a "use these" button for Evolt's own calorie/macro recommendation,
 * and a best-effort photo (OCR) that pre-fills whatever it can read.
 */
export function BodyScanPanel({ scans, units, profile, onAdd, onDelete, onUpdateSettings, onClose }: BodyScanPanelProps) {
  const massUnit = units === 'imperial' ? 'lb' : 'kg';

  // All numeric inputs live in one string map keyed by field id (segmental keys
  // look like "seg_leftArm_lean"). Non-numeric bits get their own state.
  const [vals, setVals] = useState<Record<string, string>>({});
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [upperLower, setUpperLower] = useState<'' | 'balanced' | 'unbalanced'>('');
  const [leftRight, setLeftRight] = useState<'' | 'balanced' | 'unbalanced'>('');
  const [suppGoal, setSuppGoal] = useState<SupplementGoal | ''>('');
  const [supplements, setSupplements] = useState('');
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [goalStatus, setGoalStatus] = useState<string | null>(null);
  const [tab, setTab] = useState<'add' | 'history'>(scans.length > 0 ? 'history' : 'add');
  const fileRef = useRef<HTMLInputElement>(null);

  const setVal = (k: string, v: string) => setVals((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // --- Apply Evolt's own recommendations to the daily goal -------------------
  const latestBmr = scans.find((s) => s.bmr != null)?.bmr;
  const bmrGoal = latestBmr != null ? recommendedFromBmr(latestBmr, profile) : null;
  const recScan = scans.find(
    (s) => s.recCaloriesHigh != null || s.recCaloriesLow != null || s.recProteinG != null,
  );

  function applyBmrGoal() {
    if (bmrGoal == null) return;
    onUpdateSettings({ dailyCalorieGoal: bmrGoal, macroGoals: macroGoalsFromCalories(bmrGoal) });
    setGoalStatus(`Daily goal set to ${bmrGoal} kcal from your measured BMR.`);
  }

  function applyEvoltMacros() {
    if (!recScan) return;
    const cal =
      recScan.recCaloriesLow != null && recScan.recCaloriesHigh != null
        ? Math.round((recScan.recCaloriesLow + recScan.recCaloriesHigh) / 2)
        : recScan.recCaloriesHigh ?? recScan.recCaloriesLow;
    if (cal == null) return;
    const macros =
      recScan.recProteinG != null && recScan.recCarbsG != null && recScan.recFatG != null
        ? { protein: recScan.recProteinG, carbs: recScan.recCarbsG, fat: recScan.recFatG }
        : macroGoalsFromCalories(cal);
    onUpdateSettings({ dailyCalorieGoal: cal, macroGoals: macros });
    setGoalStatus(`Daily goal set to ${cal} kcal from Evolt's recommendation.`);
  }

  // --- Photo OCR (best-effort pre-fill) --------------------------------------
  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setOcrStatus('Reading sheet… (this reads what it can — you fill the rest)');
    try {
      const { recognizeLabel, parseEvoltScan } = await import('../services/labelOcr');
      const text = await recognizeLabel(file, (p) =>
        setOcrStatus(`Reading sheet… ${Math.round(p * 100)}% (fill anything it misses)`));
      const parsed = parseEvoltScan(text);
      const filled: string[] = [];
      for (const def of SCAN_FIELDS) {
        const v = parsed[def.key];
        // Values come back as printed on the sheet, matching the display-unit inputs.
        if (v != null) { setVal(def.key, String(v)); filled.push(def.label.toLowerCase()); }
      }
      if (parsed.recCaloriesLow != null) setVal('rec_cal_low', String(parsed.recCaloriesLow));
      if (parsed.recCaloriesHigh != null) setVal('rec_cal_high', String(parsed.recCaloriesHigh));
      if (parsed.recProteinG != null) setVal('rec_protein', String(parsed.recProteinG));
      if (parsed.recCarbsG != null) setVal('rec_carbs', String(parsed.recCarbsG));
      if (parsed.recFatG != null) setVal('rec_fat', String(parsed.recFatG));
      setOcrStatus(
        filled.length > 0
          ? `Read ${filled.length} field${filled.length > 1 ? 's' : ''} (${filled.slice(0, 4).join(', ')}${filled.length > 4 ? '…' : ''}). Check them and fill the rest by hand.`
          : "Couldn't read much from the photo — the sheet is dense, so just enter the numbers below (it's quick).",
      );
    } catch {
      setOcrStatus('Photo read failed — enter the numbers below.');
    }
  }

  // --- Save ------------------------------------------------------------------
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const scan: BodyScan = { id: crypto.randomUUID(), date };

    for (const def of SCAN_FIELDS) {
      const n = numOr(vals[def.key]);
      if (n != null) (scan[def.key] as number) = toCanonical(n, def, units);
    }

    // Segmental (masses in the display unit -> kg).
    const toKg = (s?: string) => {
      const n = numOr(s);
      if (n == null) return undefined;
      return units === 'imperial' ? lbToKg(n) : n;
    };
    const segmental: NonNullable<BodyScan['segmental']> = {};
    for (const seg of SEGMENTS) {
      const lean = toKg(vals[`seg_${seg.key}_lean`]);
      const fat = toKg(vals[`seg_${seg.key}_fat`]);
      if (lean != null || fat != null) segmental[seg.key] = { leanKg: lean, fatKg: fat };
    }
    if (Object.keys(segmental).length > 0) scan.segmental = segmental;
    if (upperLower) scan.upperLowerBalanced = upperLower === 'balanced';
    if (leftRight) scan.leftRightBalanced = leftRight === 'balanced';

    // Evolt nutrition recommendation.
    scan.recCaloriesLow = numOr(vals.rec_cal_low);
    scan.recCaloriesHigh = numOr(vals.rec_cal_high);
    scan.recProteinG = numOr(vals.rec_protein);
    scan.recCarbsG = numOr(vals.rec_carbs);
    scan.recFatG = numOr(vals.rec_fat);

    if (suppGoal) scan.supplementGoal = suppGoal;
    const supps = supplements.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (supps.length) scan.supplements = supps;
    if (note.trim()) scan.note = note.trim();

    // Require at least one metric.
    const hasAny = SCAN_FIELDS.some((d) => scan[d.key] != null)
      || scan.segmental != null
      || [scan.recCaloriesLow, scan.recCaloriesHigh, scan.recProteinG, scan.recCarbsG, scan.recFatG].some((v) => v != null);
    if (!hasAny) { setOcrStatus('Enter at least one measurement.'); return; }

    onAdd(scan);
    setVals({}); setNote(''); setSupplements(''); setSuppGoal('');
    setUpperLower(''); setLeftRight(''); setDate(todayISO()); setOcrStatus('Saved.');
    setTab('history');
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel scan-panel" onClick={(e) => e.stopPropagation()}>
        <header className="settings-header">
          <h2>Body scans</h2>
          <button className="remove-button" onClick={onClose} aria-label="Close">×</button>
        </header>

        {scans.length > 0 && (
          <div className="scan-history-tabs top-tabs">
            <button type="button" className={`seg-btn ${tab === 'add' ? 'active' : ''}`} onClick={() => setTab('add')}>Add scan</button>
            <button type="button" className={`seg-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History</button>
          </div>
        )}

        {tab === 'history' && scans.length > 0 && (
          <ScanHistory scans={scans} units={units} onDelete={onDelete} />
        )}

        {tab === 'add' && (bmrGoal != null || recScan) && (
          <div className="bmr-card">
            <div className="bmr-card-main">
              <span className="bmr-sub">Set your daily goal from your scan:</span>
              <div className="apply-goal-row">
                {bmrGoal != null && (
                  <button type="button" className="primary-button small" onClick={applyBmrGoal}>
                    From BMR ({bmrGoal})
                  </button>
                )}
                {recScan && (
                  <button type="button" className="primary-button small" onClick={applyEvoltMacros}>
                    Use Evolt's macros
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {goalStatus && <div className="search-status">{goalStatus}</div>}

        {tab === 'add' && (
        <form className="manual-form scan-form" onSubmit={submit}>
          <div className="scan-form-head">
            <strong>Add a scan</strong>
            <button type="button" className="scan-button" onClick={() => fileRef.current?.click()}
              title="Photograph your Evolt sheet — reads what it can">
              📷 Scan sheet
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            style={{ display: 'none' }} onChange={handlePhoto} />
          {ocrStatus && <div className="search-status">{ocrStatus}</div>}

          <label className="field">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          {/* Numeric metric groups, mirroring the sheet's sections. */}
          {SCAN_GROUPS.map((group) => (
            <div key={group} className="scan-group">
              <h4>{group}</h4>
              <div className="scan-grid">
                {SCAN_FIELDS.filter((f) => f.group === group).map((def) => (
                  <label key={def.key} className="scan-field">
                    <span>{def.label} <em>{fieldUnit(def, units)}</em></span>
                    <input type="number" step="any" inputMode="decimal"
                      value={vals[def.key] ?? ''} onChange={(e) => setVal(def.key, e.target.value)} />
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* Segmental analysis */}
          <div className="scan-group">
            <h4>Segmental analysis ({massUnit})</h4>
            <div className="seg-grid">
              <div className="seg-head"><span /><span>Lean</span><span>Fat</span></div>
              {SEGMENTS.map((seg) => (
                <div key={seg.key} className="seg-row">
                  <span className="seg-label">{seg.label}</span>
                  <input type="number" step="any" placeholder="lean"
                    value={vals[`seg_${seg.key}_lean`] ?? ''} onChange={(e) => setVal(`seg_${seg.key}_lean`, e.target.value)} />
                  <input type="number" step="any" placeholder="fat"
                    value={vals[`seg_${seg.key}_fat`] ?? ''} onChange={(e) => setVal(`seg_${seg.key}_fat`, e.target.value)} />
                </div>
              ))}
            </div>
            <div className="scan-grid">
              <label className="scan-field">
                <span>Upper–lower balance</span>
                <select value={upperLower} onChange={(e) => setUpperLower(e.target.value as typeof upperLower)}>
                  <option value="">—</option>
                  <option value="balanced">Balanced</option>
                  <option value="unbalanced">Unbalanced</option>
                </select>
              </label>
              <label className="scan-field">
                <span>Left–right balance</span>
                <select value={leftRight} onChange={(e) => setLeftRight(e.target.value as typeof leftRight)}>
                  <option value="">—</option>
                  <option value="balanced">Balanced</option>
                  <option value="unbalanced">Unbalanced</option>
                </select>
              </label>
            </div>
          </div>

          {/* Evolt nutrition recommendation */}
          <div className="scan-group">
            <h4>Evolt nutrition recommendation</h4>
            <div className="scan-grid">
              <label className="scan-field"><span>Calories low</span>
                <input type="number" step="any" value={vals.rec_cal_low ?? ''} onChange={(e) => setVal('rec_cal_low', e.target.value)} /></label>
              <label className="scan-field"><span>Calories high</span>
                <input type="number" step="any" value={vals.rec_cal_high ?? ''} onChange={(e) => setVal('rec_cal_high', e.target.value)} /></label>
              <label className="scan-field"><span>Protein g</span>
                <input type="number" step="any" value={vals.rec_protein ?? ''} onChange={(e) => setVal('rec_protein', e.target.value)} /></label>
              <label className="scan-field"><span>Carbs g</span>
                <input type="number" step="any" value={vals.rec_carbs ?? ''} onChange={(e) => setVal('rec_carbs', e.target.value)} /></label>
              <label className="scan-field"><span>Fat g</span>
                <input type="number" step="any" value={vals.rec_fat ?? ''} onChange={(e) => setVal('rec_fat', e.target.value)} /></label>
            </div>
          </div>

          {/* Supplements */}
          <div className="scan-group">
            <h4>Supplement recommendation</h4>
            <div className="scan-grid">
              <label className="scan-field">
                <span>Suggested goal</span>
                <select value={suppGoal} onChange={(e) => setSuppGoal(e.target.value as SupplementGoal | '')}>
                  <option value="">—</option>
                  {SUPPLEMENT_GOALS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </label>
            </div>
            <textarea className="scan-supps" rows={2} placeholder="Supplements (one per line, or comma-separated)"
              value={supplements} onChange={(e) => setSupplements(e.target.value)} />
          </div>

          <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="submit" className="primary-button">Save scan</button>
        </form>
        )}
      </div>
    </div>
  );
}
