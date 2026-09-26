export const MONKEY_IDENTITIES = Object.freeze([
  { id:'orangutan', name:'Orangutan', emoji:'🦧', note:'Calm, clever and curious' },
  { id:'gorilla', name:'Gorilla', emoji:'🦍', note:'Strong and steady' },
  { id:'king-kong', name:'King Kong', emoji:'👑', note:'Legendary jungle energy' },
  { id:'chimpanzee', name:'Chimpanzee', emoji:'🐵', note:'Quick-thinking problem solver' },
  { id:'bonobo', name:'Bonobo', emoji:'🐒', note:'Social and peaceful' },
  { id:'gibbon', name:'Gibbon', emoji:'🌿', note:'Fast through the treetops' },
  { id:'mandrill', name:'Mandrill', emoji:'🎨', note:'Bold and colourful' },
  { id:'macaque', name:'Macaque', emoji:'⛰️', note:'Adaptable explorer' },
  { id:'capuchin', name:'Capuchin', emoji:'🧠', note:'Small but seriously clever' },
  { id:'tamarin', name:'Tamarin', emoji:'✨', note:'Tiny and energetic' },
  { id:'howler-monkey', name:'Howler Monkey', emoji:'📣', note:'Big voice, big personality' },
  { id:'spider-monkey', name:'Spider Monkey', emoji:'🕸️', note:'Agile and adventurous' },
  { id:'squirrel-monkey', name:'Squirrel Monkey', emoji:'⚡', note:'Fast and curious' },
  { id:'proboscis-monkey', name:'Proboscis Monkey', emoji:'🌊', note:'Excellent swimmer' },
  { id:'golden-langur', name:'Golden Langur', emoji:'🌟', note:'Rare golden explorer' },
  { id:'silverback', name:'Silverback', emoji:'🛡️', note:'Powerful and protective' },
  { id:'baboon', name:'Baboon', emoji:'🏜️', note:'Confident troop member' },
  { id:'marmoset', name:'Marmoset', emoji:'🍃', note:'Tiny treetop adventurer' },
]);

export const MONKEY_IDENTITY_NAMES = Object.freeze(MONKEY_IDENTITIES.map(item => item.name));

export function normalizeMonkeyIdentity(value = '') {
  const wanted = String(value).trim().toLowerCase();
  return MONKEY_IDENTITIES.find(item => item.name.toLowerCase() === wanted || item.id === wanted) || null;
}

export function hasAnonymousMonkeyIdentity(student = {}) {
  return !!normalizeMonkeyIdentity(student.anonymousMonkeyName || student.anonymousMonkeyId);
}

export function getAnonymousMonkeyIdentity(student = {}) {
  return normalizeMonkeyIdentity(student.anonymousMonkeyName || student.anonymousMonkeyId);
}

export function getAnonymousDisplayName(student = {}) {
  return getAnonymousMonkeyIdentity(student)?.name || 'Mystery Monkey';
}

export function getAnonymousDisplayEmoji(student = {}) {
  return getAnonymousMonkeyIdentity(student)?.emoji || '🐒';
}
