// Unit tests for the contract checker's exported primitives.
//
// This repo has no test framework, no package.json and no build step (see
// AGENTS.md — the absence is deliberate), so the tests are a plain Node script
// using node:assert. An unmet assertion throws and Node exits non-zero; that is
// the failure signal. Run with:
//
//   node dev/check-contract.tests.mjs
//
// Only the exported helpers are covered here. The full contract run is
// exercised by running the checker itself against the tree.
import assert from 'node:assert';
import fs from 'node:fs';
import {
  missingFrom, plateMissing, plateRequired, plateJsOnly,
  cssBannedHits, appcacheMissing, cssLocalUrls, duplicateFormNames, inertSectionInvisible,
} from './check-contract.mjs';

// missingFrom returns the subset of `required` absent from `text`.
assert.deepEqual(missingFrom('<div ng-model="DarkMode">', ['DarkMode']), []);
assert.deepEqual(missingFrom('<div>', ['DarkMode']), ['DarkMode']);
assert.deepEqual(missingFrom('abc', ['ab', 'zz', 'c']), ['zz']);

// plateMissing checks the template alone; only allowlisted names are looked up
// in the controller. A controller that still mentions a name must not mask a
// binding the template dropped.
assert.deepEqual(plateMissing('<b>{{A}}</b>', '$scope.A = 1', ['A']), []);
assert.deepEqual(plateMissing('<b></b>', '$scope.A = 1', ['A']), ['A']);
assert.deepEqual(plateMissing('<b></b>', '$scope.A = 1', ['A'], ['A']), []);
assert.deepEqual(plateMissing('<b>A</b>', '', ['A'], ['A']), ['A'], 'allowlisted names must be in the JS');

// Mutation tests against the real plates and the real required lists.
const readWeb = (rel) => fs.readFileSync(new URL(`../web/${rel}`, import.meta.url), 'utf8');
const plateRun = (name, html) => plateMissing(
  html, readWeb(`plates/js/${name}.js`), plateRequired[name], plateJsOnly[name],
);
assert.deepEqual(plateRun('status', readWeb('plates/status.html')), [], 'status.html as shipped');
assert.ok(readWeb('plates/js/status.js').includes('GPS_solution'));
assert.deepEqual(
  plateRun('status', readWeb('plates/status.html').split('GPS_solution').join('')),
  ['GPS_solution'],
  'a binding dropped from status.html fails although status.js still names it',
);
assert.deepEqual(plateRun('map', readWeb('plates/map.html')), [], 'map.html as shipped');
assert.deepEqual(
  plateRun('map', readWeb('plates/map.html').replace('id="map_display"', 'id="map_view"')),
  ['id="map_display"'],
  'a renamed mount id fails although map.js still names it',
);

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
assert.equal(cssBannedHits('a{inset:0}').length, 1);
assert.equal(cssBannedHits('a{inset:55px 0 0}').length, 1);
assert.equal(cssBannedHits('a{box-shadow:inset 0 1px 2px #000}').length, 0, 'inset keyword in box-shadow');
assert.equal(cssBannedHits('a{background:#0008}').length, 1, '#rgba');
assert.equal(cssBannedHits('a{background:#0d1720d9}').length, 1, '#rrggbbaa');
assert.equal(cssBannedHits('a{box-shadow:0 0 30px #0005}').length, 1, '#rgba in a list');
assert.equal(cssBannedHits('a{color:#fff;background:#0d1720}').length, 0, '#rgb and #rrggbb');
assert.equal(cssBannedHits('#face,#c0ffee00x{color:red}').length, 0, 'id selectors are not colours');

// R9: the ban is on fetching a network font, so only an absolute http(s)
// @font-face src is a hit. The bundled FontAwesome face must pass.
assert.equal(cssBannedHits("@font-face{src:url('https://x/y.woff')}").length, 1);
assert.equal(
  cssBannedHits("@font-face{src:url('../maui/fonts/fontawesome-webfont.woff')}").length,
  0,
);
assert.equal(cssBannedHits('a{color:red}').length, 0);

// cssBannedHits: flex `gap` is banned even when display:flex and gap are split
// across separate rules / at-rules with the same (normalised) selector.
assert.equal(cssBannedHits('.sx-field{display:flex;flex-wrap:wrap} .sx-field{gap:4px}').length, 1, 'split rules, same selector');
assert.equal(
  cssBannedHits('.sx-title-row{display:flex;align-items:center} @media(max-width:800px){.sx-title-row{align-items:start;gap:15px;flex-direction:column}}').length,
  1,
  'split across at-rule, same selector',
);
assert.equal(
  cssBannedHits('@media(max-width:800px){.z{display:flex}} .z{gap:1px}').length,
  1,
  'display:flex in media, gap outside',
);
assert.equal(
  cssBannedHits('.grid{display:grid;gap:8px}').length,
  0,
  'grid gap still permitted',
);
assert.equal(
  cssBannedHits('.noflex{gap:4px}').length,
  0,
  'gap without display:flex is not flagged',
);
assert.equal(
  cssBannedHits('.sx-title-row{display:flex} @media(max-width:800px){.title-row{gap:15px}}').length,
  0,
  'lexically different selectors are not matched',
);

// appcacheMissing compares manifest entries (relative to web/, often written
// with a leading slash) with on-disk paths (repo-relative, web/...). The two
// spellings of the same file are equal; a genuine gap is reported verbatim.
assert.deepEqual(appcacheMissing(['a.css'], ['a.css']), []);
assert.deepEqual(appcacheMissing(['web/css/main.css'], ['/css/main.css']), []);
assert.deepEqual(appcacheMissing(['web/css/main.css'], ['css/main.css']), []);
assert.deepEqual(appcacheMissing(['./web/css/main.css'], ['/css/main.css']), []);
assert.deepEqual(appcacheMissing(['web/css/x.css'], ['/css/y.css']), ['web/css/x.css']);

// cssLocalUrls resolves a stylesheet's local url() references to manifest
// paths. AppCache matches the query string, so it is kept; fragments are not.
assert.deepEqual(cssLocalUrls("a{src:url('../maui/f.woff?v=4.4.0') format('woff')}", 'css/main.css'), ['/maui/f.woff?v=4.4.0']);
assert.deepEqual(cssLocalUrls('a{background:url(../img/w.png)}', 'css/main.css'), ['/img/w.png']);
assert.deepEqual(cssLocalUrls('a{background:url( "x.png" )}', 'css/main.css'), ['/css/x.png']);
assert.deepEqual(cssLocalUrls("a{src:url('../f.svg?v=1#icon')}", 'css/main.css'), ['/f.svg?v=1']);
assert.deepEqual(cssLocalUrls('a{b:url(data:image/png;base64,AAAA)}', 'css/main.css'), []);
assert.deepEqual(cssLocalUrls('a{b:url(https://x/y.png)} c{d:url(//x/y.png)}', 'css/main.css'), []);
assert.deepEqual(cssLocalUrls('a{b:url(#grad)}', 'css/main.css'), []);

// §5.8 defect 9: two forms sharing a name collide on the scope as one
// FormController. Only <form name> counts; inputs may legitimately share names.
assert.deepEqual(duplicateFormNames('<form name="a"></form><form name="b"></form>'), []);
assert.deepEqual(duplicateFormNames('<form name="a"></form><form class="x" name="a" novalidate></form>'), ['a']);
assert.deepEqual(duplicateFormNames('<input name="a"><input name="a"><form name="a"></form>'), []);
assert.deepEqual(duplicateFormNames("<form\n  name='a'></form><form name=\"a\"></form>"), ['a']);

// An ng-class that only adds .section_invisible cannot hide an element whose
// own class sets `display` later in the stylesheet (same specificity, later
// source wins). ng-show/ng-hide/ng-if hide it regardless.
const visCss = '.a{display:flex} .section_invisible{display:none} .b{display:flex} .c{color:red} .d{display:none}';
assert.deepEqual(inertSectionInvisible('<form class="b" ng-class="{ \'section_invisible\': (!x)}"></form>', visCss), ['b']);
assert.deepEqual(inertSectionInvisible('<div class="z b" ng-class="{\'section_invisible\': !x}">', visCss), ['b']);
assert.deepEqual(inertSectionInvisible('<form class="b" ng-show="x" ng-class="{ \'section_invisible\': (!x)}">', visCss), []);
assert.deepEqual(inertSectionInvisible('<div class="b" ng-hide="!x" ng-class="{\'section_invisible\': !x}">', visCss), []);
assert.deepEqual(inertSectionInvisible('<div class="a" ng-class="{\'section_invisible\': !x}">', visCss), [], 'declared before');
assert.deepEqual(inertSectionInvisible('<div class="c" ng-class="{\'section_invisible\': !x}">', visCss), [], 'no display');
assert.deepEqual(inertSectionInvisible('<div class="d" ng-class="{\'section_invisible\': !x}">', visCss), [], 'display:none');
assert.deepEqual(inertSectionInvisible('<div ng-class="{\'section_invisible\': !x}">', visCss), [], 'no class');
assert.deepEqual(inertSectionInvisible('<div class="b">', visCss), [], 'no ng-class');

console.log('check-contract primitives: all assertions passed');
