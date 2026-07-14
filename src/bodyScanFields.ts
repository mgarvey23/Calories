// Field definitions for the Evolt body scan, shared by the entry form, the
// read-out display, and the trend chart so all three stay in sync. Mass fields
// are stored in kg and length fields in cm; helpers convert to/from the user's
// display unit.

import { kgToLb, lbToKg, type Units } from './nutrition';

/** Numeric BodyScan keys that can be entered/graphed. */
export type ScanNumKey =
  | 'weightKg' | 'leanBodyMassKg' | 'muscleMassKg' | 'proteinKg' | 'mineralKg'
  | 'totalBodyWaterKg' | 'bodyFatMassKg' | 'subcutaneousFatMassKg'
  | 'visceralFatMassKg' | 'visceralFatAreaCm2' | 'bodyFatPct' | 'visceralFatLevel'
  | 'icfKg' | 'ecfKg' | 'bmr' | 'tee' | 'bioAge' | 'bwiScore'
  | 'abdominalCircumferenceCm' | 'waistToHipRatio';

/** How a field is stored/converted. */
export type FieldKind = 'mass' | 'length' | 'pct' | 'kcal' | 'area' | 'ratio' | 'plain';

export interface ScanFieldDef {
  key: ScanNumKey;
  label: string;
  kind: FieldKind;
  group: string;
  /** CSS var for the chart line colour. */
  varName: string;
  /** Display-unit suffix for kinds that don't convert (overrides default). */
  unit?: string;
}

const A = '--accent', P = '--protein', C = '--carbs', F = '--fat';

/** Every scan metric, in the order shown on the Evolt sheet. */
export const SCAN_FIELDS: ScanFieldDef[] = [
  { key: 'weightKg', label: 'Weight', kind: 'mass', group: 'Body composition', varName: A },
  { key: 'leanBodyMassKg', label: 'Lean body mass', kind: 'mass', group: 'Body composition', varName: P },
  { key: 'muscleMassKg', label: 'Skeletal muscle mass', kind: 'mass', group: 'Body composition', varName: P },
  { key: 'proteinKg', label: 'Protein', kind: 'mass', group: 'Body composition', varName: P },
  { key: 'mineralKg', label: 'Mineral', kind: 'mass', group: 'Body composition', varName: C },
  { key: 'totalBodyWaterKg', label: 'Total body water', kind: 'mass', group: 'Body composition', varName: A },
  { key: 'bodyFatMassKg', label: 'Body fat mass', kind: 'mass', group: 'Body composition', varName: F },
  { key: 'subcutaneousFatMassKg', label: 'Subcutaneous fat mass', kind: 'mass', group: 'Body composition', varName: F },
  { key: 'visceralFatMassKg', label: 'Visceral fat mass', kind: 'mass', group: 'Body composition', varName: F },
  { key: 'visceralFatAreaCm2', label: 'Visceral fat area', kind: 'area', group: 'Body composition', varName: F, unit: 'cm²' },
  { key: 'bodyFatPct', label: 'Total body fat', kind: 'pct', group: 'Body composition', varName: F },
  { key: 'visceralFatLevel', label: 'Visceral fat level', kind: 'plain', group: 'Body composition', varName: F, unit: '' },
  { key: 'icfKg', label: 'Intracellular fluid', kind: 'mass', group: 'Fluids', varName: A },
  { key: 'ecfKg', label: 'Extracellular fluid', kind: 'mass', group: 'Fluids', varName: A },
  { key: 'bmr', label: 'BMR', kind: 'kcal', group: 'Energy', varName: C },
  { key: 'tee', label: 'TEE', kind: 'kcal', group: 'Energy', varName: C },
  { key: 'bioAge', label: 'Bio age', kind: 'plain', group: 'Indices', varName: A, unit: 'yrs' },
  { key: 'bwiScore', label: 'BWI score', kind: 'plain', group: 'Indices', varName: A, unit: '/10' },
  { key: 'abdominalCircumferenceCm', label: 'Abdominal circumference', kind: 'length', group: 'Indices', varName: A },
  { key: 'waistToHipRatio', label: 'Waist-to-hip ratio', kind: 'ratio', group: 'Indices', varName: A, unit: '' },
];

/** Ordered list of the group names, for sectioned rendering. */
export const SCAN_GROUPS = ['Body composition', 'Fluids', 'Energy', 'Indices'];

/** The unit suffix shown for a field, given the user's unit preference. */
export function fieldUnit(def: ScanFieldDef, units: Units): string {
  if (def.kind === 'mass') return units === 'imperial' ? 'lb' : 'kg';
  if (def.kind === 'length') return units === 'imperial' ? 'in' : 'cm';
  if (def.kind === 'pct') return '%';
  if (def.kind === 'kcal') return 'kcal';
  return def.unit ?? '';
}

/** Convert a canonical stored value into the display unit. */
export function toDisplay(value: number, def: ScanFieldDef, units: Units): number {
  if (units === 'imperial' && def.kind === 'mass') return Math.round(kgToLb(value) * 10) / 10;
  if (units === 'imperial' && def.kind === 'length') return Math.round((value / 2.54) * 10) / 10;
  return Math.round(value * 100) / 100;
}

/** Convert a value typed in the display unit back to canonical (kg/cm). */
export function toCanonical(value: number, def: ScanFieldDef, units: Units): number {
  if (units === 'imperial' && def.kind === 'mass') return lbToKg(value);
  if (units === 'imperial' && def.kind === 'length') return value * 2.54;
  return value;
}

/** The five Evolt body segments, in display order. */
export const SEGMENTS: { key: 'leftArm' | 'rightArm' | 'torso' | 'leftLeg' | 'rightLeg'; label: string }[] = [
  { key: 'leftArm', label: 'Left arm' },
  { key: 'rightArm', label: 'Right arm' },
  { key: 'torso', label: 'Torso' },
  { key: 'leftLeg', label: 'Left leg' },
  { key: 'rightLeg', label: 'Right leg' },
];
