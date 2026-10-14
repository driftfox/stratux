# Prototype Layout Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a temporary Playwright tool in `dev/visual-compare/` that measures layout and spacing drift between the v0 prototype and the AngularJS reskin at 1024×768, and wire it into the redesign's Task 15.

**Architecture:** A Node CLI (`compare.mjs`) starts the prototype (`next start`) and `dev/server.mjs` on dedicated ports, drives both in one browser, measures every element in a hand-written map with `getBoundingClientRect` + computed padding, and hands the numbers to a pure comparison module that applies fixed tolerances and an accepted-differences list. Output is `report.json`, `report.html`, and paired screenshots in an ignored `out/` folder.

**Tech Stack:** Node 24 (ESM), Playwright (WebKit, Chromium fallback), `node:test` + `node:assert`. Prototype: Next.js 16 via corepack pnpm.

**Spec:** `docs/superpowers/specs/2026-10-13-visual-compare-design.md` — read it first; section names below refer to it.

## Global Constraints

- Viewport 1024×768 landscape; Playwright `devices['iPad (gen 7) landscape']` with `viewport: { width: 1024, height: 768 }`.
- Engine: WebKit; Chromium at the same viewport only if WebKit fails to launch. Every report states the engine.
- Tolerances, fixed before the first comparison run and never loosened: padding ±2px; fixed-element width/height ±2px; x/y position ±4px; inter-element gap ±4px; variable-container width ±2% of 1024px (±20.48px).
- Exit codes: 0 clean; 1 unexplained drift, missing elements, or map misses; 2 setup failure.
- Everything lives under `dev/visual-compare/` with its own `package.json`, lockfile, and `.gitignore` (`node_modules/`, `out/`). No root `.gitignore` edits; no `package.json` at the repo root or under `web/`.
- The tool never writes to `web/`, `dev/server.mjs`, or `dev/fixtures/`.
- Ports: dev server 8790, prototype 3790 (not 8080/3000).
- Prototype runs as a production build (`next build` then `next start`), never `next dev`. It is never committed.
- Reskin is measured with `DeveloperMode: true`, injected by rewriting the `/getSettings` response in Playwright.
- No `sudo` and no Docker on this machine.
- Compared screens (prototype name → reskin route): Status `#/`, Weather `#/weather`, Traffic `#/traffic`, Towers `#/towers`, Logs `#/logs`, Settings `#/settings`, Radar `#/radar`, Developer `#/developer`; plus shell states `menu`, `help`, `shutdown` over Status. Each in `light` and `dark`.

## Review Focus

1. **A server fails to start or its port is taken** — the run should exit 2 with a message naming the server, and leave no orphaned child process. *Test: Task 2.*
2. **The theme click doesn't take** (React state or Angular digest lag) — measuring the wrong theme silently would make the dark pass a copy of light. *Test: Task 3, `setTheme` verifies from the DOM and is idempotent.*
3. **Measuring before WebSocket data renders** — empty reskin tables have different heights and gaps. *Test: Task 3, `settle` on Traffic yields ≥1 body row.*
4. **A selector hits a hidden or zero-size node** (`ng-show`, `section_invisible`) — measuring a 0×0 box reports huge fake drift. *Test: Task 3, `measure` returns `found:false, reason:'hidden'` for hidden matches.*
5. **The allow-list or map silently matches nothing** — a typo'd accepted-difference id hides nothing yet looks reassuring, and a screen whose entries all miss could look clean. *Test: Task 1, unused accepted entries are reported; a screen with zero compared pairs fails.*

---

### Task 1: Comparison core

**Files:**
- Create: `dev/visual-compare/package.json`, `dev/visual-compare/.gitignore`
- Create: `dev/visual-compare/lib/tolerances.mjs`
- Create: `dev/visual-compare/lib/compare.mjs`
- Test: `dev/visual-compare/test/compare.test.mjs`

**Interfaces:**
- Produces:
  - `TOLERANCES` (`lib/tolerances.mjs`): `{ padding: 2, fixedSize: 2, position: 4, gap: 4, variableWidthPct: 2, viewportWidth: 1024 }`.
  - Map entry shape (used by Tasks 4–5): `{ id: string, proto: string|null, reskin: string|null, kind: 'fixed'|'variable', firstVariable?: boolean, noPosition?: boolean, after?: { id: string, axis: 'x'|'y' } }`. `proto: null` means reskin-only.
  - Measurement shape (produced by Task 3): `{ found: true, x, y, w, h, padTop, padRight, padBottom, padLeft } | { found: false, reason: 'no-match'|'hidden' }`, keyed by entry id.
  - `compareScreen({ screen, theme, entries, proto, reskin, accepted }) -> Finding[]` where `Finding = { screen, theme, id, metric, proto: number|null, reskin: number|null, delta: number|null, tolerance: number|null, verdict: 'pass'|'fail'|'accepted'|'missing-in-reskin'|'map-miss'|'reskin-only'|'empty-screen', reason?: string }`.
  - `loadAccepted(json: unknown) -> Accepted[]`, `Accepted = { screen: string, id: string, metric: string, theme: 'light'|'dark'|'*', reason: string }` (`id`/`metric` may be `'*'`). Throws if any entry lacks a non-empty `reason`.
  - `unusedAccepted(accepted: Accepted[], findings: Finding[]) -> Accepted[]`.
  - `exitCode(findings: Finding[]) -> 0|1` — 1 if any verdict is `fail`, `missing-in-reskin`, `map-miss`, or `empty-screen`.

- [ ] **Step 1: Scaffold the package**

`package.json`: `"name": "stratux-visual-compare"`, `"private": true`, `"type": "module"`, `"scripts": { "test": "node --test test/" }`, no dependencies yet. `.gitignore`: `node_modules/` and `out/`.

- [ ] **Step 2: Write the failing tests in `test/compare.test.mjs`**

Use `node:test` and `node:assert`. Build entries/measurements inline. Cases (one `test()` each):

- `fixed entry within tolerance passes every metric` — proto `{x:0,y:0,w:100,h:40,pad*:8}`, reskin `{x:3,y:-3,w:101,h:41,pad*:9}` → every finding `pass`; metrics present are exactly `x,y,w,h,padTop,padRight,padBottom,padLeft`.
- `fixed entry beyond tolerance fails` — reskin `x:5` → finding `{metric:'x', delta:5, tolerance:4, verdict:'fail'}`.
- `variable entry ignores height and later y` — kind `variable`, no `firstVariable`, reskin `h` and `y` wildly different → no `h` or `y` findings; with `firstVariable:true` a `y` finding exists.
- `variable width uses 2% of 1024` — width delta 20 passes, 21 fails; `tolerance` is `20.48`.
- `noPosition drops x, y and gap` — entry with `noPosition:true, after:{...}` yields no `x`, `y`, or `gap` findings.
- `gap measured along axis` — A `{y:0,h:40}`, B `after:{id:'A',axis:'y'}` at `y:56` in proto and `y:61` in reskin → `gap` finding proto 16, reskin 21, `fail`.
- `prototype miss is a map-miss` — proto `{found:false,reason:'no-match'}` → single finding verdict `map-miss`.
- `reskin miss is missing-in-reskin` — reskin `{found:false,reason:'hidden'}` → verdict `missing-in-reskin`, `reason:'hidden'`.
- `reskin-only entry is informational` — `proto:null` → verdict `reskin-only`; `exitCode` of that alone is 0.
- `accepted difference overrides fail` — accepted `{screen:'traffic', id:'traffic.th3', metric:'x', theme:'*', reason:'§6.9.1'}` turns the fail into `accepted` carrying the reason; `metric:'*'` and `id:'*'` also match.
- `loadAccepted rejects missing reason` — `assert.throws`.
- `unusedAccepted reports entries that matched nothing`.
- `screen with no compared pairs is empty-screen` — every entry a map-miss or absent → also one `empty-screen` finding; `exitCode` 1.

- [ ] **Step 3: Run tests, verify they fail**

Run: `cd dev/visual-compare && npm test`
Expected: FAIL — `lib/compare.mjs` not found.

- [ ] **Step 4: Implement `lib/tolerances.mjs` and `lib/compare.mjs`**

Pure functions only; no Playwright import. Metric → tolerance: `pad*` → `padding`; `w`/`h` on `fixed` → `fixedSize`; `w` on `variable` → `viewportWidth * variableWidthPct / 100`; `x`/`y` → `position`; `gap` → `gap`. Gap = `B.start − (A.start + A.size)` on the entry's axis, computed independently for each side. A finding passes when `|delta| <= tolerance`.

- [ ] **Step 5: Run tests, verify they pass**

Run: `cd dev/visual-compare && npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add dev/visual-compare
git commit -m "feat(visual-compare): comparison core with tolerances and accepted differences"
```

---

### Task 2: Prototype setup, servers, and browser launch

**Files:**
- Create: `dev/visual-compare/lib/servers.mjs`
- Create: `dev/visual-compare/lib/browser.mjs`
- Modify: `dev/visual-compare/package.json` (add `playwright` dev dependency)
- Test: `dev/visual-compare/test/servers.test.mjs`

**Interfaces:**
- Produces:
  - `class SetupError extends Error` (`lib/servers.mjs`).
  - `startDevServer({ port }) -> Promise<{ url: string, stop: () => Promise<void> }>` — spawns `node <repo>/dev/server.mjs --port <port>`, resolves when `GET /getSettings` returns 200, rejects with `SetupError` within 15 s otherwise (including when the port is already bound).
  - `startPrototype({ dir, port }) -> Promise<{ url, stop }>` — rejects with `SetupError` naming the missing step if `<dir>/.next/BUILD_ID` is absent; otherwise spawns `corepack pnpm exec next start -p <port>` in `dir`, resolves when `GET /` returns 200, rejects with `SetupError` within 60 s.
  - `stop()` kills the child and resolves once it has exited; calling it twice is safe.
  - `launchBrowser() -> Promise<{ browser, engine: 'webkit'|'chromium', contextOptions }>` (`lib/browser.mjs`) — tries `webkit.launch()`, falls back to `chromium.launch()` (with `args: ['--no-sandbox']`), returns the iPad context options from Global Constraints. Rejects with `SetupError` if both fail, including both error messages.

- [ ] **Step 1: Unpack and build the prototype (one-time, not committed)**

```bash
cd /home/dev/code
unzip -q stratux-aviation-dashboard-prototype.zip -d stratux-aviation-dashboard-prototype
cd stratux-aviation-dashboard-prototype
corepack pnpm install
corepack pnpm build
ls .next/BUILD_ID
```

Expected: `.next/BUILD_ID` exists. If the zip unpacks into a nested folder, use that folder as the prototype dir everywhere below.

- [ ] **Step 2: Install Playwright and browsers**

```bash
cd /home/dev/code/stratux-visual-compare/dev/visual-compare
npm install -D playwright
npx playwright install webkit chromium
```

Expected: both browsers download. A warning about missing host libraries is expected (no `sudo`); record it in the commit message body.

- [ ] **Step 3: Write the failing tests in `test/servers.test.mjs`**

- `dev server starts, answers, and stops` — `startDevServer({port: 8790})`, `fetch(url + '/getSettings')` is 200 JSON with a `DarkMode` key, `stop()`, then the same fetch rejects.
- `occupied port is a SetupError` — bind 8791 with `net.createServer().listen(8791)`, `startDevServer({port: 8791})` rejects with `SetupError`; no child remains (assert via the returned/attached child's `exitCode !== null`, exposed for the test as `err.child`).
- `prototype without a build is a SetupError` — `startPrototype({dir: os.tmpdir(), port: 3791})` rejects with `SetupError` whose message contains `next build`.
- `prototype starts and serves the app` — skipped unless `PROTOTYPE_DIR` is set; `GET /` body contains `STRATUX`.
- `launchBrowser returns an engine and a 1024×768 context` — `engine` is `webkit` or `chromium`; a page in that context has `window.innerWidth === 1024`.

- [ ] **Step 4: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — `lib/servers.mjs` not found.

- [ ] **Step 5: Implement `lib/servers.mjs` and `lib/browser.mjs`**

Resolve the repo root as `../../..` from `lib/`. Poll readiness with `fetch` every 250 ms. Pipe child stderr into the `SetupError` message on failure.

- [ ] **Step 6: Run tests, verify they pass**

Run: `PROTOTYPE_DIR=/home/dev/code/stratux-aviation-dashboard-prototype npm test`
Expected: all pass. Note which engine `launchBrowser` returned.

- [ ] **Step 7: Commit**

```bash
git add dev/visual-compare
git commit -m "feat(visual-compare): start both apps and launch the iPad browser"
```

---

### Task 3: App drivers and in-page measurement

**Files:**
- Create: `dev/visual-compare/lib/apps.mjs`
- Create: `dev/visual-compare/lib/measure.mjs`
- Test: `dev/visual-compare/test/apps.test.mjs`

**Interfaces:**
- Consumes: `startDevServer`, `startPrototype`, `launchBrowser` (Task 2); measurement shape (Task 1).
- Produces:
  - `SCREENS` (`lib/apps.mjs`): `[{ key:'status', proto:'Status', route:'#/' }, { key:'weather', proto:'Weather', route:'#/weather' }, { key:'traffic', proto:'Traffic', route:'#/traffic' }, { key:'towers', proto:'Towers', route:'#/towers' }, { key:'logs', proto:'Logs', route:'#/logs' }, { key:'settings', proto:'Settings', route:'#/settings' }, { key:'radar', proto:'Radar', route:'#/radar' }, { key:'developer', proto:'Developer', route:'#/developer' }]` and `SHELL_STATES = ['menu','help','shutdown']`.
  - `prepareReskinPage(page)` — routes `**/getSettings` to the real response with `DeveloperMode: true` merged in.
  - `preparePrototypePage(page)` — aborts `**/_vercel/**`.
  - `openScreen(page, app: 'proto'|'reskin', baseUrl, screenKey)` — prototype: load `/`, click `button[aria-label="Open menu"]`, click `.nav-item` with exact text; reskin: load `<baseUrl>/<route>`.
  - `openShellState(page, app, state)` — prototype labels `Open menu` / `Open help` / `Open shutdown confirmation`; reskin labels `Menu` / `Help` / `Shut down`. Resolves once the drawer or dialog is visible.
  - `isDark(page, app) -> Promise<boolean>` — prototype: `main.app` has class `dark`; reskin: `#themeStylesheet` `href` ends with `css/dark-mode.css`.
  - `setTheme(page, app, theme: 'light'|'dark')` — clicks `Toggle dark mode` / `Toggle theme` only if `isDark` differs, then waits until `isDark` matches; throws if it doesn't within 5 s.
  - `settle(page, app, screenKey)` — injects `*,*::before,*::after{animation:none!important;transition:none!important}`, waits for network idle (reskin: 1 s quiet instead, since WebSockets never idle), and on reskin `traffic`, `towers`, `weather` waits for ≥1 rendered row/report.
  - `measure(page, selectors: Record<string,string>) -> Promise<Record<string, Measurement>>` (`lib/measure.mjs`) — first match that is visible with non-zero size; `{found:false, reason:'hidden'}` if matches exist but none qualify; `{found:false, reason:'no-match'}` if none. Coordinates from `getBoundingClientRect()` with the page and all scroll containers at scroll 0; padding from `getComputedStyle`, rounded to 0.5px.
  - Selector syntax: plain CSS, plus `panel:<heading text>` which resolves to the `section.panel` (prototype) or `section.sx-panel` (reskin) whose `h2` text equals `<heading text>`, and `panel:<heading text> >> <css>` for a descendant of it.

- [ ] **Step 1: Write the failing tests in `test/apps.test.mjs`**

Start the dev server (8790), and the prototype (3790) if `PROTOTYPE_DIR` is set, once in `before()`; stop both in `after()`. Cases:

- `reskin setTheme reaches dark and is idempotent` — `setTheme(dark)` twice → `isDark` true; `setTheme(light)` → false.
- `prototype setTheme reaches light and is idempotent` — prototype starts dark; `setTheme(light)` twice → false. *(PROTOTYPE_DIR)*
- `reskin settle on traffic renders rows` — after `openScreen` + `settle`, `page.locator('tbody tr').count() >= 1`.
- `reskin DeveloperMode is injected` — on `#/settings`, `measure(page, {hw: 'panel:Hardware'})` is `found:true`.
- `prototype navigation reaches each screen` — for every `SCREENS` entry, after `openScreen`, `h1` text equals `proto`. *(PROTOTYPE_DIR)*
- `measure reports hidden matches as hidden` — on reskin `#/`, inject `<div class="vc-probe" style="display:none">` then `measure` → `{found:false, reason:'hidden'}`; a missing class → `no-match`.
- `panel selector resolves on both apps` — `measure(page, {p: 'panel:Receiver health'})` found on both Status screens.
- `shell states open on both apps` — each of `SHELL_STATES` resolves without throwing.

- [ ] **Step 2: Run tests, verify they fail**

Run: `PROTOTYPE_DIR=/home/dev/code/stratux-aviation-dashboard-prototype npm test`
Expected: FAIL — `lib/apps.mjs` not found.

- [ ] **Step 3: Implement `lib/apps.mjs` and `lib/measure.mjs`**

`measure` runs a single `page.evaluate` for all selectors; resolve `panel:` selectors inside that evaluate. Scroll containers to reset: `window`, `.scrollable-content`, `.app-body`.

- [ ] **Step 4: Run tests, verify they pass**

Run: `PROTOTYPE_DIR=/home/dev/code/stratux-aviation-dashboard-prototype npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add dev/visual-compare
git commit -m "feat(visual-compare): drive both apps, switch themes, measure elements"
```

---

### Task 4: CLI run loop, screenshots, and report

**Files:**
- Create: `dev/visual-compare/compare.mjs`
- Create: `dev/visual-compare/lib/report.mjs`
- Create: `dev/visual-compare/elements.mjs` (shell entries only in this task)
- Create: `dev/visual-compare/accepted-differences.json` (`[]` in this task)
- Test: `dev/visual-compare/test/cli.test.mjs`

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces:
  - `ELEMENTS` (`elements.mjs`): `Record<screenKey | 'shell:menu' | 'shell:help' | 'shell:shutdown', MapEntry[]>`. The keys `status`…`developer` apply to their screen; `shell:*` keys apply with that shell state open over Status. This task fills only header, breadcrumb, and title row (on `status`) plus the drawer/dialog containers (on `shell:*`); Task 5 fills the rest.
  - `parseArgs(argv: string[]) -> { prototype: string, out: string, only?: string[] }` — `--prototype <dir>` required (throws without it), `--out <dir>` default `<tool>/out`, `--only status,traffic` optional.
  - `writeReport(outDir, { engine, startedAt, findings, unused, screenshots })` writes `report.json` and `report.html`.
  - Screenshot paths: `out/screenshots/<screenKey-or-shell-state>-<theme>-{prototype,reskin}.png`.
  - CLI: `node compare.mjs --prototype <dir> [--out <dir>] [--only a,b]`, exit codes per Global Constraints; prints one summary line per screen×theme and a final totals line.

- [ ] **Step 1: Write the failing tests in `test/cli.test.mjs`**

- `parseArgs requires --prototype` — `assert.throws(() => parseArgs([]))`.
- `parseArgs parses --only` — `['--prototype','/p','--only','status,traffic']` → `only` deep-equals `['status','traffic']`.
- `writeReport writes json and html` — into a temp dir with two fake findings; `report.json` parses and has `engine`; `report.html` contains each finding's `id`.
- `end-to-end on status exits 0 or 1 and writes screenshots` — *(PROTOTYPE_DIR)* spawn `node compare.mjs --prototype $PROTOTYPE_DIR --out <tmp> --only status`; exit code is 0 or 1 (never 2); the four `status-{light,dark}-{prototype,reskin}.png` files exist; `report.json` `engine` is set.
- `reskin screenshot covers the whole scroll area` — *(PROTOTYPE_DIR)* run `--only settings`; the reskin PNG's height (read from the PNG IHDR bytes 20–23) is greater than 768.
- `bad prototype dir exits 2` — spawn with `--prototype /nonexistent` → exit code 2, stderr mentions `next build`.

- [ ] **Step 2: Run tests, verify they fail**

Run: `PROTOTYPE_DIR=/home/dev/code/stratux-aviation-dashboard-prototype npm test`
Expected: FAIL — `compare.mjs` not found.

- [ ] **Step 3: Implement `compare.mjs`, `lib/report.mjs`, and the shell entries in `elements.mjs`**

Run order: start both servers, launch the browser, then for each theme and each map key open a fresh page per app, prepare, open screen or shell state, set theme, settle, measure, screenshot; then `compareScreen`, `unusedAccepted`, `writeReport`. Always stop servers and close the browser in `finally`. `SetupError` → exit 2. Report HTML: per screen×theme, the two screenshots side by side with failing elements outlined (absolute-positioned boxes from the measurements over each image), then a findings table grouped by verdict, then unused accepted entries. Plain HTML/CSS, no dependencies. Full-length reskin screenshots: the implementer chooses the method (spec §7).

- [ ] **Step 4: Run tests, verify they pass**

Run: `PROTOTYPE_DIR=/home/dev/code/stratux-aviation-dashboard-prototype npm test`
Expected: all pass.

- [ ] **Step 5: Open the report and eyeball it**

Run: `node compare.mjs --prototype /home/dev/code/stratux-aviation-dashboard-prototype --only status`
Expected: `out/report.html` shows Status side by side in both themes with header/crumb/title-row findings. Serve with `npx http-server out -p 8792 -a 127.0.0.1` (or any static server) if a browser is available; otherwise confirm the screenshots by reading the PNGs.

- [ ] **Step 6: Commit**

```bash
git add dev/visual-compare
git commit -m "feat(visual-compare): CLI run loop with paired screenshots and HTML report"
```

---

### Task 5: Full element map and seeded accepted differences

**Files:**
- Modify: `dev/visual-compare/elements.mjs`
- Modify: `dev/visual-compare/accepted-differences.json`
- Test: `dev/visual-compare/test/elements.test.mjs`

**Interfaces:**
- Consumes: `ELEMENTS` shape and `panel:` selector syntax (Tasks 1, 3, 4); `loadAccepted` (Task 1).
- Produces: a complete `ELEMENTS` and a seeded `accepted-differences.json`. Ids are `<screen>.<name>`, e.g. `traffic.th3`, `settings.wifi.submit`.

Map rules (spec *What is measured*, *Element map*):
- Every `section.panel` in the prototype's version of the screen gets an entry by heading (`panel:<title>`), with the reskin heading text where it differs (read the reskin plate).
- Inside each panel, entries for its heading row, and for its first button, first field row, first metric, first table header row, and first table body row where present; `kind:'fixed'`.
- Panels are `kind:'variable'`; the first panel on a screen has `firstVariable:true`; each subsequent panel has `after` the previous one on axis `y` (or `x` when side by side).
- `noPosition:true` on every panel entry for `settings` and `status`.
- `radar`: only the badge row and the scope container (`#radar_display` in the reskin).
- Reskin-only panels (e.g. Status `OGN statistics`, Settings `Diagnostics`, `Raw Configuration`) get `proto:null` entries.
- No entries for Status message-rate bar fills or Radar contacts.

Seed `accepted-differences.json` (spec *Accepted differences*), each with `theme:'*'` and the quoted reason:
- `traffic`, table header/body cell ids, metric `x` and `w` — "prototype defect §6.9.1: values shifted one column left".
- `towers`, `*`, metrics `x`, `w` on table cells — "prototype defect §6.9.2: towers reused the traffic table".
- `weather`, TAF/PIREP/WINDS badge ids, `*` — "prototype defect §6.9.3: pills rendered unstyled".
- `status`, title-row badge id, `*` — "redesign Task 4: fabricated ALL SYSTEMS NOMINAL badge removed".
- `traffic`, targets-count badge id, `*` — "prototype defect §6.9.4: hard-coded 12 targets".
- `logs`, debug string ids, metric `w` — "prototype hard-codes user agent and viewport; reskin binds them".

- [ ] **Step 1: Write the failing tests in `test/elements.test.mjs`**

- `every screen and shell state has entries` — keys of `ELEMENTS` are exactly the 8 screen keys plus `shell:menu`, `shell:help`, `shell:shutdown`, each non-empty.
- `ids are unique and prefixed` — every id starts with its screen key (or `shell.`) and is unique.
- `after references an earlier entry on the same screen`.
- `settings and status panels carry noPosition`.
- `exactly one firstVariable per screen that has variable entries`.
- `accepted differences load and name mapped ids` — `loadAccepted(json)` does not throw; every non-`*` id exists in `ELEMENTS[screen]`.

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL on the coverage and seed tests.

- [ ] **Step 3: Write the map and the seed**

Read `app/page.tsx` and `app/globals.css` (via `unzip -p` or the unpacked dir) beside each reskin plate in `web/plates/` and `web/index.html`.

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Run the full comparison and clear map misses**

Run: `node compare.mjs --prototype /home/dev/code/stratux-aviation-dashboard-prototype`
Expected: exit 0 or 1, zero findings with verdict `map-miss`, no `empty-screen` findings, and no unused accepted entries. Fix selectors until that holds. Drift (`fail`) and `missing-in-reskin` are expected and are not fixed in this plan.

- [ ] **Step 6: Commit**

```bash
git add dev/visual-compare
git commit -m "feat(visual-compare): full element map and seeded accepted differences"
```

---

### Task 6: Wire into the redesign plan

**Files:**
- Modify: `docs/superpowers/plans/2026-10-13-stratux-ui-redesign.md` (Task 15, lines ~572–610)

**Interfaces:**
- Consumes: the CLI from Task 4.

- [ ] **Step 1: Add a step after Task 15 Step 2**

Title: "Prototype layout comparison". Body: prerequisites (prototype unpacked and built per this plan's Task 2 Step 1; `npm install` and `npx playwright install webkit chromium` in `dev/visual-compare`); command `node dev/visual-compare/compare.mjs --prototype /home/dev/code/stratux-aviation-dashboard-prototype`; fix loop — fix in templates or the shared rules in `web/css/main.css` / `web/css/dark-mode.css` under the spec's *What a drift fix may change*, run `node dev/check-contract.mjs` (exit 0) after every fix, rerun the full comparison after any shared-rule change; tolerances in `lib/tolerances.mjs` are not edited; any new accepted difference needs a reason and a human review before the final run; done when the comparison exits 0.

- [ ] **Step 2: Amend Task 15 Step 6**

Replace the "before/after screenshots from Task 2 Step 1" with `dev/visual-compare/out/report.html` and its screenshots, attached for the human visual sign-off; note this amends R12 for Task 15.

- [ ] **Step 3: Add a final Task 15 step**

Title: "Remove the comparison tool". Body: after the human sign-off, fast-forward `ui-redesign` to `ui-redesign-visual-compare`; on `ui-redesign`, delete `dev/visual-compare/`, `docs/superpowers/specs/2026-10-13-visual-compare-design.md`, and `docs/superpowers/plans/2026-10-13-visual-compare.md` in one commit; confirm `git diff c24d64df --stat` lists none of them.

- [ ] **Step 4: Verify**

Run: `node dev/check-contract.mjs`
Expected: `Contract check: PASS (0 failures)`.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-10-13-stratux-ui-redesign.md
git commit -m "docs: add prototype layout comparison and tool removal to Task 15"
```
