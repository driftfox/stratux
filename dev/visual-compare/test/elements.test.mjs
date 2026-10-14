import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ELEMENTS } from '../elements.mjs';
import { SCREENS, SHELL_STATES } from '../lib/apps.mjs';
import { loadAccepted } from '../lib/compare.mjs';

const ACCEPTED = JSON.parse(fs.readFileSync(new URL('../accepted-differences.json', import.meta.url), 'utf8'));
const isPanel = (sel) => typeof sel === 'string' && sel.startsWith('panel:');

test('every screen and shell state has entries', () => {
  const want = [...SCREENS.map((s) => s.key), ...SHELL_STATES.map((s) => `shell:${s}`)].sort();
  assert.deepEqual(Object.keys(ELEMENTS).sort(), want);
  for (const [key, entries] of Object.entries(ELEMENTS)) {
    assert.ok(entries.length > 0, `${key} has no entries`);
  }
});

test('ids are unique and prefixed', () => {
  const seen = new Set();
  for (const [key, entries] of Object.entries(ELEMENTS)) {
    const prefix = key.startsWith('shell:') ? 'shell.' : `${key}.`;
    for (const { id } of entries) {
      assert.ok(id.startsWith(prefix), `${id} should start with ${prefix}`);
      assert.ok(!seen.has(id), `duplicate id ${id}`);
      seen.add(id);
    }
  }
});

test('after references an earlier entry on the same screen', () => {
  for (const [key, entries] of Object.entries(ELEMENTS)) {
    entries.forEach((e, i) => {
      if (!e.after) return;
      const earlier = entries.slice(0, i).map((x) => x.id);
      assert.ok(earlier.includes(e.after.id), `${key}: ${e.id} after ${e.after.id}`);
      assert.ok(['x', 'y'].includes(e.after.axis), `${key}: ${e.id} axis ${e.after.axis}`);
    });
  }
});

test('settings and status panels carry noPosition', () => {
  for (const key of ['settings', 'status']) {
    for (const e of ELEMENTS[key]) {
      if (!isPanel(e.proto) && !isPanel(e.reskin)) continue;
      assert.equal(e.noPosition, true, `${e.id} lacks noPosition`);
      if (e.kind === 'variable') assert.equal(e.after, undefined, `${e.id}: reordered panels have no gap to compare`);
    }
  }
});

test('exactly one firstVariable per screen that has variable entries', () => {
  for (const [key, entries] of Object.entries(ELEMENTS)) {
    const variable = entries.filter((e) => e.kind === 'variable');
    if (!variable.length) continue;
    const first = variable.filter((e) => e.firstVariable);
    assert.equal(first.length, 1, `${key} has ${first.length} firstVariable entries`);
    assert.equal(first[0], variable.find((e) => e.proto !== null), `${key}: firstVariable is not the first compared panel`);
  }
});

test('accepted differences load and name mapped ids', () => {
  const accepted = loadAccepted(ACCEPTED);
  assert.ok(accepted.length > 0);
  for (const a of accepted) {
    assert.ok(ELEMENTS[a.screen], `unknown screen ${a.screen}`);
    if (a.id === '*') continue;
    assert.ok(ELEMENTS[a.screen].some((e) => e.id === a.id), `${a.screen}: ${a.id} is not mapped`);
  }
});
