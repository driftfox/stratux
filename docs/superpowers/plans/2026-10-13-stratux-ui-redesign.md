# Stratux UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Translate the approved v0 prototype design into the existing AngularJS templates in `web/` so the UI is visually modernised while displaying at least as much data as the original and keeping every controller untouched.

**Architecture:** The v0 prototype (`stratux-aviation-dashboard-prototype/app/page.tsx` + `globals.css`) is the design source for eight screens and the shell; the original templates are retained for GPS/AHRS/G-Meter and Map. Work proceeds shell-first, then one screen at a time, with a purpose-built contract checker acting as the test suite — there is none in this repo. The checker is built first so every subsequent change is gated by it.

**Tech Stack:** AngularJS 1.x, ui-router, mobile-angular-ui, svg.js, OpenLayers. Plain static HTML/CSS — no bundler, no npm, no package.json. Node 22 available for dev tooling (`dev/server.mjs`, and the new checker).

**Spec:** `docs/superpowers/specs/2026-10-13-stratux-ui-redesign.md` — the plan argues entirely from this document; read it first. Section references below are to it. Design source material: `C:\Users\Russell\src\stratux-aviation-dashboard-prototype`.

## Global Constraints

- **Browser floor: 2015-era tablets.** Banned in CSS (§5.1.2): `gap` in flex containers, CSS nesting, `:has()`, container queries, `aspect-ratio`, `backdrop-filter`, webfonts via `@font-face`, `position: sticky`. Replace per the table in §5.1.2.
- **Framework frozen:** AngularJS 1.x + mobile-angular-ui. No React, no JSX, no Tailwind, no build step. Do not add a `package.json` to `web/`.
- **Controllers frozen:** no edits to `web/plates/js/*.js` or `web/js/main.js`. If a change seems to need one, the change is wrong (§2).
- **`ui-switch` substitution is allowed:** the builder may use its own switch markup provided `ng-model` binds to the same scope variable (§4).
- **§5.8 known defects:** rewriting the templates resolves defects 1, 5, 6, 7, 9 and 10 as a side effect. **Defect 8 (unconfirmed Delete actions) must be preserved.** Defects 2, 3 and 4 are handled explicitly by Tasks 13, 13 and 12 respectively.
- **Theme:** light is the base stylesheet; `css/dark-mode.css` holds the complete dark theme. `#themeStylesheet` and the filename are unchanged (§5.1.1). Dark is the design priority even though light is the base file.
- **Files the redesign may touch:** `web/index.html`, `web/plates/*.html`, `web/plates/*-help.html`, `web/css/*.css`. New CSS files must live under `web/css/` and be listed in `web/stratux.appcache` (§5.7).
- **Completeness rule:** the final UI may not display less data than the original (§6). Every unchecked box in §6 must be checked by the end.
- **Touch targets:** minimum 44px (`min-width`/`min-height`), already present on `.icon-button` in the prototype.
- **Data endpoints are fixed** (§5.6): five WebSockets `/status`, `/situation`, `/traffic`, `/weather`, `/radar`. There is no `/developer` socket.
- **Verification is manual plus the checker.** No unit tests exist; `make` is not installed; the Go build fails on Windows by design (§3). Do not attempt `go build ./...` as verification.

## Review Focus

1. **A redesigned template silently drops a scope binding.** AngularJS renders an empty cell rather than throwing, so a missing `{{CPUTemp}}` looks identical to an absent sensor. *Test: `node dev/check-contract.mjs` asserts every binding listed in §5.4 is present in its plate — run at the end of every screen task.*
2. **An instrument mount id is renamed**, blanking GPS/Radar/Map with no error. *Test: the checker asserts `ahrs_display`, `gMeter_display`, `radar_display`, `map_display`, `.hider`, `status-gps`, `status-imu`, `status-bmp`, `status-calibrating`, `#themeStylesheet` — run in every screen task and Task 3.*
3. **Dark theme is only half-built** because a screen was styled in `main.css` and never given a dark rule, so `DarkMode=true` shows unreadable text. *Test: the checker asserts every custom property defined in `css/main.css` is also defined in `css/dark-mode.css`, and a per-screen dark-mode visual check is a named step in each screen task.*
4. **A banned 2015-era CSS feature slips in** (`gap` on a flex container is the likely one) and layout collapses only on the cockpit tablets users actually have. *Test: the checker greps all of `web/css/` for the banned patterns from §5.1.2 and fails on a hit.*
5. **`stratux.appcache` falls behind**, so offline users get stale or missing assets — the exact bug that already exists (§5.8 defect 10). *Test: the checker asserts every `.css`/`.js` file under `web/` is enumerated in `web/stratux.appcache`.*

---

## File Structure

| File | Responsibility |
|---|---|
| `dev/check-contract.mjs` | **Create.** The test suite: asserts bindings, ids, directives, CSS constraints, and AppCache coverage. Exits non-zero on failure. |
| `web/css/main.css` | Modify. Light base theme — tokens and component styles ported from prototype `globals.css` `:root` + shared rules. |
| `web/css/dark-mode.css` | Modify. Complete dark theme — ported from prototype `.app.dark` token block plus per-component overrides. |
| `web/index.html` | Modify. Shell: navbar, left menu, help drawer, `ui-view`, `#themeStylesheet`. |
| `web/plates/status.html` | Modify. |
| `web/plates/traffic.html` | Modify. |
| `web/plates/weather.html` | Modify. |
| `web/plates/towers.html` | Modify. |
| `web/plates/logs.html` | Modify. |
| `web/plates/developer.html` | Modify. |
| `web/plates/settings.html` | Modify. Split across two tasks (§6.3 has 11 groups). |
| `web/plates/radar.html` | Modify (chrome only — the scope itself is SVG drawn by `radar.js`). |
| `web/plates/gps.html`, `web/plates/map.html` | **No change** — original retained (§6.1). Verified, not edited. |
| `web/plates/*-help.html` | Modify only where §6.8 requires; content must survive. |
| `web/stratux.appcache` | Modify. Add every missing asset (§5.8 defect 10). |

---

### Task 1: Contract checker (the test suite)

**Files:**
- Create: `dev/check-contract.mjs`

**Interfaces:**
- Consumes: §5.4 (per-screen bindings, handlers, directives), §5.2 (shell ids), §5.1.2 (banned CSS), §5.7 (AppCache list).
- Produces: `node dev/check-contract.mjs` → exit 0 on pass, exit 1 with a per-screen list of failures. Every later task calls this.

- [ ] **Step 1: Write the checker's own failing tests**

Create `dev/check-contract.tests.mjs` with assertions over fixture strings, written first:
```js
import assert from 'node:assert';
// loadMerged(html, required) returns the subset of `required` not found in `html`
import { missingFrom, cssBannedHits, appcacheMissing } from './check-contract.mjs';
assert.deepEqual(missingFrom('<div ng-model="DarkMode">', ['DarkMode']), []);
assert.deepEqual(missingFrom('<div>', ['DarkMode']), ['DarkMode']);
assert.ok(cssBannedHits('a{gap:8px}').length === 1);
assert.ok(cssBannedHits('a{margin:8px}').length === 0);
assert.deepEqual(appcacheMissing(['a.css'], ['a.css']), []);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node dev/check-contract.tests.mjs`
Expected: FAIL — `check-contract.mjs` does not exist.

- [ ] **Step 3: Implement `dev/check-contract.mjs`**

Export `missingFrom(html, required)`, `cssBannedHits(css)`, `appcacheMissing(onDisk, listed)`, plus a `main()` that:
1. Reads every plate in §5.4 and reports bindings/handlers/directives that are absent (compare against arrays transcribed from §5.4).
2. Asserts the §5.2 shell ids and directives in `web/index.html`.
3. Greps `web/css/*.css` for the §5.1.2 banned patterns. Match `gap` only inside `display:flex` blocks — the ban is flex-specific; grid `gap` is permitted.
4. Asserts every `.css`/`.js` under `web/` (excluding `web/maui/`, vendored) appears in `web/stratux.appcache`.
5. Asserts every custom property defined in `css/main.css` is defined in `css/dark-mode.css`.

Transcribe §5.4 literally. This is the one place copying the spec is correct — the checker *is* the spec encoded.

Guard the `main()` invocation so the module can be imported by the tests without executing a full run:
```js
if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) main();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node dev/check-contract.tests.mjs`
Expected: PASS

- [ ] **Step 5: Run the checker against the current (pre-redesign) tree**

Run: `node dev/check-contract.mjs`
Expected: **FAIL**, listing only known pre-existing problems — appcache gaps (§5.8 defect 10) and possibly the dark-mode property diff. No plate-level binding failures: the original templates are complete. If a plate-level binding is reported missing, verify against §5.4 before touching any template — it is more likely a transcription error in the checker.

Record the baseline output; it becomes the "expected failures" list that Task 14 clears.

- [ ] **Step 6: Commit**

```bash
git add dev/check-contract.mjs dev/check-contract.tests.mjs
git commit -m "test: add web UI contract checker"
```

---

### Task 2: Design tokens — `main.css` (light base) and `dark-mode.css`

**Files:**
- Modify: `web/css/main.css`
- Modify: `web/css/dark-mode.css`

**Interfaces:**
- Consumes: prototype `globals.css` `:root{…}` (light tokens) and `.app.dark{…}` (dark tokens).
- Produces: the token names `--bg`, `--panel`, `--text`, `--muted`, `--line`, `--accent`, `--good`, `--amber`, `--bad` in both files; component classes referenced by the shell (Task 3) and screens (Tasks 4–13).

- [ ] **Step 1: Capture a visual baseline**

Start `node dev/server.mjs`, open <http://127.0.0.1:8080>, and screenshot Status and Settings in both themes. These are the before-images for the final comparison.

- [ ] **Step 2: Port light tokens into `css/main.css`**

Copy the prototype `:root{…}` block values. Write them as plain declarations on existing selectors (or a `:root` block) — **not** depending on variables for anything structural, per §5.1.2.
Exact values: `--bg:#f3f5f7`, `--panel:#fff`, `--text:#17202a`, `--muted:#66727d`, `--line:#dce2e7`, `--accent:#2d6cdf`, `--good:#159447`, `--amber:#c88b16`, `--bad:#c43d48`, base font size 14px, `Arial, Helvetica, sans-serif`.

- [ ] **Step 3: Port dark tokens into `css/dark-mode.css`**

From the prototype `.app.dark{…}` block: `--bg:#0b1117`, `--panel:#121a22`, `--text:#e9eef3`, `--muted:#8e9aa6`, `--line:#26323d`, `--accent:#6ea2ff`. Keep `--good`, `--amber`, `--bad` defined too even though the prototype inherits them — §5.1.1 requires dark to be self-sufficient (Review Focus 3).

- [ ] **Step 4: Rewrite the prototype's component CSS under the 2015 floor**

Take the prototype's component rules and apply the §5.1.2 substitutions: `gap` on flex containers → margins on children; `place-items` → explicit `align-items`/`justify-content`; `width:min(340px,90vw)` → media query; drop `color-scheme`. Grid `gap` may stay.

- [ ] **Step 5: Run the checker**

Run: `node dev/check-contract.mjs`
Expected: no CSS-banned hits; every `main.css` custom property present in `dark-mode.css`.

- [ ] **Step 6: Verify both themes render**

Load <http://127.0.0.1:8080> with `DarkMode` on and off (toggle lives in Settings → Theme; the fixture server returns both). Confirm Status reads correctly in each.

- [ ] **Step 7: Commit**

```bash
git add web/css/main.css web/css/dark-mode.css
git commit -m "feat: port design tokens to main.css and dark-mode.css"
```

---

### Task 3: Shell — `index.html`

**Files:**
- Modify: `web/index.html`

**Interfaces:**
- Consumes: token/component classes from Task 2.
- Produces: the nav item list and visibility conditions of §5.2; the `ui-*` directive structure every plate depends on; the `#themeStylesheet` link.

- [ ] **Step 1: Rebuild the navbar, menu and help drawer chrome**

Port the prototype's header (brand mark, connection pill, theme toggle, help button, power/shutdown button), left menu drawer, and right help drawer — keeping every element of §5.2: `ui-toggle="uiSidebarLeft"`/`uiSidebarRight`, `ui-track-as-search-param`, `ui-turn-off='uiSidebarLeft'` on the nav list, swipe gestures, `ng-include="helppage"`, the `.app`→`.app-body`→`.app-content`→`.scrollable`→`.scrollable-content`→`ui-view` chain, and `<div ui-yield-to="modals">`.

Keep all ten nav items in the §5.2 order with their `ng-show` conditions.

- [ ] **Step 2: Keep `#themeStylesheet` and `MainCtrl` wiring intact**

Verify the `<link id="themeStylesheet">` element and `<body ng-app="stratux" ng-controller="MainCtrl" ui-prevent-touchmove-defaults>` are unchanged.

- [ ] **Step 3: Run the checker**

Run: `node dev/check-contract.mjs`
Expected: shell section passes — all §5.2 ids and directives present.

- [ ] **Step 4: Verify the shell manually**

Load the dev server. Confirm: menu opens/closes, help drawer opens, all ten routes reachable, swipe works, Help shows content on Status.

- [ ] **Step 5: Commit**

```bash
git add web/index.html
git commit -m "feat: redesign app shell"
```

---

### Task 4: Status screen

**Files:**
- Modify: `web/plates/status.html`

**Interfaces:**
- Consumes: §5.4 `StatusCtrl` bindings; §6.4 checklist; prototype `StatusScreen`.
- Produces: nothing new — the plate binds existing scope.

- [ ] **Step 1: Run the checker for a baseline**

Run: `node dev/check-contract.mjs`
Expected: Status section passes (original template).

- [ ] **Step 2: Redesign the template to the prototype's Status layout**

Keep every §6.4 item: message-rate bars for UAT/1090ES/AIS/OGN with current and peak, OGN noise bar with **range loss factor** and its caption, OGN statistics incl. **Receiver Gain** and the **RF Spectrogram link**, UAT statistics 2×4 grid, GPS hardware + protocol row, GPS solution/accuracy/satellites, system row (uptime, CPU temp, free storage, min/max when DeveloperMode), frame totals, **Errors panel**, separate Ping/Pong device labels, `(disconnected)` suffixes, Developer Mode badge, version/build line.

Preserve the Region modal via `ui-content-for="modals"` / `ui-if="RegionSelect"` / `ui-state="RegionSelect"` and the `setRegionClick` inline handlers.

- [ ] **Step 3: Run the checker**

Run: `node dev/check-contract.mjs`
Expected: Status section still passes — no binding dropped.

- [ ] **Step 4: Visual check in both themes**

Load `#/`. Confirm §6.4 items are all visible, the Errors panel renders when the fixture returns errors (and hides when empty), and dark mode is readable.

- [ ] **Step 5: Commit**

```bash
git add web/plates/status.html
git commit -m "feat: redesign status screen"
```

---

### Task 5: Traffic screen

**Files:**
- Modify: `web/plates/traffic.html`

**Interfaces:**
- Consumes: §5.4 `TrafficCtrl` bindings; §6.5 checklist; prototype `TrafficScreen`.
- Produces: the four `ui-switch` elements bound to `showReg`, `showSquawk`, `showCategory`, `RelDist`.

- [ ] **Step 1: Run the checker for a baseline**

Run: `node dev/check-contract.mjs`
Expected: Traffic section passes.

- [ ] **Step 2: Rebuild both tables with correct columns**

Primary table columns (§6.5): Tail/Callsign, Code (ICAO hex + `(TFID)`) or Squawk, Category, Location **or** Distance + Bearing, Altitude `ft`, Vertical speed with arrows, Speed `KTS`, Course `°`, Power `dB`, Age `s`. Secondary Mode S table: Code, Category, `DistEst`, Squawk, plus real Altitude/Speed/Course/Vspeed.

**Fix prototype defect §6.9.1** — values must sit under their own headers; the prototype is shifted one column left.

Keep both `ng-repeat`s: `aircraft in data_list | orderBy: 'dist'` and `aircraft in data_list_invalid | orderBy: 'icao'`.

- [ ] **Step 3: Wire the four toggles to real columns**

`showReg` swaps `aircraft.reg`/`aircraft.tail`; `showSquawk` swaps Code↔Squawk in the primary table; `showCategory` adds the Category column; `RelDist` swaps lat/lon for distance+bearing and is `ng-hide`n when `!GPS_connected`.

- [ ] **Step 4: Run the checker**

Run: `node dev/check-contract.mjs`
Expected: Traffic section passes.

- [ ] **Step 5: Verify all four toggles change the table**

Load `#/traffic`, toggle each switch, confirm the columns change and no column is empty. Check both themes.

- [ ] **Step 6: Commit**

```bash
git add web/plates/traffic.html
git commit -m "feat: redesign traffic screen with full column set"
```

---

### Task 6: Weather screen

**Files:**
- Modify: `web/plates/weather.html`

**Interfaces:**
- Consumes: §5.4 `WeatherCtrl` bindings; §6.7 first bullet; prototype `WeatherScreen`.
- Produces: the accordion directive set (`ui-state="weatherAccordion"`, `ui-default="1"`, `ui-set`, `ui-if`).

- [ ] **Step 1: Rebuild with counts and watch-list identifiers**

Keep the two-section accordion. Section headers must include `Watching {{watching}} ({{watch_count}})` and `Recent Reports ({{data_count}})`. Each row: location, type badge, age **with staleness color**, raw report text.

Keep both `ng-repeat`s with `| orderBy: -age`.

- [ ] **Step 2: Style all five flight-category and report-type badges**

`flight_condition_VFR/MVFR/IFR/LIFR` plus `report_TAF/PIREP/WINDS`. **Fix prototype defect §6.9.3** — TAF/PIREP/WINDS currently render unstyled.

- [ ] **Step 3: Run the checker**

Run: `node dev/check-contract.mjs`
Expected: Weather section passes.

- [ ] **Step 4: Verify**

Load `#/weather`. Confirm both sections show counts, all five badge types have color, staleness reads correctly, dark mode legible.

- [ ] **Step 5: Commit**

```bash
git add web/plates/weather.html
git commit -m "feat: redesign weather screen"
```

---

### Task 7: Towers screen

**Files:**
- Modify: `web/plates/towers.html`

**Interfaces:**
- Consumes: §5.4 `TowersCtrl` bindings; §6.7 second bullet; prototype `TowersScreen`.

- [ ] **Step 1: Give the table its own headers**

Five columns: **Location**, **Current Power (dB)**, **Avg Power (dB)**, **Max Power (dB)**, **Msgs Last Minute** — bound to `tower.lat`, `tower.lon`, `tower.power`, `tower.power_last_min`, `tower.power_max`, `tower.messages`.
**Fix prototype defect §6.9.2** — the prototype renders dB values under the traffic table's "Altitude" header.
Keep `ng-repeat="tower in data_list | orderBy: messages"` and the `ConnectState` badge.

- [ ] **Step 2: Run the checker**

Run: `node dev/check-contract.mjs`
Expected: Towers section passes.

- [ ] **Step 3: Verify** — load `#/towers`, confirm headers match values, both themes.

- [ ] **Step 4: Commit**

```bash
git add web/plates/towers.html
git commit -m "feat: redesign towers screen with correct column headers"
```

---

### Task 8: Logs screen

**Files:**
- Modify: `web/plates/logs.html`

**Interfaces:**
- Consumes: §5.4 `LogsCtrl` bindings (`userAgent`, `deviceViewport`); prototype `LogsScreen`.

- [ ] **Step 1: Redesign while keeping both links live**

Links must remain `href="../logs/stratux.log"` and `href="../logs/"` with `target="_blank"`. Keep `{{userAgent}}` and `{{deviceViewport}}` — the prototype hard-codes these, which is a defect.

- [ ] **Step 2: Run the checker** — `node dev/check-contract.mjs` → Logs section passes.

- [ ] **Step 3: Verify** — both links navigate; debug strings are the real values.

- [ ] **Step 4: Commit**

```bash
git add web/plates/logs.html
git commit -m "feat: redesign logs screen"
```

---

### Task 9: Developer screen

**Files:**
- Modify: `web/plates/developer.html`

**Interfaces:**
- Consumes: §5.4 `DeveloperCtrl` bindings and handlers; prototype `DeveloperScreen`.

- [ ] **Step 1: Redesign the four panels**

Keep `<div ui-content-for="title">Developer</div>`. Keep all six handlers (`postRestart`, `postDownloadLog`, `postDeleteLog`, `postDownloadAHRSLogs`, `postDeleteAHRSLogs`, `postDownloadDB`) and both size bindings. **Delete actions stay unconfirmed** (§5.8 defect 8 — preserve, do not "fix").

- [ ] **Step 2: Run the checker** → Developer section passes.

- [ ] **Step 3: Verify** — reach `#/developer` directly (the menu item is DeveloperMode-gated).

- [ ] **Step 4: Commit**

```bash
git add web/plates/developer.html
git commit -m "feat: redesign developer screen"
```

---

### Task 10: Radar screen

**Files:**
- Modify: `web/plates/radar.html`

**Interfaces:**
- Consumes: §5.4 `RadarCtrl` bindings; §6.6 checklist; prototype `RadarScreen`.
- Produces: the chrome around `<div id="radar_display">` — the scope itself is SVG created by `radar.js` and must not be reimplemented.

- [ ] **Step 1: Rebuild the chrome only**

Keep `id="radar_display"` untouched. Keep the `ConnectState`, `BaroAltValid`, `GPSValid`, `CPUTemp` badges — and style **all** their states: `Baro-Alt` / `No Baro-Alt, using GPS-Alt` / `No Baro-Alt, using ADSB` / `No Altitude!` / `No GPS!`, and CPU temp tiers (info < 70, warning 70–79, danger ≥ 80).

- [ ] **Step 2: Verify the controller still drives the scope**

Load `#/radar` and confirm the SVG scope renders with rings, own-ship, contacts, trails, and the Ra−/Ra+/Alt−/Alt+/F/S/sound controls.

**Note (§6.6):** bearingless circles, trails, and the four-state sound button are drawn by `radar.js`, which is frozen. They exist already — this task's job is to confirm they render and that the chrome doesn't cover them. If any are genuinely missing, stop and raise it; the fix is not in the template.

- [ ] **Step 3: Run the checker** → Radar section passes, `radar_display` present.

- [ ] **Step 4: Verify in both themes** — the scope is black-backed; confirm the surrounding chrome doesn't clash or wash out.

- [ ] **Step 5: Commit**

```bash
git add web/plates/radar.html
git commit -m "feat: redesign radar chrome with full state badges"
```

---

### Task 11: Settings — core panels

**Files:**
- Modify: `web/plates/settings.html`

**Interfaces:**
- Consumes: §5.4 `SettingsCtrl` bindings/handlers/input-directives; §6.3 first nine bullets; prototype `SettingsScreen`.
- Produces: the modal block consumed by Task 12.

- [ ] **Step 1: Rebuild the panel structure**

Panels in a two-column layout: AHRS, Commands, Theme, Tracker Configuration, Configuration, WiFi Settings. Keep every field from §6.3 and all `ng-model` names.

- [ ] **Step 2: Restore selects over free text**

WiFi Mode (3 options), WiFi Country (`countryCodes`), WiFi Channel (1–11), SDR Dump 1090 ES Gain (28 discrete values, `37.2 DEFAULT`), Tracker Address Type. Keep every input-validation directive (`hex-input`, `watchlist-input`, `ssid-input`, `wpa-input`, `pin-input`, `ip-list-input`, `ip-addr-input`, `g-limits-input`, `pilotname-input`, `ognreg-input`).

- [ ] **Step 3: Restore conditional rows and hint text**

`ng-show` on `BMP_Sensor_Enabled` (Pressure Altitude Offset), `IMU_Sensor_Enabled` (fan duty, AHRS buttons disabled), `Pong_Enabled` (Pong updater), `visible_serialout` (Baud), `hasTracker` (whole Tracker panel), `WiFiMode` branches (Channel/Pin/Security/Passthrough/client networks), `gpsHardwareCode` (13/15). Add all hint text from §6.3.

- [ ] **Step 4: Restore the WiFi client-network list**

Add/Remove buttons plus repeatable `WiFiClientNetworks` rows bound to `Network.SSID` / `Network.Password`. Include WiFi-Direct Pin and Internet Passthrough.

- [ ] **Step 5: Run the checker** → Settings section passes.

- [ ] **Step 6: Verify** — load `#/settings`, confirm each conditional row appears/disappears by toggling the relevant fixture setting; both themes.

- [ ] **Step 7: Commit**

```bash
git add web/plates/settings.html
git commit -m "feat: redesign settings core panels with selects and conditional rows"
```

---

### Task 12: Settings — DeveloperMode panels and modals

**Files:**
- Modify: `web/plates/settings.html`

**Interfaces:**
- Consumes: §5.4 modal/shared-state names; §6.3 remaining bullets.

- [ ] **Step 1: Add the DeveloperMode-gated row**

Wrap in `ng-show="DeveloperMode"`: **Hardware** panel (11 switches + `PWMDutyMin`), **Diagnostics** panel (Show Traffic Source in Callsign, Verbose Message Log, Record Replay/Trace/AHRS Logs, Persistent logging + Pong Firmware Update), **Raw Configuration** panel (`<pre>{{rawSettings}}</pre>`).

- [ ] **Step 2: Build all modals under `ui-content-for="modals"`**

`modalReboot`, `modalRebootRequired`, `modalShutdown`, `modalCalibrateForward`, `modalCalibrateDone`, `modalCalibrateFailed` (with `{{Orientation_Failure_Message}}`), `modalSuccessWiFi`, `modalErrorWiFi`, `modalCancelWiFi`, plus the `rebooting` / `shuttingdown` status banners. Each with `ui-if` + `ui-state` + `ui-turn-off`.

**Note:** the dead `WiFiRestart` banner is dropped (§4), not implemented.

- [ ] **Step 3: Run the checker** → Settings section passes.

- [ ] **Step 4: Verify**

Open each modal from its trigger: Reboot, Shutdown, Set AHRS Sensor Orientation (3-step flow), Persistent logging toggle (reboot-required), Submit WiFi Changes (success/error). Confirm DeveloperMode gating hides the row when the fixture sets it false.

- [ ] **Step 5: Commit**

```bash
git add web/plates/settings.html
git commit -m "feat: add settings developer panels and modal flows"
```

---

### Task 13: Help partials

**Files:**
- Modify: `web/plates/*-help.html` (nine files; no `map-help.html` exists)

**Interfaces:**
- Consumes: §6.8 second bullet — the non-negotiable help content list.
- Produces: `helppage` targets already set by each controller.

- [ ] **Step 1: Preserve every help partial's substance**

Do not reduce them to one sentence. Non-negotiable content: traffic-source color/symbol legend (`traffic-help.html`), G/S/R constellation prefixes and ✅ meaning (`gps-help.html`), "reference only — must not be used for flight operations" (`gps-help.html`), AHRS calibration procedure (`settings-help.html`), fan-duty tuning, alarm-circle explanation (`radar-help.html`), 60-second current-vs-peak definition (`status-help.html`).

- [ ] **Step 2: Correct mismatched headings**

§5.8 defect 2: align `settings-help.html` section names with the rendered panel headings.

- [ ] **Step 3: Verify the Map page still resolves help**

Map uses `helppage = 'plates/radar-help.html'` — there is no `map-help.html`. Confirm `#/map` Help still opens (§5.8 defect 1 is a known limitation, not this task's to fix).

- [ ] **Step 4: Run the checker** → no regressions elsewhere.

- [ ] **Step 5: Commit**

```bash
git add web/plates/*-help.html
git commit -m "feat: restyle help partials preserving operational content"
```

---

### Task 14: AppCache repair

**Files:**
- Modify: `web/stratux.appcache`

**Interfaces:**
- Consumes: §5.8 defect 10 — the list of missing assets.
- Produces: a checker pass on the AppCache rule (Review Focus 5).

- [ ] **Step 1: Read the checker's current AppCache failures**

Run: `node dev/check-contract.mjs`
Expected: this is the last of the Task 1 baseline failures.

- [ ] **Step 2: Add every missing asset**

All `.css` and `.js` under `web/` (including `css/dark-mode.css`, `css/map.css`, `css/radar.css`, `css/ol*.css`, `plates/js/radar.js`, `map.js`, `developer.js`, `ahrs.js`, `js/ol.js`, `olms.js`, `ol-layerswitcher.js`, `NoSleep.min.js`), all plates and help partials, `alert.wav`, `img/actype/*.svg`.

- [ ] **Step 3: Run the checker**

Run: `node dev/check-contract.mjs`
Expected: **zero failures** — the full baseline is cleared.

- [ ] **Step 4: Commit**

```bash
git add web/stratux.appcache
git commit -m "fix: complete the appcache manifest"
```

---

### Task 16: Radar redesign (runs inside Task 15, before Step 6)

Added during Task 15 Step 2a at the user's request. Design:
`docs/superpowers/specs/2026-10-14-radar-redesign-design.md`. Plan:
`docs/superpowers/plans/2026-10-14-radar-redesign.md` (Tasks 16.1–16.4).
Lifts the controller freeze for `web/plates/js/radar.js` only.

### Task 15: Final verification

**Files:** none modified — verification only.

**Interfaces:**
- Consumes: everything above; §6 checklist.

- [ ] **Step 1: Full checker run**

Run: `node dev/check-contract.mjs`
Expected: exit 0, zero failures.

- [ ] **Step 2: Walk all ten screens against §6**

For each screen in §6.3–§6.8, tick every box. Compare side-by-side with the original UI (git stash the redesign, load, unstash) to confirm **no data was lost** — the §6 rule.

- [ ] **Step 2a: Prototype layout comparison**

Measures layout and spacing drift against the v0 prototype at 1024×768 (iPad landscape). Design: `docs/superpowers/specs/2026-10-13-visual-compare-design.md`; tool: `dev/visual-compare/`.

Prerequisites (one-time, none committed):
- Prototype unpacked and built at `/home/dev/code/stratux-aviation-dashboard-prototype` per `docs/superpowers/plans/2026-10-13-visual-compare.md` Task 2 Step 1 (`.next/BUILD_ID` exists).
- In `dev/visual-compare`: `npm install` and `npx playwright install webkit chromium`.
- On a host without the browsers' system libraries and without `sudo`: `bash dev/visual-compare/setup-browser-libs.sh` once, then pass `--browser-root ~/.cache/vc-browser-root` (or set `VC_BROWSER_ROOT`).

Run: `node dev/visual-compare/compare.mjs --prototype /home/dev/code/stratux-aviation-dashboard-prototype`
Exit 0 clean; 1 unexplained drift, missing elements, or map misses; 2 the run could not complete. Findings: `dev/visual-compare/out/report.html`.

Fix loop:
- Fix drift in the templates, or in the shared rules in `web/css/main.css` / `web/css/dark-mode.css`, within the spec's *What a drift fix may change* (R10 and R16 still apply; no controller edits).
- Run `node dev/check-contract.mjs` (exit 0) after every fix.
- Rerun the full comparison after any shared-rule change, not just `--only` the screen being fixed.
- Never edit the tolerances in `dev/visual-compare/lib/tolerances.mjs`.
- A new entry in `dev/visual-compare/accepted-differences.json` needs a one-line reason and a human review before the final run.

Done when the full comparison exits 0.

- [ ] **Step 3: Confirm the two reverts are untouched**

Run: `git diff master -- web/plates/gps.html web/plates/map.html`
Expected: no output. §6.1 — original retained.

- [ ] **Step 4: Both themes, every screen**

Toggle `DarkMode` and load all ten routes. No unreadable text, no element invisible against its background (Review Focus 3).

- [ ] **Step 5: Data-driven screens still live**

With `node dev/server.mjs` running: message bars animate, traffic ages out, satellites list populates, radar contacts move, map shows aircraft (requires `/tiles/tilesets` returning JSON — `dev/README.md`).

- [ ] **Step 6: Commit and report**

```bash
git add -A
git commit -m "feat: complete ui redesign"
```

Report: §6 checklist status, checker output, and `dev/visual-compare/out/report.html` with its paired prototype/reskin screenshots (both themes), attached for the human visual sign-off. This amends R12 for Task 15: the screenshots come from the comparison run, not from Task 2 Step 1.

- [ ] **Step 7: Remove the comparison tool**

After the human sign-off:
1. On `ui-redesign`, in one commit, delete `dev/visual-compare/`, `docs/superpowers/specs/2026-10-13-visual-compare-design.md`, and `docs/superpowers/plans/2026-10-13-visual-compare.md`.
2. Run `git diff c24d64df --stat` and confirm it lists none of them.

**Then:** only committed work reaches an image. Build with `image_build/build.sh` (submodules must be initialized first: `git submodule update --init --recursive`) and run on the Pi.
