# HINOTORI Hadeck — Stratux UI Redesign Work Handoff

## Session Status
- **Current branch:** `ui-redesign` (worktree: `C:\Users\Russell\.local\share\opencode\worktree\42acaf\ui-redesign`)
- **Merge base (final review):** `c24d64df`
- **Rate limit status:** Session-level rate limit on `cat-jam-free` model — all subagent dispatches blocked. Direct tool calls (edit/shell) functional.
- **Git state:** 12 commits ahead of merge base, working tree clean except Task 11 brief file (gitignored `.superpowers/` dir)

## Completed Tasks (1–10)

| # | Screen | Commit | Key Results |
|---|--------|--------|------------|
| 1 | Contract/checker | `b56f4ae9` | 12 appcache failures baseline; R1–R16 rulings recorded |
| 2 | Design tokens | `a2d29115` → `db81db00` | 119/119 `sx-` classes ported; R13 gap-detection hardened |
| 3 | Shell (`index.html`) | `697285ce` → `cea54b21` | `ui-toggle="uiSidebarRight"` restored; power button to `/shutdown` |
| 4 | Status screen | `ba25b20f` → `6d19b04e` | Fabricated badge removed; Pong-heartbeats guard restored |
| 5 | Traffic screen | `6d19b04e` → `6a9333a4` | Column shift fixed cell-by-cell; 4 toggles on correct scope names |
| 6 | Weather screen | `6a9333a4` → `91c54676` | Badge styling (all 7 `sx-` classes defined in `main.css:141–181`); staleness anchor changed from `watch_list[0]` to `data_list[0]` (Important finding: Watching-section colour structurally inert due to 30-min purge vs 60-min window — SDD record amended) |
| 7 | Towers screen | `a5e99861` | Dedicated headers (Location/Current Power[dB]/Avg Power[dB]/Max Power[dB]/Msgs Last Minute); `sx-table-wrap` > `table`/`th`/`td` |
| 8 | Logs screen | `f7fe44e3` | Both links live (`../logs/stratux.log` & `../logs/`); `{{userAgent}}`/`{{deviceViewport}}` preserved |
| 9 | Developer screen | `cfcb0b07` | All 6 handlers preserved; delete actions intentionally unconfirmed (§5.8 defect 8) |
| 10 | Radar screen | `400acb4f` | SVG scope container (`#radar_display`) untouched; all badge states (Baro-Alt through No GPS!) and CPU temp tiers preserved |

## Gate Status (All Tasks)
Every task's `node dev/check-contract.mjs` outputs **exactly 12 failures, all `appcache`** — the known manifest gap. No new failures, no missing-binding, no banned CSS, no property-parity failures introduced. Exit code 1 is the pre-existing appcache baseline.

## Pending Tasks (11–15)

### Task 11: Settings core panels (`web/plates/settings.html`)
- **Brief:** `task-11-brief.md` (gitignored in `.superpowers/`)
- **What remains:** Convert Bootstrap panel/grid structure (`panel-group`/`.panel`/`.panel-heading`/`.panel-body`/`.col-xs-12` etc.) to `sx-` class namespaced structure, preserving:
  - Six panels in two-column layout (Left: AHRS, Commands, Theme; Right: Tracker Configuration, Configuration, WiFi Settings)
  - All 11 input validation directives (`hex-input`, `watchlist-input`, `ssid-input`, `wpa-input`, `pin-input`, `ip-list-input`, `ip-addr-input`, `g-limits-input`, `pilotname-input`, `ognreg-input` plus the original set)
  - All conditional rows with `ng-show` (`BMP_Sensor_Enabled`, `IMU_Sensor_Enabled`, `Pong_Enabled`, `visible_serialout`, `hasTracker`, `WiFiMode` branches, `gpsHardwareCode` 13/15)
  - WiFi client-network list with Add/Remove buttons, rows bound to `Network.SSID`/`Network.Password`, WiFi-Direct Pin, Internet Passthrough
  - The DeveloperMode area (ng-show DeveloperMode row with Hardware/Diagnostics/Raw Configuration panels)
- **R16 constraints:** Only `web/plates/settings.html` may change. No controller, stylesheet, or asset edits. `sx-` classes only. No `gap`, `:has()`, `aspect-ratio`, `backdrop-filter`, `position: sticky`, remote webfonts.
- **Gate:** `node dev/check-contract.mjs` → 12 appcache failures baseline, no new failures.
- **Report target:** `.superpowers/sdd/2026-10-13-stratux-ui-redesign/task-11-report.md`

### Task 12: Settings — DeveloperMode panels and modals (`web/plates/settings.html`)
- **Brief:** `task-12-brief.md` (gitignored in `.superpowers/`)
- **What remains:** Add the modal block under `ui-content-for="modals"` with all required modals, and the DeveloperMode-gated row in the plate:
  - **Modals** (each with `ui-if` + `ui-state` + `ui-turn-off`):
    - `modalReboot` — Reboot trigger; 3-step confirmation flow
    - `modalRebootRequired` — Reboot with unsaved changes
    - `modalShutdown` — Shutdown trigger
    - `modalCalibrateForward` — Set AHRS Sensor Orientation (3-step flow)
    - `modalCalibrateDone` — Calibration completion
    - `modalCalibrateFailed` — With `{{Orientation_Failure_Message}}`
    - `modalSuccessWiFi` — Submit WiFi Changes success
    - `modalErrorWiFi` — Submit WiFi Changes error
    - `modalCancelWiFi` — Submit WiFi Changes cancel
    - `rebooting` / `shuttingdown` status banners
  - **DeveloperMode-gated row:** After WiFi Settings, wrap Hardware/Diagnostics/Raw Configuration panels in `ng-show="DeveloperMode"`
- **R16 constraints:** Only `web/plates/settings.html` may change. No controller, stylesheet, or asset edits. `sx-` classes only. No banned CSS patterns.
- **Gate:** `node dev/check-contract.mjs` → 12 appcache failures baseline, no new failures.
- **Report target:** `.superpowers/sdd/2026-10-13-stratux-ui-redesign/task-12-report.md`

### Task 13: Help partials
- **Files:** nine `*-help.html` files (no `map-help.html` exists — §6.8 defect 1)
- **§6.8 second bullet:** Non-negotiable help content list (traffic-source legend, G/S/R constellation, AHRS calibration, fan-duty tuning, alarm-circle explanation, 60-second current-vs-peak definition)
- **§5.8 defect 2:** Align `settings-help.html` section names with rendered panel headings
- **Gate:** Checker passes with 12 appcache failures; visual pass is human-only (no browser available)

### Task 14: AppCache repair
- **Files:** `web/stratux.appcache`
- **Goal:** Enumerate every first-party `.css`, `.js`, `.html` asset used by the redesign so the checker exits 0 for the first time
- **Current baseline:** 12 appcache failures (all assets listed above plus some vendor files)
- **R4:** Any new CSS file created in Tasks 2–12 must be added to appcache in the same commit
- **Gate:** `node dev/check-contract.mjs` → exit 0 (first time at Tasks 14–15)

### Task 15: Final verification
- **Step 1:** Full checker run → exit 0
- **Step 2:** Walk all ten screens against §6 checklist — compare side-by-side with original (git stash redesign, load, unstash) to confirm no data lost
- **Step 3:** Confirm GPS (`gps.html`) and Map (`map.html`) reverts untouched against `master`
- **Step 4:** Both themes, every screen — toggle DarkMode, load all ten routes
- **Step 5:** Data-driven screens live — message bars animate, traffic ages out, satellites list populates, radar contacts move, map shows aircraft (requires `/tiles/tilesets` returning JSON)
- **Step 6:** Commit and report — `git add -A`; `git commit -m "feat: complete ui redesign"`; report with checker output and before/after screenshots (human pass)
- **Then:** Build image with `image_build/build.sh` (submodules initialized: `git submodule update --init --recursive`) and run on Pi

## Rulings (R1–R16) — Quick Reference
- **R1:** Checker `cssBannedHits` must detect `gap` only inside flex/grid fixtures; `a{display:flex;gap:8px}` → 1 hit, `a{display:grid;gap:8px}` → 0 hits
- **R2:** Banned-CSS scan covers first-party stylesheets only (`main.css`, `dark-mode.css`, `ahrs.css`, `map.css`, `radar.css`); vendored third-party CSS excluded
- **R3:** Checker asserts toggle *interface* (`ng-model` names `showReg`, `showSquawk`, `showCategory`, `RelDist`), never the `ui-switch` element
- **R4:** Task 2 modifies only the two existing stylesheets (`main.css`/`dark-mode.css`). New CSS files must be added to `web/stratux.appcache` in same commit
- **R5:** Task 11 preserves every existing modal block and DeveloperMode panel verbatim from original `settings.html`; Task 12 restyles them
- **R6:** Task 15 Step 3 diffs `gps.html`/`map.html` against merge-base `c24d64df`, not `master`
- **R7:** After Task 2, carry `main.css` component-class inventory into dispatches for Tasks 3–12
- **R8:** Task 2 appends to `main.css`/`dark-mode.css`; never replaces existing rules
- **R9:** `@font-face` ban only fires on absolute `http(s)` src; local FontAwesome at `main.css:262` stays
- **R10:** New component classes are `sx-` prefixed; never redefine `.panel*`/`.badge`/`.row`/`.col-*`/`.btn*`/`.form-group`/`.modal*`/`.active`/`.switch`
- **R11:** Per-task gate = "no new failures vs baseline"; exit 0 only at Tasks 14–15
- **R12:** Verification is structural; no screenshots. Checker + HTTP fetch of already-running dev server (`http://127.0.0.1:8080/plates/<screen>.html`)
- **R13:** Checker must detect flex `gap` split across rules (not same-block scan)
- **R14:** AppCache repair (Task 14) makes checker exit 0 for first time
- **R15:** Power button must genuinely reach `/shutdown` behind a confirmation; no controller edit (uses `main/managementinterface.go:618` `handleShutdownRequest`)
- **R16:** Screen-task pattern (Tasks 6–13): modify only the named template; every original `id` and `ng-*` condition survives; `sx-` classes only; no stylesheet edits; gate = 12 appcache failures

## Current File Changes (vs. merge base `c24d64df`)
- `web/plates/status.html` — redesigned (Tasks 4)
- `web/plates/traffic.html` — redesigned (Task 5)
- `web/plates/weather.html` — redesigned (Task 6) + anchor fix commit `5482eb11`
- `web/plates/towers.html` — redesigned (Task 7) commit `a5e99861`
- `web/plates/logs.html` — redesigned (Task 8) commit `f7fe44e3`
- `web/plates/developer.html` — redesigned (Task 9) commit `cfcb0b07`
- `web/plates/radar.html` — redesigned (Task 10) commit `400acb4f`
- `web/plates/settings.html` — partially redesigned (Tasks 11–12 in progress)
- `docs/superpowers/sdd/2026-10-13-stratux-ui-redesign/progress.md` — live ledger with rulings R1–R16 and deferred-minor ledger
- `.superpowers/` directory — gitignored (contains task briefs, reports, ledger, SDD)

## Handoff Instructions for Next Agent
1. **Rate limit will clear** — subagent dispatches will become functional again
2. **Start with Task 11** — the Settings core panels brief (`task-11-brief.md`) is ready; convert the Bootstrap panel grid to `sx-` classes while preserving all bindings, conditional rows, and the DeveloperMode area
3. **Proceed to Task 12** — add the modal block with all 9 modals + status banners under `ui-content-for="modals"`, and the DeveloperMode-gated row
4. **Complete Tasks 13–15** — Help partials (Task 13), AppCache repair (Task 14), Final verification (Task 15)
5. **Final whole-branch review** at merge base `c24d64df` using `finishing-a-development-branch`
6. **Build image** with `image_build/build.sh` (submodules initialized) and run on Pi
7. **Key invariants to maintain:**
   - All completed tasks pass gate at exactly 12 appcache failures
   - No controller edits (`web/js/main.js`, `web/plates/js/*.js` are frozen)
   - No stylesheet edits (R10: `sx-` classes only; banned CSS patterns avoided)
   - Every `id` and `ng-*` condition from original templates survives
   - AppCache repair in Task 14 is what finally clears the 12 failures to exit 0

## Contact / Context
- **Designer agent:** No repo/CSS access — all design prompts must be self-contained
- **Browser floor:** 2015-era tablets
- **Dev server:** Already running on `:8080` (do not start a second server — port is bound)
- **Go build:** Does not work on Windows by design — do not run `go build` or `go test`
- **`make`:** Not installed on this machine — verification uses `node dev/check-contract.mjs` only
- **Shell:** Use `C:\Program Files\Git\bin\bash.exe --noprofile --norc`; any other `bash` on PATH is WSL and will misresolve `.git`

---
*This handoff document was auto-generated on 2026-10-13 as part of the Stratux UI redesign work loop. The remaining work (Tasks 11–15) follows the same R16-clean, `sx-` class-only pattern established by completed Tasks 1–10.*