// The redesigned student header hides LegacyApp's original top navigation.
// Its buttons remain mounted so their existing actions can be reused safely.
export function clickLegacyAction(label, root = document) {
  // Open the classroom explicitly; never match the new header's own button.
  if (label === 'Hotspring' || label === 'World View') {
    const classroomButton = root.querySelector('button[title="Switch to Classroom view"]');
    if (classroomButton) {
      classroomButton.click();
      return true;
    }
    // Already showing the classroom: do not toggle back to the personal pool.
    return !!root.querySelector('button[title="Back to My Hot Spring"]');
  }
  const needle = String(label).toLowerCase();
  const buttons = [...root.querySelectorAll('button')];
  const visible = buttons.filter(btn => btn.offsetParent !== null);
  const find = list => list.find(btn => (btn.getAttribute('title') || '').toLowerCase().includes(needle))
    || list.find(btn => (btn.textContent || '').trim().toLowerCase().includes(needle));
  const target = find(visible) || find(buttons);
  if (!target) return false;
  target.click();
  return true;
}
