import { useState } from 'react';
import type { BodyScan } from '../types';
import { kgToLb, type Units } from '../nutrition';
import { formatShortDate } from '../dateUtils';
import { BodyScanChart } from './BodyScanChart';
import { ScanDetail } from './ScanDetail';

interface ScanHistoryProps {
  scans: BodyScan[];
  units: Units;
  /** When provided, each scan's detail view offers a delete button (owner only). */
  onDelete?: (scanId: string) => void;
}

/**
 * Browse body scans two ways: **Numbers** (a list of scans; open one to read all
 * its recorded values as entered) and **Graph** (the metric trend). Used by both
 * the owner's Body panel and the coach's client review.
 */
export function ScanHistory({ scans, units, onDelete }: ScanHistoryProps) {
  const [mode, setMode] = useState<'numbers' | 'graph'>('numbers');
  const [openId, setOpenId] = useState<string | null>(null);

  const massUnit = units === 'imperial' ? 'lb' : 'kg';
  const sorted = [...scans].sort((a, b) => b.date.localeCompare(a.date));
  const open = sorted.find((s) => s.id === openId) ?? null;

  return (
    <div className="scan-history">
      <div className="scan-history-tabs">
        <button type="button" className={`seg-btn ${mode === 'numbers' ? 'active' : ''}`}
          onClick={() => setMode('numbers')}>Numbers</button>
        <button type="button" className={`seg-btn ${mode === 'graph' ? 'active' : ''}`}
          onClick={() => setMode('graph')}>Graph</button>
      </div>

      {mode === 'graph' ? (
        <BodyScanChart scans={scans} units={units} />
      ) : open ? (
        <div>
          <div className="scan-detail-bar">
            <button type="button" className="link-button" onClick={() => setOpenId(null)}>‹ All scans</button>
            {onDelete && (
              <button type="button" className="remove-button"
                onClick={() => { onDelete(open.id); setOpenId(null); }} aria-label="Delete scan">×</button>
            )}
          </div>
          <ScanDetail scan={open} units={units} />
        </div>
      ) : (
        <ul className="scan-list">
          {sorted.map((s) => (
            <li key={s.id}>
              <button type="button" className="scan-open-row" onClick={() => setOpenId(s.id)}>
                <strong>{formatShortDate(s.date)}</strong>
                <span className="scan-metrics">
                  {s.weightKg != null && <span>{units === 'imperial' ? Math.round(kgToLb(s.weightKg) * 10) / 10 : Math.round(s.weightKg * 10) / 10} {massUnit}</span>}
                  {s.bodyFatPct != null && <span>{s.bodyFatPct}% fat</span>}
                  {s.muscleMassKg != null && <span>{units === 'imperial' ? Math.round(kgToLb(s.muscleMassKg) * 10) / 10 : Math.round(s.muscleMassKg * 10) / 10} {massUnit} muscle</span>}
                  {s.bmr != null && <span>{s.bmr} BMR</span>}
                </span>
                <span className="scan-open-arrow">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
