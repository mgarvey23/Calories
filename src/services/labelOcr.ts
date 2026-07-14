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

/** What we could pull off an Evolt body-scan sheet. Masses are in kilograms. */
export interface ParsedBodyScan {
  weightKg?: number;
  bodyFatPct?: number;
  muscleMassKg?: number;
  bmr?: number;
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

/** Round to one decimal place. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
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
 * Parse an Evolt 360 result sheet into structured body-composition values.
 * Masses are normalised to kilograms (a value tagged "lb" is converted).
 * Everything is optional — OCR on a photographed sheet is imperfect.
 */
export function parseEvoltScan(text: string): ParsedBodyScan {
  const flat = text.replace(/\s+/g, ' ');
  const toKg = (v: number, unit?: string) => (unit === 'lb' || unit === 'lbs' ? v / 2.20462 : v);

  let weightKg: number | undefined;
  const w = labelledNum(flat, /\bweight\b/) ?? labelledNum(flat, /body\s*weight/);
  if (w) weightKg = round1(toKg(w.value, w.unit));

  let bodyFatPct: number | undefined;
  const bf = labelledNum(flat, /body\s*fat(?:\s*percentage)?/) ?? labelledNum(flat, /\bfat\s*%/);
  if (bf && bf.value > 0 && bf.value < 80) bodyFatPct = bf.value;

  let muscleMassKg: number | undefined;
  const mm = labelledNum(flat, /skeletal\s*muscle\s*mass/) ?? labelledNum(flat, /muscle\s*mass/);
  if (mm) muscleMassKg = round1(toKg(mm.value, mm.unit));

  let bmr: number | undefined;
  const b = labelledNum(flat, /\bbmr\b/) ?? labelledNum(flat, /basal\s*metabolic\s*rate/);
  if (b && b.value >= 500 && b.value <= 5000) bmr = Math.round(b.value);

  return { weightKg, bodyFatPct, muscleMassKg, bmr };
}
