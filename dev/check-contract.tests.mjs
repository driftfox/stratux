// Unit tests for the contract checker's exported primitives.
//
// This repo has no test framework, no package.json and no build step (see
// AGENTS.md — the absence is deliberate), so the tests are a plain Node script
// using node:assert. An unmet assertion throws and Node exits non-zero; that is
// the failure signal. Run with:
//
//   node dev/check-contract.tests.mjs
//
// Only the three exported helpers are covered here. The full contract run is
// exercised by running the checker itself against the tree.
import assert from 'node:assert';
import { missingFrom, cssBannedHits, appcacheMissing } from './check-contract.mjs';

// missingFrom returns the subset of `required` absent from `text`.
assert.deepEqual(missingFrom('<div ng-model="DarkMode">', ['DarkMode']), []);
assert.deepEqual(missingFrom('<div>', ['DarkMode']), ['DarkMode']);
assert.deepEqual(missingFrom('abc', ['ab', 'zz', 'c']), ['zz']);

// §5.1.2 / R1: `gap` is banned in a flex container, permitted in a grid.
assert.equal(cssBannedHits('a{display:flex;gap:8px}').length, 1);
assert.equal(cssBannedHits('a{display:inline-flex;gap:8px}').length, 1);
assert.equal(cssBannedHits('a{display:-webkit-box;display:flex;gap:8px}').length, 1);
assert.equal(cssBannedHits('a{display:grid;gap:8px}').length, 0);
assert.equal(cssBannedHits('a{display:flex;margin:8px}').length, 0);
assert.equal(cssBannedHits('a{margin:8px}').length, 0);

// Other §5.1.2 browser-floor bans.
assert.equal(cssBannedHits('a{position:sticky;top:0}').length, 1);
assert.equal(cssBannedHits('a:has(> b){color:red}').length, 1);
assert.equal(cssBannedHits('a{aspect-ratio:1}').length, 1);
assert.equal(cssBannedHits('a{backdrop-filter:blur(2px)}').length, 1);
assert.equal(cssBannedHits('@container (min-width:1px){a{color:red}}').length, 1);
assert.equal(cssBannedHits('a{place-items:center}').length, 1);
assert.equal(cssBannedHits('a{color-scheme:dark}').length, 1);
assert.equal(cssBannedHits('a{width:min(340px,90vw)}').length, 1);

// R9: the ban is on fetching a network font, so only an absolute http(s)
// @font-face src is a hit. The bundled FontAwesome face must pass.
assert.equal(cssBannedHits("@font-face{src:url('https://x/y.woff')}").length, 1);
assert.equal(
  cssBannedHits("@font-face{src:url('../maui/fonts/fontawesome-webfont.woff')}").length,
  0,
);
assert.equal(cssBannedHits('a{color:red}').length, 0);

// appcacheMissing compares manifest entries (relative to web/, often written
// with a leading slash) with on-disk paths (repo-relative, web/...). The two
// spellings of the same file are equal; a genuine gap is reported verbatim.
assert.deepEqual(appcacheMissing(['a.css'], ['a.css']), []);
assert.deepEqual(appcacheMissing(['web/css/main.css'], ['/css/main.css']), []);
assert.deepEqual(appcacheMissing(['web/css/main.css'], ['css/main.css']), []);
assert.deepEqual(appcacheMissing(['./web/css/main.css'], ['/css/main.css']), []);
assert.deepEqual(appcacheMissing(['web/css/x.css'], ['/css/y.css']), ['web/css/x.css']);

console.log('check-contract primitives: all assertions passed');
