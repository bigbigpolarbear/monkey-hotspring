export const SITTER_TITLES = [
  '🍌 Snack Specialist',
  '🫧 Hot Spring Helper',
  '❤️ Pet Pal',
  '🌙 Sleepover Expert',
  '🎓 Homework Monkey',
  '🧹 Tidy Monkey',
  '🌸 Gentle Carer',
];

export const SITTER_PRICE_BANDS = [5, 6, 7, 8, 9, 10];

export function sitterLevel(completedJobs = 0) {
  const jobs = Math.max(0, Number(completedJobs) || 0);
  return Math.min(10, 1 + Math.floor(jobs / 5));
}

export function sitterCapacity(completedJobs = 0) {
  const level = sitterLevel(completedJobs);
  if (level >= 10) return 3;
  if (level >= 5) return 2;
  return 1;
}

export function clampSitterPrice(price, completedJobs = 0) {
  const level = sitterLevel(completedJobs);
  const max = level >= 8 ? 10 : level >= 4 ? 8 : 6;
  const numeric = Math.round(Number(price) || 5);
  return Math.max(5, Math.min(max, numeric));
}

export function splitSitterPayment(price) {
  const charged = Math.max(5, Math.round(Number(price) || 5));
  const sink = Math.max(1, Math.round(charged * 0.25));
  return { charged, sitterEarns: charged - sink, sink };
}

export function ratingAverage(profile = {}) {
  const count = Math.max(0, Number(profile.ratingCount) || 0);
  if (!count) return null;
  return Math.round((Number(profile.ratingTotal || 0) / count) * 10) / 10;
}

export const SITTER_COMPLIMENTS = [
  'Great sitter!',
  'Pets were happy',
  'Would hire again',
  'Great with food',
  'Very reliable',
];
