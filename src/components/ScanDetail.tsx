import type { BodyScan } from '../types';
import { kgToLb, type Units } from '../nutrition';
import {
  SCAN_FIELDS,
  SCAN_GROUPS,
  SEGMENTS,
  fieldUnit,
  toDisplay,
} from '../bodyScanFields';
import { formatLongDate } from '../dateUtils';

const SUPP_GOAL_LABELS: Record<string, string> = {
  fat_loss: 'Fat loss',
  muscle_gain: 'Muscle gain',
  optimal_health: 'Optimal health',
};

/**
 * Read-only display of a single body scan, laid out in the same sections as the
 * Evolt sheet / entry form. Only fields that were recorded are shown; values are
 * rendered in the user's units.
 */
export function ScanDetail({ scan, units }: { scan: BodyScan; units: Units }) {
  const mass = (kg: number) => (units === 'imperial' ? Math.round(kgToLb(kg) * 10) / 10 : Math.round(kg * 10) / 10);
  const massUnit = units === 'imperial' ? 'lb' : 'kg';

  const segRows = SEGMENTS.map((seg) => ({ seg, v: scan.segmental?.[seg.key] }))
    .filter((r) => r.v && (r.v.leanKg != null || r.v.fatKg != null));
  const hasRec = [scan.recCaloriesLow, scan.recCaloriesHigh, scan.recProteinG, scan.recCarbsG, scan.recFatG]
    .some((v) => v != null);

  return (
    <div className="scan-detail">
      <h4 className="scan-detail-date">{formatLongDate(scan.date)}</h4>

      {SCAN_GROUPS.map((group) => {
        const rows = SCAN_FIELDS.filter((f) => f.group === group && typeof scan[f.key] === 'number');
        if (rows.length === 0) return null;
        return (
          <div className="scan-detail-group" key={group}>
            <h5>{group}</h5>
            <dl className="scan-detail-list">
              {rows.map((def) => (
                <div className="scan-detail-row" key={def.key}>
                  <dt>{def.label}</dt>
                  <dd>{toDisplay(scan[def.key] as number, def, units)} {fieldUnit(def, units)}</dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}

      {(segRows.length > 0 || scan.upperLowerBalanced != null || scan.leftRightBalanced != null) && (
        <div className="scan-detail-group">
          <h5>Segmental analysis</h5>
          {segRows.length > 0 && (
            <dl className="scan-detail-list">
              {segRows.map(({ seg, v }) => (
                <div className="scan-detail-row" key={seg.key}>
                  <dt>{seg.label}</dt>
                  <dd>
                    {v!.leanKg != null && <>lean {mass(v!.leanKg)} {massUnit}</>}
                    {v!.leanKg != null && v!.fatKg != null && ' · '}
                    {v!.fatKg != null && <>fat {mass(v!.fatKg)} {massUnit}</>}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <div className="scan-detail-tags">
            {scan.upperLowerBalanced != null && (
              <span>Upper–lower: {scan.upperLowerBalanced ? 'Balanced' : 'Unbalanced'}</span>
            )}
            {scan.leftRightBalanced != null && (
              <span>Left–right: {scan.leftRightBalanced ? 'Balanced' : 'Unbalanced'}</span>
            )}
          </div>
        </div>
      )}

      {hasRec && (
        <div className="scan-detail-group">
          <h5>Evolt nutrition recommendation</h5>
          <dl className="scan-detail-list">
            {(scan.recCaloriesLow != null || scan.recCaloriesHigh != null) && (
              <div className="scan-detail-row"><dt>Calories</dt>
                <dd>{[scan.recCaloriesLow, scan.recCaloriesHigh].filter((v) => v != null).join('–')} cal</dd></div>
            )}
            {scan.recProteinG != null && <div className="scan-detail-row"><dt>Protein</dt><dd>{scan.recProteinG} g</dd></div>}
            {scan.recCarbsG != null && <div className="scan-detail-row"><dt>Carbs</dt><dd>{scan.recCarbsG} g</dd></div>}
            {scan.recFatG != null && <div className="scan-detail-row"><dt>Fat</dt><dd>{scan.recFatG} g</dd></div>}
          </dl>
        </div>
      )}

      {(scan.supplementGoal || (scan.supplements && scan.supplements.length > 0)) && (
        <div className="scan-detail-group">
          <h5>Supplements</h5>
          {scan.supplementGoal && <p className="scan-detail-goal">Goal: {SUPP_GOAL_LABELS[scan.supplementGoal]}</p>}
          {scan.supplements && scan.supplements.length > 0 && (
            <ul className="scan-detail-supps">
              {scan.supplements.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}
        </div>
      )}

      {scan.note && <p className="scan-detail-note">“{scan.note}”</p>}
    </div>
  );
}
