// Reads a Nutrition Facts label from a photo using in-browser OCR (Tesseract),
// then parses the recognised text into the fields the manual-entry form needs:
// serving size, calories, and the protein/carbs/fat macros.
//
// Tesseract is heavy (it downloads a language model on first use), so it is
// imported lazily — only when the user actually scans a label — to keep it out
// of the initial bundle.

/** What we could pull off a label. Every field is optional — OCR is fuzzy. */
export interface ParsedLabel {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  servingSize?: number;
  servingUnit?: string;
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
