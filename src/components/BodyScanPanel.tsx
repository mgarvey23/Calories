import { useRef, useState } from 'react';
import type { BodyScan } from '../types';
import { kgToLb, lbToKg, type Units } from '../nutrition';
import { formatShortDate, todayISO } from '../dateUtils';
import { BodyScanChart } from './BodyScanChart';

interface BodyScanPanelProps {
  scans: BodyScan[];
  units: Units;
  onAdd: (scan: BodyScan) => void;
  onDelete: (scanId: string) => void;
  onClose: () => void;
}

/**
 * Track body-composition scans (e.g. Evolt 360) over time: a trend chart, a list
 * of past scans, and an add form that can be filled by hand or by photographing
 * the result sheet (OCR). Masses are entered/shown in the user's unit but stored
 * canonically in kilograms.
 */
export function BodyScanPanel({ scans, units, onAdd, onDelete, onClose }: BodyScanPanelProps) {
  const imperial = units === 'imperial';
  const massUnit = imperial ? 'lb' : 'kg';

  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [muscle, setMuscle] = useState('');
  const [bmr, setBmr] = useState('');
  const [note, setNote] = useState('');
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const numOr = (s: string): number | undefined => {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : undefined;
  };
  // Convert a mass typed in the display unit to canonical kg.
  const toKg = (s: string): number | undefined => {
    const n = numOr(s);
    if (n === undefined) return undefined;
    return imperial ? lbToKg(n) : n;
  };
  // Canonical kg -> a display-unit string for prefilling inputs.
  const fromKg = (kg: number): string =>
    String(imperial ? Math.round(kgToLb(kg) * 10) / 10 : Math.round(kg * 10) / 10);

  function reset() {
    setWeight(''); setBodyFat(''); setMuscle(''); setBmr(''); setNote('');
    setDate(todayISO()); setOcrStatus(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const scan: BodyScan = {
      id: crypto.randomUUID(),
      date,
      weightKg: toKg(weight),
      bodyFatPct: numOr(bodyFat),
      muscleMassKg: toKg(muscle),
      bmr: numOr(bmr) !== undefined ? Math.round(numOr(bmr)!) : undefined,
      note: note.trim() || undefined,
    };
    // Require at least one metric.
    if (scan.weightKg == null && scan.bodyFatPct == null && scan.muscleMassKg == null && scan.bmr == null) {
      setOcrStatus('Enter at least one measurement.');
      return;
    }
    onAdd(scan);
    reset();
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setOcrStatus('Reading scan sheet…');
    try {
      const { recognizeLabel, parseEvoltScan } = await import('../services/labelOcr');
      const text = await recognizeLabel(file, (p) => setOcrStatus(`Reading scan sheet… ${Math.round(p * 100)}%`));
      const parsed = parseEvoltScan(text);
      const filled: string[] = [];
      if (parsed.weightKg != null) { setWeight(fromKg(parsed.weightKg)); filled.push('weight'); }
      if (parsed.bodyFatPct != null) { setBodyFat(String(parsed.bodyFatPct)); filled.push('body fat'); }
      if (parsed.muscleMassKg != null) { setMuscle(fromKg(parsed.muscleMassKg)); filled.push('muscle'); }
      if (parsed.bmr != null) { setBmr(String(parsed.bmr)); filled.push('BMR'); }
      setOcrStatus(
        filled.length > 0
          ? `Filled ${filled.join(', ')} — double-check, then save.`
          : "Couldn't read the sheet. Try a clearer photo or enter the numbers by hand.",
      );
    } catch {
      setOcrStatus('Scan read failed. Enter the numbers by hand.');
    }
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <header className="settings-header">
          <h2>Body scans</h2>
          <button className="remove-button" onClick={onClose} aria-label="Close">×</button>
        </header>

        {scans.length > 0 && (
          <section className="profile-progress">
            <BodyScanChart scans={scans} units={units} />
          </section>
        )}

        <form className="manual-form" onSubmit={submit}>
          <div className="scan-form-head">
            <strong>Add a scan</strong>
            <button type="button" className="scan-button" onClick={() => fileRef.current?.click()}
              title="Photograph your Evolt result sheet to auto-fill">
              📷 Scan result sheet
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            style={{ display: 'none' }} onChange={handlePhoto} />
          {ocrStatus && <div className="search-status">{ocrStatus}</div>}

          <label className="field">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div className="manual-row">
            <input type="number" step="any" min="0" placeholder={`Weight (${massUnit})`}
              value={weight} onChange={(e) => setWeight(e.target.value)} />
            <input type="number" step="any" min="0" placeholder="Body fat (%)"
              value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} />
          </div>
          <div className="manual-row">
            <input type="number" step="any" min="0" placeholder={`Muscle mass (${massUnit})`}
              value={muscle} onChange={(e) => setMuscle(e.target.value)} />
            <input type="number" step="any" min="0" placeholder="BMR (kcal)"
              value={bmr} onChange={(e) => setBmr(e.target.value)} />
          </div>
          <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="submit" className="primary-button">Save scan</button>
        </form>

        {scans.length > 0 && (
          <ul className="scan-list">
            {scans.map((s) => (
              <li key={s.id} className="scan-row">
                <div className="scan-row-main">
                  <strong>{formatShortDate(s.date)}</strong>
                  <span className="scan-metrics">
                    {s.weightKg != null && <span>{imperial ? Math.round(kgToLb(s.weightKg) * 10) / 10 : Math.round(s.weightKg * 10) / 10} {massUnit}</span>}
                    {s.bodyFatPct != null && <span>{s.bodyFatPct}% fat</span>}
                    {s.muscleMassKg != null && <span>{imperial ? Math.round(kgToLb(s.muscleMassKg) * 10) / 10 : Math.round(s.muscleMassKg * 10) / 10} {massUnit} muscle</span>}
                    {s.bmr != null && <span>{s.bmr} BMR</span>}
                  </span>
                  {s.note && <span className="scan-note">{s.note}</span>}
                </div>
                <button className="remove-button" onClick={() => onDelete(s.id)} aria-label="Delete scan">×</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
