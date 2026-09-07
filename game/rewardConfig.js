export const REWARD_CONFIG = Object.freeze({
  dailyChallenge: 8,
  dailyVocab: 3,
  preIGCSE: 10,
  reading: Object.freeze({
    minPages: 5,
    pagesPerStar: 5,
    maxPagesPerSession: 150,
    maxStarsPerDay: 10,
  }),
});

export function normalizeBookTitle(value = '') {
  return String(value).trim().replace(/\s+/g, ' ').slice(0, 80);
}

export function calculateReadingReward({ startPage, endPage, alreadyEarnedToday = 0 } = {}) {
  const start = Math.floor(Number(startPage));
  const end = Math.floor(Number(endPage));
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
    return { valid: false, reason: 'Enter a finishing page higher than the starting page.', pages: 0, stars: 0 };
  }

  const pages = end - start;
  if (pages < REWARD_CONFIG.reading.minPages) {
    return { valid: false, reason: `Read at least ${REWARD_CONFIG.reading.minPages} pages before logging a session.`, pages, stars: 0 };
  }
  if (pages > REWARD_CONFIG.reading.maxPagesPerSession) {
    return { valid: false, reason: `A single reading session can log up to ${REWARD_CONFIG.reading.maxPagesPerSession} pages.`, pages, stars: 0 };
  }

  const rawStars = Math.max(1, Math.floor(pages / REWARD_CONFIG.reading.pagesPerStar));
  const remainingToday = Math.max(0, REWARD_CONFIG.reading.maxStarsPerDay - Math.max(0, Number(alreadyEarnedToday) || 0));
  const stars = Math.min(rawStars, remainingToday);
  return {
    valid: stars > 0,
    reason: stars > 0 ? '' : 'You reached today’s reading-star limit. You can still keep reading and log more tomorrow.',
    pages,
    stars,
    remainingToday,
  };
}

export function buildReadingDedupeId({ studentId, dateKey, bookTitle, startPage, endPage }) {
  const title = normalizeBookTitle(bookTitle).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'book';
  return `reading:${studentId}:${dateKey}:${title}:${Math.floor(Number(startPage))}-${Math.floor(Number(endPage))}`;
}
