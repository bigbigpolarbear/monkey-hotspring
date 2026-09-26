export const MONA_BIRTHDAY = Object.freeze({
  campaignId: 'mona-birthday-2026',
  tapsToOpen: 8,
});

export function isMonaStudent(student = {}) {
  const displayName = String(student?.name || '').trim().toLowerCase();
  const username = String(student?.username || '').trim().toLowerCase();
  const firstName = displayName.split(/\s+/)[0] || '';
  return firstName === 'mona' || username === 'mona';
}

export function hasClaimedMonaBirthday(student = {}) {
  return student?.specialRewards?.monaBirthday2026Claimed === true;
}
