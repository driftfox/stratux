# Radar redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Radar screen to the prototype's look — full-bleed dark instrument, round scope, control bar below — keeping every radar behaviour and the pre-redesign contact labels.

**Architecture:** `radar.html` becomes a full-height flex column (chip strip, square scope stage, HTML control bar). The scope disc (border + radial gradient) is CSS on `#radar_display`; `radar.js` draws rings, crosshair, letters, ownship and traffic into a square SVG over it, and exposes the range/band/sound/full-screen controls on `$scope` instead of drawing them.

**Tech Stack:** AngularJS 1.x, svg.js (already loaded), plain CSS; Playwright WebKit via `dev/visual-compare/lib/browser.mjs` for the check harness.

**Spec:** `docs/superpowers/specs/2026-10-14-radar-redesign-design.md` (Task 16 of `docs/superpowers/plans/2026-10-13-stratux-ui-redesign.md`).

## Global Constraints

- Controller freeze lifted for `web/plates/js/radar.js` only; no other `web/js/*.js` or `web/plates/js/*.js` edits.
- Files in play: `web/plates/radar.html`, `web/plates/js/radar.js`, `web/plates/radar-help.html`, `web/css/radar.css`, `web/css/main.css`; plus `dev/visual-compare/elements.mjs` and `accepted-differences.json` in Task 16.4.
- `id="radar_display"` stays. `node dev/check-contract.mjs` exits 0 after every task (help must keep "green circle", "rough estimation", "whenever an aircraft is within the inner circle").
- Banned CSS: flex `gap`, `inset`, `aspect-ratio`, `color-mix`, `:has`, `sticky`, `backdrop-filter`, 8-digit hex, network fonts.
- New `main.css` classes are `sx-` prefixed; never redefine `.active`, `.btn*`, `.panel*`, `.badge` (use `sx-on` for active state).
- Control buttons ≥ 44px tall.
- Instrument dark in both themes; instrument colours are literal palette values, not theme variables.
- Geometry: 200 SVG units = `DisplayRadius`; outer ring r=200, inner dashed ring r=100 (alarm radius). Contact and bearingless-circle maths unchanged.
- Behaviour unchanged: alerts, alarm counts, hysteresis, speech text, sound cycle `BpSp → Beep → Spch → SnOff` (Spch skipped without `speechSynthesis`), range steps 2/5/10/20/40, bands 5/10/20/50/100/500 (×100 ft), `communicateLimits` POST, track-up rotation, traces, stale cleanup.
- Palette (spec): disc border `#9eb3b5`; disc radial `#0e222a` 0–1% → `#081116` 62% → `#050708`; crosshair `#50666a` opacity .55; rings `#6c8586`; letters `#c2d0c9`; ownship `#5aa3f5`; contact symbol and alt-diff `#f1d26d`; speed/tail `#b7c9c7`; readouts `#e4ca66` 13px monospace; bearingless circle green `#36bd71`.

## Review Focus

1. **Portrait / narrow screens** (768×1024, 375×667): scope width-limited and still square, control bar wraps without overflowing the screen → harness `portrait` case in Task 16.1.
2. **Window resize and drawer open/close**: scope re-squares without reload → harness `resize` case in Task 16.1.
3. **No `speechSynthesis`** (WebKit test browser, some tablets): sound button still cycles and never shows `Spch` → harness `sound` case in Task 16.3.
4. **Server echo of limits** (`onSettingsMessage` on `/radar` messages with `RadarRange`/`RadarLimits`): readouts follow the server value, not only clicks → harness `echo` case in Task 16.3.
5. **Leaving and re-entering Radar**: no duplicate SVG, readouts and sound label correct on second visit → harness `reenter` case in Task 16.3.

---

### Task 16.1: Full-bleed layout and square scope

**Files:**
- Create (untracked, workspace): `.superpowers/sdd/2026-10-13-stratux-ui-redesign/radar-check.mjs`
- Modify: `web/plates/radar.html`, `web/css/main.css` (radar block near `.sx-instrument`, ~line 1317), `web/plates/js/radar.js` (`RadarRenderer` constructor viewBox, `RadarRenderer.prototype.resize`)

**Interfaces:**
- Produces: DOM `div.sx-radar-screen` > `div.sx-instrument-top` (badges) + `div.sx-radar-stage` > `div#radar_display.sx-radar-disc` + `div.sx-instrument-controls` (empty until 16.3). SVG viewBox `-211 -211 422 422`. `RadarRenderer.prototype.resize()` sets `#radar_display` `style.width`/`style.height` to `min(stage.clientWidth, stage.clientHeight)` px; bound to `window` `resize` and `orientationchange`, unbound on `onExit`.
- Produces: harness `node radar-check.mjs [case...]` — starts its own dev server via `startDevServer({ port: 8093 })` from `dev/visual-compare/lib/servers.mjs`, launches WebKit via `launchBrowser({ browserRoot: ~/.cache/vc-browser-root })`, prints `PASS <case>` / `FAIL <case>: <reason>`, exits 1 on any FAIL.

- [ ] **Step 1: Write harness cases `layout`, `portrait`, `resize`**

`layout` (1024×768, `#/radar`, after 4 s): no `.sx-crumb` and no `.sx-title-row` in the view; `.sx-radar-screen` top = header bottom (68) ±1 and bottom = 768 ±1, width = 1024 − scrollbar ±1; `#radar_display` width = height ±1, horizontally centred in `.sx-radar-stage` ±1, size = min(stage w, h) ±1; its SVG `viewBox` attribute is `-211 -211 422 422`; `.sx-radar-screen` background in light theme is dark (luminance of computed background < 0.1).
`portrait` (768×1024 and 375×667): same square/centred assertions; `.sx-radar-screen` right edge ≤ viewport width.
`resize`: load at 1024×768, set 800×600, wait 300 ms, square/centred assertions hold with the new stage size.

- [ ] **Step 2: Run `node .superpowers/sdd/2026-10-13-stratux-ui-redesign/radar-check.mjs layout portrait resize`** — Expected: FAIL (breadcrumb present, viewBox `-201 -201 402 302`).

- [ ] **Step 3: Restructure `radar.html`** — drop `.sx-crumb`, `.sx-content`, `.sx-title-row`; keep every badge `<span>` and its `ng-show`/`ng-hide`/`ng-class` verbatim inside `.sx-instrument-top`; add `.sx-radar-stage` around `#radar_display` (add class `sx-radar-disc`, remove `sx-radar-display`) and an empty `.sx-instrument-controls`.

- [ ] **Step 4: CSS in `main.css`** — `.sx-radar-screen`: dark instrument (`background:#070b0f`, border `#283844`), `height:calc(100vh - 68px)`, flex column; stage `flex:1` with `min-height:0`, centring its child; `.sx-radar-disc`: `border-radius:50%`, 1px `#9eb3b5` border, the spec's radial gradient (with a `-webkit-` prefixed copy and a solid `#081116` fallback first); full-screen rules `.sx-radar-screen:-webkit-full-screen, .sx-radar-screen:fullscreen { height:100%; width:100% }`. Remove the now-unused `.sx-radar-display` rule and the breadcrumb-era `sx-instrument` min-height for this screen.

- [ ] **Step 5: `radar.js`** — viewBox `(-211, -211, 422, 422)`; drop the 402×402 `blackRect` background; rewrite `resize()` per Interfaces; call it once after construction and on `resize`/`orientationchange`; remove those listeners in `onExit`.

- [ ] **Step 6: Run the harness cases and `node dev/check-contract.mjs`** — Expected: `PASS layout`, `PASS portrait`, `PASS resize`; `Contract check: PASS`.

- [ ] **Step 7: Commit** — `git add web/plates/radar.html web/css/main.css web/plates/js/radar.js && git commit -m "feat(radar): full-bleed instrument with a square scope"`

### Task 16.2: Scope drawing to the prototype look

**Files:**
- Modify: `web/plates/js/radar.js` (`RadarRenderer` constructor drawing; `checkCollisionVectorValid` symbol/label classes only if needed), `web/css/radar.css`

**Interfaces:**
- Consumes: 16.1 viewBox and disc.
- Produces: SVG classes `.radar .ring` (r=200 solid, r=100 dashed via `.ring-inner`), `.radar .crosshair`, `.radar .textDir`, `.radar .centerplane`, `.radar .textFL` (FL label centred at (0, 24)). `this.fl` remains the FL text element `update()` writes to. `this.displayText` and `this.altText` are removed from the SVG (16.3 moves them to the bar).

- [ ] **Step 1: Add harness case `scope`** — at 1024×768: exactly one `circle.ring` with r=200 and one with r=100 whose computed `stroke-dasharray` ≠ `none`; two `line.crosshair` spanning the disc through (0,0); four `text.textDir` reading N, E, S, W with fill `rgb(194, 208, 201)`; `.centerplane` fill `rgb(90, 163, 245)`; `.textFL` exists, matches `/^FL-?\d+$/`, and its bbox centre x is within 2 units of 0 and below the ownship; at least one `.plane` with fill `rgb(241, 210, 109)`; `.textPlane` computed font-size equals 1.8 × the SVG root font-size and fill `rgb(241, 210, 109)`; `.textPlaneSmall` and `.textPlaneReg` 0.8 × with fill `rgb(183, 201, 199)`; at least one `.greenCirc` with stroke `rgb(54, 189, 113)` and `stroke-dasharray` `none`; no `text` reading `nm` or `00ft` inside the SVG; no element with class `zoom` or `zoomInvert`.

- [ ] **Step 2: Run `radar-check.mjs scope`** — Expected: FAIL.

- [ ] **Step 3: Drawing** — rings and crosshair in `radarAll` (static, not rotated with the card); letters stay in `card` at today's ±190 positions (rotate with track-up as today); ownship path recoloured; FL text moved under ownship; remove the `displayText`/`altText` SVG texts and every SVG control group (zoom in/out, alt more/less, fullscreen, speech) — their logic moves to 16.3.

- [ ] **Step 4: `radar.css`** — restyle per palette: contacts, alt-diff `#f1d26d` with the outline copies (`textPlaneOut`, `textCOut`, `textRegOut`) stroked `#050708` instead of white; speed/tail `#b7c9c7`; bearingless `greenCirc` `#36bd71` solid; `trace` `#6c8586` dashed. Keep every label font-size as today. Delete the dead `zoom*`/`textZoom*`/`tSmall*`/`blackRect`/white `card`/`circle` fills.

- [ ] **Step 5: Run `radar-check.mjs layout scope` and the contract check** — Expected: both PASS; contract PASS.

- [ ] **Step 6: Commit** — `git commit -m "feat(radar): prototype scope drawing with the original contact labels"`

### Task 16.3: Control bar and help text

**Files:**
- Modify: `web/plates/radar.html` (`.sx-instrument-controls`), `web/plates/js/radar.js`, `web/css/main.css` (`.sx-instrument-controls` block ~line 1464), `web/plates/radar-help.html`

**Interfaces:**
- Consumes: 16.2 removal of SVG controls.
- Produces on `RadarCtrl` `$scope`: `radarRangeDown()`, `radarRangeUp()`, `radarBandDown()`, `radarBandUp()`, `radarFullScreen()`, `radarSoundCycle()`; readouts `radarRangeText` (e.g. `"10 nm"`), `radarBandText` (e.g. `"±2000ft"`), `radarSoundLabel` (`BpSp|Beep|Spch|SnOff`), flags `radarSoundOn` (soundType ≠ 3), `radarFullScreenOn`. Readouts are refreshed inside `RadarRenderer.prototype.update()` (which already runs on limit changes, including `onSettingsMessage` echoes) and on controller start.

- [ ] **Step 1: Add harness cases `controls`, `sound`, `echo`, `reenter`, `fullscreen`**

`controls`: buttons in `.sx-instrument-controls` read, in order, `Ra−`, `Ra+`, `Alt−`, `Alt+`, `F/S`, then the sound label; readouts `10 nm` (between Ra buttons) and `±2000ft` (between Alt buttons); every button height ≥ 44; bar bottom ≤ viewport bottom. Click `Ra−` → `5 nm` and a POST to `/setSettings` whose JSON has `RadarRange: 5`; `Ra+` twice → `20 nm`; `Alt+` → `±5000ft`; `Alt−` twice → `±1000ft`. Instrument colours: button text and readout colour unchanged between light and dark theme.
`sound`: record `window.speechSynthesis` presence; click the sound button 4 times, collecting labels; with synthesis the sequence from start follows `SnOff→BpSp→Beep→Spch→SnOff`, without it `Spch` never appears and `Beep→SnOff→BpSp→Beep` holds from the initial label; the button has class `sx-on` exactly when the label ≠ `SnOff`.
`echo`: route `/radar` WebSocket is not interceptable, so instead evaluate `onSettingsMessage({RadarLimits: 5000, RadarRange: 40}); radar.update();` then trigger a digest; readouts become `40 nm` / `±5000ft`.
`reenter`: navigate `#/radar` → `#/status` → `#/radar`; exactly one `svg` under `#radar_display`; readouts and sound label present.
`fullscreen`: init script stubs `Element.prototype.requestFullscreen` and `webkitRequestFullScreen` to record `this`; click `F/S` → recorded element is `.sx-radar-screen` and the button has `sx-on`.

- [ ] **Step 2: Run the five cases** — Expected: FAIL.

- [ ] **Step 3: `radar.js`** — move the four step `switch`es (unchanged values), the full-screen toggle (target: the `.sx-radar-screen` element), and the sound cycle into the `$scope` functions above; `displaySoundStatus(mode)` keeps its spoken confirmations and sets `radarSoundLabel`/`radarSoundOn` instead of SVG classes (no utterance on the first call, as today); `update()` sets `radarRangeText`/`radarBandText`.

- [ ] **Step 4: `radar.html` and CSS** — buttons and `<strong>` readouts in the prototype order with `ng-click`/`ng-class="{'sx-on': …}"`; `.sx-instrument-controls` centred, wrapping, 8px spacing via `> * + *` margins; buttons transparent with 1px `#283844` border, text `#eaf3f5`, 44px min-height; `sx-on` fills `#eaf3f5` with dark text; readouts `#e4ca66` 13px monospace, min-width 70px, centred.

- [ ] **Step 5: Help text** — `radar-help.html`: "buttons left and right of the radar" → "buttons below the radar"; "red aircraft symbols" → "yellow aircraft symbols"; keep the three contract phrases.

- [ ] **Step 6: Run all harness cases and the contract check** — Expected: every case PASS; contract PASS.

- [ ] **Step 7: Commit** — `git commit -m "feat(radar): control bar below the scope"`

### Task 16.4: Comparison and sign-off material

**Files:**
- Modify: `dev/visual-compare/elements.mjs` (radar entries ~line 152–155), `dev/visual-compare/accepted-differences.json`

- [ ] **Step 1: Map** — point `radar.scope` (reskin side) at `#radar_display` (unchanged id) and `radar.badges` at `.sx-instrument-top`; add `radar.controls` → prototype `.instrument-controls`, reskin `.sx-instrument-controls` (fixed).
- [ ] **Step 2: Run `node dev/visual-compare/compare.mjs --prototype /home/dev/code/stratux-aviation-dashboard-prototype --browser-root ~/.cache/vc-browser-root --only radar`** — record every radar failure.
- [ ] **Step 3: Classify** — failures explained by the full-bleed layout (positions/sizes of badges, scope, controls) get entries with reason `full-bleed radar (user ruling)`; anything else is drift to fix in 16.1–16.3 CSS. Entries are presented to the user with the Task 15 list before the final run.
- [ ] **Step 4: Screenshots** — light and dark `radar` reskin vs prototype from `dev/visual-compare/out/screenshots/` for the user, plus the harness output.
- [ ] **Step 5: Commit** — `git commit -m "chore(dev): map the redesigned radar in the layout comparison"`
