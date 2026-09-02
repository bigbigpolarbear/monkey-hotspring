export const INCOME_CAP_DAYS = 7;

export const PET_EARNINGS = {
  fish: { name: 'Crystal Goldie', rarity: 'common', daily: 3 },
  duck: { name: 'Splash Sprout', rarity: 'common', daily: 3 },
  turtle: { name: 'Mossback Sage', rarity: 'uncommon', daily: 4 },
  bunny: { name: 'Frostpaw', rarity: 'uncommon', daily: 4 },
  fox: { name: 'Aurora Fox', rarity: 'rare', daily: 6 },
  otter: { name: 'River Spirit', rarity: 'rare', daily: 6 },
  owl: { name: 'Moonlit Sentinel', rarity: 'epic', daily: 8 },
  panda: { name: 'Bamboo Guardian', rarity: 'legendary', daily: 11 },
  dragon: { name: 'Ember Wyrmling', rarity: 'mythic', daily: 14 },
  towel_pup: { name: 'Towel Pup', rarity: 'common', daily: 3 },
  mist_bunny: { name: 'Mist Bunny', rarity: 'uncommon', daily: 4 },
  boba_foxlet: { name: 'Boba Foxlet', rarity: 'uncommon', daily: 4 },
  royal_jelly_deer: { name: 'Royal Jelly Deer', rarity: 'epic', daily: 8 },
  aurora_fawn: { name: 'Aurora Fawn', rarity: 'rare', daily: 6 },
  halo_ram: { name: 'Winter Halo Ram', rarity: 'legendary', daily: 11 },
  disco_corgi: { name: 'Disco Corgi', rarity: 'rare', daily: 6 },
  starlace_unicorn: { name: 'Starlace Unicorn Bun', rarity: 'legendary', daily: 11 },
  chronowl: { name: 'Chronowl', rarity: 'legendary', daily: 11 },
  moon_spirit: { name: 'The Bathing Moon Spirit', rarity: 'mythic', daily: 14 },
};

export function localDayKey(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return localDayKey(new Date());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function daysBetweenKeys(fromKey, toKey) {
  if (!fromKey || !toKey) return 0;
  const a = new Date(`${fromKey}T12:00:00`);
  const b = new Date(`${toKey}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

export function getPetCounts(student = {}) {
  const counts = { ...(student.petCounts || {}) };
  if (student.pet && !counts[student.pet]) counts[student.pet] = 1;
  for (const id of student.ownedPets || []) {
    if (!counts[id]) counts[id] = 1;
  }
  return counts;
}

export function getCareSummary(student = {}) {
  const source = student.petCare || {};
  let hunger = Number(source.hunger ?? 80);
  let happiness = Number(source.happiness ?? 80);
  hunger = Number.isFinite(hunger) ? Math.max(0, Math.min(100, hunger)) : 80;
  happiness = Number.isFinite(happiness) ? Math.max(0, Math.min(100, happiness)) : 80;
  const average = Math.round((hunger + happiness) / 2);
  if (average >= 85) return { average, multiplier: 1.3, label: 'Very Happy', emoji: '😊', bonusLabel: '+30%' };
  if (average >= 65) return { average, multiplier: 1.15, label: 'Happy', emoji: '🙂', bonusLabel: '+15%' };
  if (average >= 40) return { average, multiplier: 1, label: 'Content', emoji: '😌', bonusLabel: 'Normal' };
  return { average, multiplier: 0.8, label: 'Needs some attention', emoji: '😴', bonusLabel: '80%' };
}

function nicknameFor(student, petId) {
  return student?.petNicknames?.[petId] || PET_EARNINGS[petId]?.name || petId.replaceAll('_', ' ');
}

export function estimateOneDay(student = {}) {
  const care = getCareSummary(student);
  const petCounts = getPetCounts(student);
  const breakdown = [];
  let total = 0;
  Object.entries(petCounts).forEach(([petId, rawCount]) => {
    const count = Math.max(0, Math.floor(Number(rawCount) || 0));
    if (!count) return;
    const info = PET_EARNINGS[petId] || { rarity: 'common', daily: 3 };
    const perPet = Math.max(1, Math.round(info.daily * care.multiplier));
    const contribution = perPet * count;
    total += contribution;
    breakdown.push({
      petId,
      name: nicknameFor(student, petId),
      rarity: info.rarity,
      count,
      perPet,
      contribution,
    });
  });
  return { total, breakdown, care };
}

export function resolveLastPassiveDay(student = {}, todayKey = localDayKey()) {
  const saved = student.dailyEconomy?.lastPassiveCollectionDate;
  if (saved) return saved;
  const legacyCollected = student.dailyChallenge?.collectedAt;
  if (legacyCollected) return localDayKey(legacyCollected);
  if (student.lastActiveDay) return student.lastActiveDay;
  return null;
}

export function buildPendingPassiveIncome(student = {}, todayKey = localDayKey()) {
  const oneDay = estimateOneDay(student);
  if (oneDay.total <= 0) return { ...oneDay, total: 0, days: 0, capped: false, todayKey };
  const lastDay = resolveLastPassiveDay(student, todayKey);
  const elapsed = lastDay ? daysBetweenKeys(lastDay, todayKey) : 1;
  const alreadyCollectedToday = student.dailyEconomy?.lastPassiveCollectionDate === todayKey;
  const days = alreadyCollectedToday ? 0 : Math.max(1, Math.min(INCOME_CAP_DAYS, elapsed || 1));
  const breakdown = oneDay.breakdown.map(item => ({ ...item, contribution: item.contribution * days }));
  return {
    total: oneDay.total * days,
    perDay: oneDay.total,
    breakdown,
    care: oneDay.care,
    days,
    capped: elapsed > INCOME_CAP_DAYS,
    todayKey,
  };
}

export function getChallengeBonus(student = {}, todayKey = localDayKey()) {
  const daily = student.dailyChallenge || {};
  const completed = daily.date === todayKey && daily.completed === true;
  const collected = student.dailyEconomy?.challengeBonusCollectedDate === todayKey;
  const base = estimateOneDay(student).total;
  const amount = Math.min(30, Math.max(8, Math.round(base * 0.5)));
  return { completed, collected, available: completed && !collected, amount };
}
