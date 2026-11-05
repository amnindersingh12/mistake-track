// src/utils/normalizeOptions.ts
const DEVANAGARI = /[\u0900-\u097F]/;
const LABEL = /^\(?([A-Ea-e]|[1-5])[\).:\-]\s+/;

export function normalizeOptions(raw: string[]): { options: string[]; needsReview: boolean; reason?: string } {
  let cleaned = (raw || [])
    .map((o) => (o || '').normalize('NFKC').replace(/\s+/g, ' ').trim().replace(LABEL, '').trim())
    .filter(Boolean);

  // If English and Hindi are mixed, keep the English set
  const english = cleaned.filter((o) => !DEVANAGARI.test(o));
  if (english.length >= 2 && english.length < cleaned.length) cleaned = english;

  // Dedupe by normalized text, preserving order
  const seen = new Set<string>();
  const options = cleaned.filter((o) => {
    const key = o.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (options.length < 2 || options.length > 5) {
    return { options, needsReview: true, reason: `${options.length} options found, expected 2 to 5` };
  }
  return { options, needsReview: false };
}

export interface NormalizedOptionItem {
  index: number;
  label: string;
  text: string;
  isCorrect?: boolean;
  isSelected?: boolean;
}

export function normalizeOptionObjects(
  rawOptions: Array<{ text: string; isCorrect?: boolean; isSelected?: boolean }>
): {
  options: NormalizedOptionItem[];
  needsReview: boolean;
  reason?: string;
} {
  const rawTexts = (rawOptions || []).map((o) => o?.text || '');
  const result = normalizeOptions(rawTexts);

  // Map back correctness and selection to remaining normalized options
  const mappedOptions: NormalizedOptionItem[] = result.options.map((optText, idx) => {
    const origMatch = (rawOptions || []).find((orig) => {
      const cleanedOrig = (orig?.text || '').normalize('NFKC').replace(/\s+/g, ' ').trim().replace(LABEL, '').trim().toLowerCase();
      return cleanedOrig === optText.toLowerCase();
    });

    return {
      index: idx,
      label: String.fromCharCode(65 + idx),
      text: optText,
      isCorrect: origMatch?.isCorrect,
      isSelected: origMatch?.isSelected
    };
  });

  return {
    options: mappedOptions,
    needsReview: result.needsReview,
    reason: result.reason
  };
}

