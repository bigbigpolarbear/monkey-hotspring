const FOOD_PRICES = {
  yakult: [12, 2], gummybears: [15, 3], crackers: [10, 2], milk: [18, 3],
  onigiri: [22, 4], pocky: [20, 3], boba: [28, 4], mamacup: [35, 5],
  takoyaki: [45, 5], donburi: [55, 5], icecreambowl: [50, 8], ramen: [70, 6],
  sushiroll: [75, 6], matchaset: [90, 8], mochi: [95, 8], katsu: [110, 6],
  strawberry: [130, 10], wagyu: [180, 12], omakase: [250, 14], rainbowcake: [300, 16],
};

function replaceOnce(source, pattern, replacement, label) {
  const matches = source.match(pattern);
  if (!matches) throw new Error(`[legacy-patches] Could not find ${label}`);
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`[legacy-patches] ${label} did not change source`);
  return next;
}

export function patchLegacyApp(source) {
  let next = source;
  for (const [id, [oldPrice, newPrice]] of Object.entries(FOOD_PRICES)) {
    const pattern = new RegExp(`(\\{\\s*id:\\s*"${id}"[\\s\\S]{0,150}?price:\\s*)${oldPrice}(?=\\s*[,}])`);
    next = replaceOnce(next, pattern, `$1${newPrice}`, `food price: ${id}`);
  }
  next = replaceOnce(next, /\/\/ Left sidebar collapse — persisted so the student's choice sticks across sessions\.[\s\S]*?const toggleSidebar = \(\) => \{[\s\S]*?\n  \};/, `// Student navigation is a transient drawer now. It always starts closed and is never persisted.\n  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);\n  const toggleSidebar = () => {\n    setSidebarCollapsed(prev => !prev);\n    SFX.click();\n  };`, 'student sidebar persistence block');
  next = replaceOnce(next, /const monkeyInJail = me\?\.jail\?\.active === true;\s*return \(\s*<div style=\{\{ minHeight:/, 'const monkeyInJail = false;\n      return (\n        <div data-monkey-student-id={me.id} data-monkey-student-name={me.name || ""} style={{ minHeight:', 'student root marker');
  next = replaceOnce(next, /(\{\/\* ─── TOP BAR \(redesigned\)[\s\S]{0,650}?\*\/\}\s*)<div style=\{\{/, '$1<div data-monkey-legacy-topbar style={{', 'legacy student top bar marker');
  next = replaceOnce(next, /(\{\/\* ── DASHBOARD LAYOUT ──[\s\S]{0,520}?\*\/\}\s*)<div style=\{\{/, '$1<div data-monkey-dashboard-layout style={{', 'student dashboard layout marker');
  next = replaceOnce(next, /(\{\/\* ─── STATUS STRIP \(under top bar\)[\s\S]{0,420}?\*\/\}\s*\{\(!monkeyInJail[\s\S]{0,180}?)<div style=\{\{/, '$1<div data-monkey-legacy-status-strip style={{', 'legacy daily status strip marker');
  next = replaceOnce(next, /(\{\/\* Equipped Pet \+ Income Section \*\/\}\s*)\{equippedPet && \(/, '$1{false && equippedPet && (', 'legacy weekly pet payout section');
  next = replaceOnce(next, /(\{\/\* MONKEY JAIL MODAL[\s\S]{0,180}?\*\/\}\s*)\{showJailModal && me\?\.jail\?\.active && \(/, '$1{false && showJailModal && me?.jail?.active && (', 'legacy jail modal');
  next = replaceOnce(next, /function shouldBeInJail\(student\) \{[\s\S]*?\n\}/, `function shouldBeInJail() {\n  // Missing days are handled by the 7-day passive-income cap. No guilt or punitive jail.\n  return false;\n}`, 'punitive jail trigger');
  next = next.replace('const jailMul = student.jail?.active ? 0.1 : 1.0;', 'const jailMul = 1.0;');
  next = next.replace("🎉 Challenge complete! Your pets are awake — go collect today's stars.", '🎉 Challenge complete! Your bonus Stars are ready.');
  return next;
}

export function legacyPatchesPlugin() {
  return { name: 'monkey-hotspring-legacy-patches', enforce: 'pre', transform(code, id) { if (!id.replaceAll('\\\\', '/').endsWith('/legacy/AppLegacy.jsx')) return null; return { code: patchLegacyApp(code), map: null }; } };
}
