import test from 'node:test';
import assert from 'node:assert/strict';
import { clickLegacyAction } from '../services/legacyNavigation.js';

function fakeButton(text, { visible = true, title = '' } = {}) {
  const button = { textContent: text, offsetParent: visible ? {} : null, clicks: 0 };
  button.getAttribute = key => key === 'title' ? title : null;
  button.click = () => { button.clicks += 1; };
  return button;
}

function fakeRoot(...buttons) {
  return { querySelectorAll: selector => selector === 'button' ? buttons : [] };
}

test('Pet Shop can open its hidden legacy Pet Packs trigger', () => {
  const unrelated = fakeButton('Food');
  const petPacks = fakeButton('🎁 Pet Packs', { visible: false });
  assert.equal(clickLegacyAction('Pet Packs', fakeRoot(unrelated, petPacks)), true);
  assert.equal(petPacks.clicks, 1);
  assert.equal(unrelated.clicks, 0);
});

test('visible actions take priority over hidden legacy actions', () => {
  const old = fakeButton('World View', { visible: false });
  const current = fakeButton('World View');
  assert.equal(clickLegacyAction('World View', fakeRoot(old, current)), true);
  assert.equal(current.clicks, 1);
  assert.equal(old.clicks, 0);
});

test('missing legacy action reports failure without clicking anything', () => {
  const button = fakeButton('Missions');
  assert.equal(clickLegacyAction('Pet Packs', fakeRoot(button)), false);
  assert.equal(button.clicks, 0);
});
