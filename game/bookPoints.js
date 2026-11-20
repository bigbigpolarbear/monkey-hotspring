export const WORDS_PER_POINT = 750;

export function calculateBookPoints(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const words = Number(value);
  if (!Number.isSafeInteger(words) || words < 0) return null;
  return Math.floor(words / WORDS_PER_POINT);
}
