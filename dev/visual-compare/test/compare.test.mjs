import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareScreen, loadAccepted, unusedAccepted, exitCode } from '../lib/compare.mjs';

const box = (x, y, w, h, pad = 8) => ({
  found: true, x, y, w, h, padTop: pad, padRight: pad, padBottom: pad, padLeft: pad,
});

const run = (entries, proto, reskin, accepted = []) =>
  compareScreen({ screen: 'status', theme: 'light', entries, proto, reskin, accepted });

const byMetric = (findings, id) =>
  Object.fromEntries(findings.filter((f) => f.id === id).map((f) => [f.metric, f]));

test('fixed entry within tolerance passes every metric', () => {
  const entries = [{ id: 'a', proto: '.a', reskin: '.a', kind: 'fixed' }];
  const findings = run(entries, { a: box(0, 0, 100, 40, 8) }, { a: box(3, -3, 101, 41, 9) });
  assert.deepEqual(findings.map((f) => f.metric).sort(),
    ['h', 'padBottom', 'padLeft', 'padRight', 'padTop', 'w', 'x', 'y']);
  assert.ok(findings.every((f) => f.verdict === 'pass'));
});

test('fixed entry beyond tolerance fails', () => {
  const entries = [{ id: 'a', proto: '.a', reskin: '.a', kind: 'fixed' }];
  const m = byMetric(run(entries, { a: box(0, 0, 100, 40) }, { a: box(5, 0, 100, 40) }), 'a');
  assert.deepEqual(
    { delta: m.x.delta, tolerance: m.x.tolerance, verdict: m.x.verdict },
    { delta: 5, tolerance: 4, verdict: 'fail' },
  );
});

test('variable entry ignores height and later y', () => {
  const entries = [{ id: 'a', proto: '.a', reskin: '.a', kind: 'variable' }];
  const m = byMetric(run(entries, { a: box(0, 0, 500, 100) }, { a: box(0, 300, 500, 900) }), 'a');
  assert.equal(m.h, undefined);
  assert.equal(m.y, undefined);

  const first = [{ id: 'a', proto: '.a', reskin: '.a', kind: 'variable', firstVariable: true }];
  const m2 = byMetric(run(first, { a: box(0, 0, 500, 100) }, { a: box(0, 300, 500, 900) }), 'a');
  assert.equal(m2.y.verdict, 'fail');
  assert.equal(m2.h, undefined);
});

test('variable width uses 2% of 1024', () => {
  const entries = [{ id: 'a', proto: '.a', reskin: '.a', kind: 'variable' }];
  const pass = byMetric(run(entries, { a: box(0, 0, 500, 10) }, { a: box(0, 0, 520, 10) }), 'a');
  assert.equal(pass.w.verdict, 'pass');
  assert.equal(pass.w.tolerance, 20.48);
  const fail = byMetric(run(entries, { a: box(0, 0, 500, 10) }, { a: box(0, 0, 521, 10) }), 'a');
  assert.equal(fail.w.verdict, 'fail');
});

test('noPosition drops x and y but keeps the gap to after', () => {
  const entries = [
    { id: 'a', proto: '.a', reskin: '.a', kind: 'fixed', noPosition: true },
    { id: 'b', proto: '.b', reskin: '.b', kind: 'fixed', noPosition: true, after: { id: 'a', axis: 'y' } },
  ];
  const findings = run(entries,
    { a: box(0, 0, 500, 40), b: box(0, 56, 500, 40) },
    { a: box(300, 500, 500, 40), b: box(300, 556, 500, 40) });
  const metrics = findings.map((f) => f.metric);
  assert.ok(!metrics.includes('x'));
  assert.ok(!metrics.includes('y'));
  assert.equal(byMetric(findings, 'b').gap.verdict, 'pass');
});

test('gap measured along axis', () => {
  const entries = [
    { id: 'a', proto: '.a', reskin: '.a', kind: 'fixed' },
    { id: 'b', proto: '.b', reskin: '.b', kind: 'variable', after: { id: 'a', axis: 'y' } },
  ];
  const m = byMetric(run(entries,
    { a: box(0, 0, 100, 40), b: box(0, 56, 100, 10) },
    { a: box(0, 0, 100, 40), b: box(0, 61, 100, 10) }), 'b');
  assert.deepEqual(
    { proto: m.gap.proto, reskin: m.gap.reskin, verdict: m.gap.verdict },
    { proto: 16, reskin: 21, verdict: 'fail' },
  );
});

test('prototype miss is a map-miss', () => {
  const entries = [{ id: 'a', proto: '.a', reskin: '.a', kind: 'fixed' }];
  const findings = run(entries, { a: { found: false, reason: 'no-match' } }, { a: box(0, 0, 10, 10) })
    .filter((f) => f.id === 'a');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].verdict, 'map-miss');
});

test('reskin miss is missing-in-reskin', () => {
  const entries = [{ id: 'a', proto: '.a', reskin: '.a', kind: 'fixed' }];
  const findings = run(entries, { a: box(0, 0, 10, 10) }, { a: { found: false, reason: 'hidden' } })
    .filter((f) => f.id === 'a');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].verdict, 'missing-in-reskin');
  assert.equal(findings[0].reason, 'hidden');
});

test('reskin-only entry is informational', () => {
  const entries = [
    { id: 'a', proto: '.a', reskin: '.a', kind: 'fixed' },
    { id: 'b', proto: null, reskin: '.b', kind: 'variable' },
  ];
  const findings = run(entries, { a: box(0, 0, 10, 10) }, { a: box(0, 0, 10, 10), b: box(0, 0, 10, 10) });
  const b = findings.filter((f) => f.id === 'b');
  assert.equal(b.length, 1);
  assert.equal(b[0].verdict, 'reskin-only');
  assert.equal(exitCode(findings), 0);
});

test('accepted difference overrides fail', () => {
  const entries = [{ id: 'traffic.th3', proto: '.a', reskin: '.a', kind: 'fixed' }];
  const proto = { 'traffic.th3': box(0, 0, 100, 40) };
  const reskin = { 'traffic.th3': box(50, 0, 100, 40) };
  const go = (accepted) => byMetric(
    compareScreen({ screen: 'traffic', theme: 'dark', entries, proto, reskin, accepted }), 'traffic.th3');

  const exact = go([{ screen: 'traffic', id: 'traffic.th3', metric: 'x', theme: '*', reason: '§6.9.1' }]);
  assert.equal(exact.x.verdict, 'accepted');
  assert.equal(exact.x.reason, '§6.9.1');

  assert.equal(go([{ screen: 'traffic', id: 'traffic.th3', metric: '*', theme: '*', reason: 'r' }]).x.verdict, 'accepted');
  assert.equal(go([{ screen: 'traffic', id: '*', metric: 'x', theme: '*', reason: 'r' }]).x.verdict, 'accepted');
  assert.equal(go([{ screen: 'traffic', id: '*', metric: 'x', theme: 'light', reason: 'r' }]).x.verdict, 'fail');
});

test('accepted differences never hide a map-miss or an empty screen', () => {
  const entries = [{ id: 'a', proto: '.a', reskin: '.a', kind: 'fixed' }];
  const anyMetric = { screen: 'status', id: 'a', metric: '*', theme: '*', reason: 'r' };
  const screenWide = { screen: 'status', id: '*', metric: '*', theme: '*', reason: 'r' };
  const findings = run(entries, { a: { found: false, reason: 'no-match' } }, { a: box(0, 0, 10, 10) },
    [anyMetric, screenWide]);
  assert.deepEqual(findings.map((f) => f.verdict).sort(), ['empty-screen', 'map-miss']);
  assert.equal(exitCode(findings), 1);
});

test('loadAccepted rejects missing reason', () => {
  assert.throws(() => loadAccepted([{ screen: 's', id: 'a', metric: 'x', theme: '*' }]));
  assert.throws(() => loadAccepted([{ screen: 's', id: 'a', metric: 'x', theme: '*', reason: '  ' }]));
  assert.equal(loadAccepted([{ screen: 's', id: 'a', metric: 'x', theme: '*', reason: 'ok' }]).length, 1);
});

test('unusedAccepted reports entries that matched nothing', () => {
  const entries = [{ id: 'a', proto: '.a', reskin: '.a', kind: 'fixed' }];
  const used = { screen: 'status', id: 'a', metric: 'x', theme: '*', reason: 'used' };
  const typo = { screen: 'status', id: 'aa', metric: 'x', theme: '*', reason: 'typo' };
  const findings = run(entries, { a: box(0, 0, 10, 10) }, { a: box(9, 0, 10, 10) }, [used, typo]);
  assert.deepEqual(unusedAccepted([used, typo], findings), [typo]);
});

test('screen with no compared pairs is empty-screen', () => {
  const entries = [{ id: 'a', proto: '.a', reskin: '.a', kind: 'fixed' }];
  const findings = run(entries, { a: { found: false, reason: 'no-match' } }, { a: box(0, 0, 10, 10) });
  assert.equal(findings.filter((f) => f.verdict === 'empty-screen').length, 1);
  assert.equal(exitCode(findings), 1);

  const none = run([], {}, {});
  assert.equal(none.filter((f) => f.verdict === 'empty-screen').length, 1);
});
