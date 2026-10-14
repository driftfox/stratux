# Prototype layout comparison — design

**Status:** design, awaiting approval
**Branch:** `ui-redesign-visual-compare` (worktree `/home/dev/code/stratux-visual-compare`), off `ui-redesign` at `0f0d53f`
**Lifetime:** temporary. Everything this document describes — the tool, its
allow-list, and this document — is deleted before the redesign PR is opened.

## 1. Intent

The UI redesign (`docs/superpowers/specs/2026-10-13-stratux-ui-redesign.md`)
translated an approved v0 prototype into the AngularJS templates in `web/`.
Every gate so far (`dev/check-contract.mjs`) checks that the *original* UI's
bindings, data, and CSS constraints survived. Nothing checks that the result
looks like the prototype it was translated from. This tool closes that gap for
one concern: **layout and spacing drift**.

It runs once, during the redesign plan's Task 15 (final verification). Drift it
finds is fixed until the run is clean. Its paired screenshots replace the
before/after screenshots Task 15 Step 6 asks for, and are what a human reviews
for the final visual sign-off. This amends redesign ruling R12 ("no
screenshots") for Task 15 only.

## 2. Goals

- Measure layout and spacing of the reskin against the prototype, screen by
  screen, in both themes, and report every element outside tolerance.
- Ignore text content. The prototype shows hard-coded sample data; the dev
  server streams fixture data. Different strings must not register as drift.
- Exit non-zero while any unexplained drift remains; exit 0 when every
  difference is within tolerance or on the accepted-differences list.
- Produce paired screenshots (prototype | reskin, light and dark) for manual
  comparison.

## 3. Non-goals

- Colour and typography accuracy. Out of scope except where they change
  geometry (a font-size change that alters a box's size *is* caught, as size).
- Data completeness. `check-contract.mjs` and the §6 checklist own that.
- GPS/AHRS/G-Meter and Map. Their original design was retained (redesign spec
  §6.1); there is no prototype layout to match.
- Phone or portrait layouts.
- Running in CI, or being runnable by anyone without the prototype zip.

## 4. Anti-goals

- **Loosening a tolerance to make a failure go away.** Tolerances are fixed
  before the first run. A failure is resolved by fixing the reskin or by
  adding an accepted-difference entry with a reason — never by editing the
  numbers.
- **Editing `web/` for the tool's sake.** No `data-testid` attributes, no
  hooks. Elements are located with selectors that already exist.
- **Making the reskin reproduce prototype defects.** The redesign deliberately
  fixed several (§5). Those are accepted differences, not drift.
- **Tool artifacts that outlive the branch.** The tool and its files live only
  in `dev/visual-compare/` and this document. No root `.gitignore` edits, no
  `package.json` at the repo root or under `web/`. Drift fixes in `web/` and
  plan edits are real redesign work and stay.

## 5. Decisions

### What a drift fix may change

Redesign ruling R16 is relaxed for Task 15 fixes in one respect: **shared rules
in `web/css/main.css` and `web/css/dark-mode.css` may be edited**, so a wrong
ported value is fixed once rather than overridden per template. Everything
else still holds:

- Templates and those two stylesheets only. No controller edits
  (`web/js/main.js`, `web/plates/js/*.js` stay frozen), no new CSS files.
- `sx-` classes only; never redefine `.panel*`, `.badge`, `.row`, `.col-*`,
  `.btn*`, `.form-group`, `.modal*`, `.active`, `.switch` (R10).
- Every original `id` and `ng-*` condition survives.
- No banned CSS (`gap` on flex containers, `:has()`, `aspect-ratio`,
  `backdrop-filter`, `position: sticky`, remote webfonts).
- `check-contract.mjs` exits 0 after every fix, which also enforces the
  light/dark custom-property parity.
- A shared-rule fix affects every screen using it; the full comparison is
  rerun after each one, not just the screen that prompted it.

### Viewport and engine

- 1024×768, landscape — a 2015-era iPad, the redesign's browser floor.
- **WebKit** via Playwright, using Playwright's iPad device profile overridden
  to 1024×768 landscape (touch and device pixel ratio come from the profile).
- Fallback: Chromium at the same viewport, used only if WebKit cannot launch on
  this machine. Every report states which engine produced it.
  Environment note: this machine has no `sudo`, so
  `npx playwright install --with-deps` cannot install system libraries. If
  WebKit's dependencies are absent, the fallback is the expected path.

### Screens and states

Compared (prototype screen name → reskin route):

| Prototype | Reskin |
|---|---|
| Status | `#/` |
| Weather | `#/weather` |
| Traffic | `#/traffic` |
| Towers | `#/towers` |
| Logs | `#/logs` |
| Settings | `#/settings` |
| Radar | `#/radar` |
| Developer | `#/developer` |

Plus three shell states, each captured over the Status screen: left navigation
drawer open, right help drawer open, shutdown confirmation open.

Every screen and state is captured in light and dark themes.

### Driving each app

- **Prototype:** a single page; the screen is React state. Navigate by clicking
  the button labelled "Open menu", then the `.nav-item` whose text is the screen
  name. Theme: the header button labelled "Toggle dark mode". The prototype
  starts dark. Determine the current theme from the `dark` class on
  `main.app`, not by counting clicks. (The Settings-screen "Dark Mode" checkbox
  is not wired to theme state; do not use it.)
- **Reskin:** hash routes as above, served by `node dev/server.mjs`. Theme: the
  header button labelled "Toggle theme". The fixture settings start light.
  Determine the current theme from `#themeStylesheet`'s `href`
  (`css/dark-mode.css` = dark).

### Prototype setup

- Unzipped outside the repo, e.g. `/home/dev/code/stratux-aviation-dashboard-prototype`
  from `/home/dev/code/stratux-aviation-dashboard-prototype.zip`. Never
  committed.
- Installed with pnpm via corepack (`packageManager: pnpm@12.3.4` in its
  `package.json`), run as a production build (`next build` + `next start`), not
  `next dev`, so dev overlays cannot shift layout.
- The tool takes the prototype directory as a required argument.

### Servers

The tool starts both servers itself on dedicated ports (not 8080/3000, to avoid
colliding with a server someone already has running), waits for them to answer,
and stops them on exit — including on failure.

### What is measured

For each paired element (see *Element map*):

- **Box:** width and height; x position; y position.
- **Spacing:** computed padding on all four sides; the gap to the previous
  paired sibling (distance between boxes, which captures margin and grid gap
  regardless of how either app implements it).

Data-driven content makes some measurements meaningless, and the map marks
each element accordingly:

- **Fixed elements** (header, breadcrumb, title row, buttons, inputs, a single
  table header row, a single table body row, section headings, toggle strip,
  radar controls): all measurements apply.
- **Variable-height containers** (section cards holding lists or tables, report
  lists): width, x, padding, and gaps apply; height does not. y applies only to
  the first such container on a screen — everything below it moves with row
  count.
- **Animated regions** (Status message-rate bars, Radar contacts): excluded
  from measurement; the containing box is still measured.
- **Controller-drawn content:** Radar's scope and its Ra−/Ra+/Alt−/Alt+/F/S/
  sound controls are SVG drawn by `radar.js` (frozen) inside `#radar_display`,
  sized to its parent. No template can change them. On Radar, only the HTML
  chrome is measured: the badge row and the outer container of the scope.

Where the redesign plan prescribes an arrangement that differs from the
prototype, panel *positions* on that screen are not compared; each panel's
internals (padding, heading, field rows, buttons, gaps between them) are:

- **Settings:** the plan (Task 11) prescribes two independent columns — left
  AHRS, Commands, Theme; right Tracker Configuration, Configuration, WiFi
  Settings — with the DeveloperMode panels below. The prototype uses one grid
  in a different order.
- **Status:** the reskin adds panels the prototype lacks (OGN statistics and
  other §6.4 data), which reflows the two-column grid.

### DeveloperMode

The reskin is compared with `DeveloperMode` on, because the prototype always
shows the Hardware panel that DeveloperMode gates. The fixture has it off and
the dev server will not change it, so the tool rewrites the `/getSettings`
response inside Playwright (route interception) — `dev/fixtures/` is not
edited. Panels that DeveloperMode adds beyond the prototype (Diagnostics, Raw
Configuration, Status min/max) are reported as reskin-only.

Before measuring, inject a stylesheet that disables animations and
transitions, wait for network idle, and then wait for the reskin's WebSocket
data to render at least one row where the screen has rows.

### Element map

Hand-written, one entry per element per screen: an id, a prototype selector, a
reskin selector, and the element's kind (fixed / variable / animated). Built
from `app/page.tsx` + `app/globals.css` on one side and the redesigned
templates on the other.

- An element present in the prototype but not found in the reskin is a failure
  (unless accepted).
- An element the reskin adds that the prototype lacks (data the redesign
  restored, per the redesign spec §6) is reported as information, not failure.
- Selector misses on *either* side are reported distinctly from drift, so a
  broken map is never mistaken for a broken layout.

### Accepted differences

A committed file in `dev/visual-compare/` listing each accepted difference:
element id (or screen-wide), which measurement, and a one-line reason. Seeded
with the redesign's deliberate departures from the prototype:

- Traffic: column positions — prototype defect §6.9.1 (values shifted one
  column left).
- Towers: column headers and widths — prototype defect §6.9.2.
- Weather: TAF/PIREP/WINDS badges — prototype defect §6.9.3 (rendered unstyled
  in the prototype).
- Status: the "ALL SYSTEMS NOMINAL" title-row badge — removed in the redesign
  as fabricated (Task 4).
- Traffic: the "12 targets" badge — prototype defect §6.9.4.
- Logs: user-agent and viewport strings — hard-coded in the prototype, bound in
  the reskin.

Further entries are added during the run, each with its reason, and reviewed by
a human before the run is called clean.

### Output

Written to `dev/visual-compare/out/` (ignored):

- `report.json` — every measurement, both sides, delta, tolerance, verdict.
- `report.html` — per screen and theme, the prototype and reskin screenshots
  side by side, out-of-tolerance elements outlined on both, followed by a
  table of failures, accepted differences, unmatched elements, and map misses.
- `screenshots/<screen>-<theme>-{prototype,reskin}.png`.

Screenshots must show the whole screen, not just the first 768px. The reskin
scrolls inside `.scrollable-content` (mobile-angular-ui), not the document, so
a plain full-page screenshot will clip it; the builder must account for this.

### Invocation

```
cd dev/visual-compare
npm install
npx playwright install webkit chromium
node compare.mjs --prototype /home/dev/code/stratux-aviation-dashboard-prototype
```

Exit 0: clean. Exit 1: unexplained drift or map misses. Exit 2: setup failure
(a server would not start, a browser would not launch).

### Placement in the redesign plan

Add to `docs/superpowers/plans/2026-10-13-stratux-ui-redesign.md`, Task 15:

- A step after Step 2: run the comparison; fix drift until it exits 0; rerun
  `check-contract.mjs` after every fix. A human reviews every accepted
  difference added during the run before the final clean run.
- Step 6's screenshots come from the comparison's output.
- A final step before the PR: delete `dev/visual-compare/` and this document in
  one commit, and confirm `git diff c24d64df --stat` shows neither.

### Branch flow

All work — the tool, drift fixes, plan edits — is committed on
`ui-redesign-visual-compare`, where the tool can run against the fixes. When
the run is clean and reviewed, `ui-redesign` is fast-forwarded to it, and the
deletion commit is made on `ui-redesign`. The PR is opened from `ui-redesign`.

## 6. Constraints

- Everything lives under `dev/visual-compare/`, with its own `package.json`,
  lockfile, and `.gitignore` (`node_modules/`, `out/`). Deleting the directory
  removes every trace.
- Node 24 is available. Docker and `sudo` are not.
- The tool reads `web/` and never writes to it. `dev/server.mjs` and
  `dev/fixtures/` are used as-is.
- Theme toggling in the reskin posts `/setSettings` to the dev server, which
  holds settings in memory; the tool must leave the dev server in the theme it
  found it, or start its own instance (it does, per *Servers*).

## 7. Left to the builder

- Exact tolerance values, fixed and recorded in the tool before the first
  comparison run. Suggested starting point: ±2px for padding and for fixed
  element sizes; ±4px for positions and inter-element gaps; ±2% of the
  viewport width for container widths.
- The element map's contents and granularity.
- How to settle the page before measuring, beyond the requirements above.
- How to capture the reskin's inner scroll container in full.
- Port numbers.
- Report styling.
