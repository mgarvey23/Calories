// Reads a photo using in-browser OCR (Tesseract) and parses it. Two parsers
// share the OCR pass: a Nutrition Facts label (serving/calories/macros) and an
// Evolt 360 body-composition result sheet (weight/body fat/muscle/BMR).
//
// Tesseract is heavy (it downloads a language model on first use), so it is
// imported lazily — only when the user actually scans — to keep it out of the
// initial bundle.

/** What we could pull off a label. Every field is optional — OCR is fuzzy. */
export interface ParsedLabel {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  servingSize?: number;
  servingUnit?: string;
}

/**
 * What we could pull off an Evolt body-scan sheet. Values are the numbers as
 * printed on the sheet (the sheet doesn't tag units per value, so masses come
 * back in whatever unit the sheet used — the form treats them as display-unit
 * values). Every field is optional; OCR of a dense sheet is best-effort.
 */
export interface ParsedBodyScan {
  weightKg?: number;
  leanBodyMassKg?: number;
  muscleMassKg?: number;
  proteinKg?: number;
  mineralKg?: number;
  totalBodyWaterKg?: number;
  bodyFatMassKg?: number;
  subcutaneousFatMassKg?: number;
  visceralFatMassKg?: number;
  visceralFatAreaCm2?: number;
  bodyFatPct?: number;
  visceralFatLevel?: number;
  icfKg?: number;
  ecfKg?: number;
  bmr?: number;
  tee?: number;
  bioAge?: number;
  bwiScore?: number;
  abdominalCircumferenceCm?: number;
  waistToHipRatio?: number;
  recCaloriesLow?: number;
  recCaloriesHigh?: number;
  recProteinG?: number;
  recCarbsG?: number;
  recFatG?: number;
}

/** Run OCR on an image file and return the raw recognised text. */
export async function recognizeLabel(
  file: Blob,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  // Lazy-load so the ~big OCR engine only ships when needed.
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', undefined, {
    logger: onProgress
      ? (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') onProgress(m.progress);
        }
      : undefined,
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text ?? '';
  } finally {
    await worker.terminate();
  }
}

/** First capture group parsed as a float, or undefined if no match. */
function num(text: string, re: RegExp): number | undefined {
  const m = text.match(re);
  if (!m) return undefined;
  const n = parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Parse Nutrition Facts text into structured values. Tolerant of OCR noise:
 * matching is case-insensitive, allows the number to sit a little after the
 * keyword, and ignores the "% Daily Value" column by anchoring on the gram
 * unit right after the amount.
 */
export function parseNutritionLabel(text: string): ParsedLabel {
  // Collapse whitespace/newlines so a label wrapped across lines still matches.
  const flat = text.replace(/\s+/g, ' ');

  // Calories: the number following the word "Calories" (not the "per serving"
  // that sometimes precedes it). Cap at a sane label range to reject stray IDs.
  let calories: number | undefined;
  const calMatch = flat.match(/calories\s*:?\s*(\d{1,4})/i);
  if (calMatch) {
    const c = parseInt(calMatch[1], 10);
    if (c > 0 && c <= 2000) calories = c;
  }

  // Macros: keyword followed by an amount in grams (e.g. "Protein 12g",
  // "Total Fat 8 g", "Total Carbohydrate 27g").
  const protein = num(flat, /protein\s*:?\s*(\d+(?:[.,]\d+)?)\s*g/i);
  const fat = num(flat, /(?:total\s+)?fat\s*:?\s*(\d+(?:[.,]\d+)?)\s*g/i);
  const carbs = num(
    flat,
    /(?:total\s+)?(?:carbohydrate|carbohydrates|carbs?)\s*:?\s*(\d+(?:[.,]\d+)?)\s*g/i,
  );

  // Serving size: prefer the amount in parentheses "(43g)" / "(240 ml)" that
  // most labels give after the household measure.
  let servingSize: number | undefined;
  let servingUnit: string | undefined;
  const parenMatch = flat.match(/serving size[^(]*\((\d+(?:[.,]\d+)?)\s*(g|ml|mg)\)/i);
  const bareMatch = flat.match(/serving size\s*:?\s*(\d+(?:[.,]\d+)?)\s*(g|ml|oz)/i);
  const src = parenMatch ?? bareMatch;
  if (src) {
    const n = parseFloat(src[1].replace(',', '.'));
    if (Number.isFinite(n) && n > 0) {
      servingSize = n;
      servingUnit = src[2].toLowerCase();
    }
  }

  return { calories, protein, carbs, fat, servingSize, servingUnit };
}

/** Parse a number that may use a comma as either a thousands or decimal mark. */
function parseLoose(raw: string): number {
  // "1,850" (comma + exactly 3 digits) is a thousands separator; strip it.
  // "18,9" (European decimal) becomes a dot.
  const s = /,\d{3}(?:\D|$)/.test(raw + ' ') ? raw.replace(/,/g, '') : raw.replace(',', '.');
  return parseFloat(s);
}

/**
 * Number after a keyword, tolerating an intervening "%"/":" and OCR noise. Also
 * accepts "lb" commonly misread by OCR as "Ib" / "1b".
 */
function labelledNum(text: string, keyword: RegExp): { value: number; unit?: string } | undefined {
  const re = new RegExp(
    keyword.source + String.raw`[^0-9]{0,12}(\d{1,4}(?:[.,]\d+)?)\s*(kg|lbs|lb|ib|1b|%|kcal|cal)?`,
    'i',
  );
  const m = text.match(re);
  if (!m) return undefined;
  const value = parseLoose(m[1]);
  if (!Number.isFinite(value)) return undefined;
  let unit = m[2]?.toLowerCase();
  if (unit === 'ib' || unit === '1b') unit = 'lb'; // OCR misreads of "lb"
  return { value, unit };
}

/**
 * Parse an Evolt 360 result sheet into structured values. Best-effort: the sheet
 * is dense, so this reads whatever labels OCR recovered and leaves the rest for
 * manual entry. Values are returned as printed (the sheet doesn't tag units per
 * value); the form treats them as display-unit numbers.
 */
export function parseEvoltScan(text: string): ParsedBodyScan {
  const flat = text.replace(/\s+/g, ' ');
  const out: ParsedBodyScan = {};

  // Simple labelled fields: keyword -> first number after it.
  const grab = (kw: RegExp) => labelledNum(flat, kw)?.value;
  const inRange = (v: number | undefined, lo: number, hi: number) =>
    v != null && v >= lo && v <= hi ? v : undefined;

  out.weightKg = grab(/\bweight\b/) ?? grab(/body\s*weight/);
  out.leanBodyMassKg = grab(/lean\s*body\s*mass/);
  out.muscleMassKg = grab(/skeletal\s*muscle\s*mass/) ?? grab(/muscle\s*mass/);
  // Composition protein is a small mass (~<100); nutrition protein is grams and
  // comes later — keep only the small one here.
  out.proteinKg = inRange(grab(/\bprotein\b/), 0, 100);
  out.mineralKg = grab(/\bmineral\b/);
  out.totalBodyWaterKg = grab(/total\s*body\s*water/);
  out.bodyFatMassKg = grab(/body\s*fat\s*mass/);
  out.subcutaneousFatMassKg = grab(/subcutaneous\s*fat\s*mass/);
  out.visceralFatMassKg = grab(/visceral\s*fat\s*mass/);
  out.visceralFatAreaCm2 = grab(/visceral\s*fat\s*area/);
  out.bodyFatPct = inRange(grab(/total\s*body\s*fat\s*percentage/) ?? grab(/body\s*fat\s*percentage/), 1, 80);
  out.visceralFatLevel = inRange(grab(/visceral\s*fat\s*level/), 1, 60);
  out.icfKg = grab(/intracellular\s*fluid/) ?? grab(/\bicf\b/);
  out.ecfKg = grab(/extracellular\s*fluid/) ?? grab(/\becf\b/);
  out.bmr = inRange(grab(/\bbmr\b/) ?? grab(/basal\s*metabolic\s*rate/), 500, 5000);
  out.tee = inRange(grab(/\btee\b/) ?? grab(/total\s*energy\s*expenditure/), 800, 8000);
  out.bioAge = inRange(grab(/bio\s*age/), 5, 120);
  out.bwiScore = inRange(grab(/bwi/), 0, 10);
  out.abdominalCircumferenceCm = grab(/abdominal\s*circumference/);
  out.waistToHipRatio = inRange(grab(/waist\s*to\s*hip\s*ratio/) ?? grab(/waist.?hip/), 0.4, 1.5);

  // Evolt nutrition recommendation: "CALORIES 3527 - 3627", "PROTEIN 265g - 272g".
  const cal = flat.match(/calories[^0-9]{0,10}(\d{3,5})\s*[-–]\s*(\d{3,5})/i);
  if (cal) { out.recCaloriesLow = parseInt(cal[1], 10); out.recCaloriesHigh = parseInt(cal[2], 10); }
  const macroG = (kw: RegExp): number | undefined => {
    const m = flat.match(new RegExp(kw.source + String.raw`[^0-9]{0,10}(\d{2,4})\s*g`, 'i'));
    return m ? parseInt(m[1], 10) : undefined;
  };
  // The "…g" suffix distinguishes the grams recommendation from the composition
  // masses (which have no trailing g).
  out.recProteinG = macroG(/\bprotein\b/);
  out.recCarbsG = macroG(/carbohydrate?s?/) ?? macroG(/\bcarbs?\b/);
  out.recFatG = macroG(/\bfat\b/);

  // Drop undefineds so the caller only sees fields we actually read.
  (Object.keys(out) as (keyof ParsedBodyScan)[]).forEach((k) => { if (out[k] == null) delete out[k]; });
  return out;
}
