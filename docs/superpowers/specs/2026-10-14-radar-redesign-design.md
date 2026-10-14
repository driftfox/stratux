# Radar redesign to the prototype — design

Task 16 of the Stratux UI redesign (`ui-redesign` branch). Inserted before
Task 15 Step 6 (visual sign-off), so the layout comparison verifies it.

## Intent

The user finds the prototype's radar graphic much nicer than the shipped one,
and the in-scope controls (round SVG buttons drawn on top of the scope) get in
the way. They want the Radar screen to look like the prototype's
(`/home/dev/code/stratux-aviation-dashboard-prototype`, `RadarScreen` in
`app/page.tsx`, `.instrument*`, `.radar-scope`, `.ring*`, `.north`…`.west`,
`.ownship`, `.contact*`, `.instrument-controls` in `app/globals.css`), with the
controls in a bar below the scope, and the instrument filling the whole screen
below the app header, full width, the way the Map page does.

What would make it a failure even if it works: **it turns out uglier** than
the prototype.

## Goals

- The scope looks like the prototype: dark radial-gradient disc with a thin
  light border, faint crosshair lines, a solid outer ring, a dashed inner ring,
  N/E/S/W letters just inside the edge, ownship in the centre with its flight
  level beneath, contacts as yellow aircraft symbols. Contact *labels* are the
  exception: they keep the pre-redesign layout and sizes (see Decided).
- Controls leave the SVG and become one HTML bar centred below the scope, in
  the prototype's order: `Ra−` [range] `Ra+` `Alt−` [±band] `Alt+` `F/S`
  [sound mode]. The range and band readouts sit between their buttons
  (prototype `.instrument-controls strong`).
- Full-bleed layout: no breadcrumb, no title row. Directly under the 68px app
  header, the black instrument fills the full width and the remaining height.
  Inside it, top to bottom: the status chip strip (right-aligned, as now),
  the scope (a circle as large as the remaining space allows, centred), the
  control bar.
- Every behaviour in the original spec §6.6
  (`docs/superpowers/specs/2026-10-13-stratux-ui-redesign.md`) survives:
  bearingless distance-estimate circles with alt-diff/arrow/tail labels, trail
  polylines, the four-state sound toggle with spoken confirmation, degraded
  altitude/GPS badges, CPU temperature tiers, alt-diff fallbacks (absolute
  altitude, `u/s`), track-up rotation with symbols rotated to track and labels
  kept horizontal, range steps 2/5/10/20/40 nm, altitude bands
  ±500…±50,000 ft, and the server round-trip the range/band buttons make
  (`communicateLimits`).

## Non-goals

- No change to alert logic, alarm counts, hysteresis, speech text, traffic
  ageing, socket handling, or the data model.
- No change to Map, GPS/AHRS, or any other screen or controller.
- No new features (no new range steps, no tap-to-inspect contacts, no
  north-up option).

## Constraints

- **Controller freeze lifted for `web/plates/js/radar.js` only.** Every other
  controller stays frozen. Files in play: `radar.js`, `web/plates/radar.html`,
  `web/plates/radar-help.html`, `web/css/radar.css`, `web/css/main.css`.
- `id="radar_display"` stays (contract check and `RadarRenderer`).
  `node dev/check-contract.mjs` must exit 0; it also requires the help partial
  to keep the phrases "green circle", "rough estimation", and "whenever an
  aircraft is within the inner circle".
- Browser floor (2015-era tablets): no flex `gap`, `inset`, `aspect-ratio`,
  `color-mix`, `:has`, `sticky`, `backdrop-filter`, 8-digit hex, network
  fonts. Square sizing must come from JS or a fallback that works there.
- New classes in `main.css` are `sx-` prefixed (R10). The `.radar .*` SVG
  classes in `radar.css` are the radar's own and may be restyled or replaced.
- Control buttons are at least 44px tall (plan-wide touch-target rule).
- The instrument is dark in both light and dark themes (as now and in the
  prototype). Button and readout colours must be the instrument palette, not
  theme variables — the prototype's `var(--text)` buttons would be invisible
  on black in light theme.
- Scope geometry keeps its meaning: the outer ring is `DisplayRadius`, the
  inner (dashed) ring is `DisplayRadius / 2`, the alarm radius. Contacts and
  bearingless circles keep their current maths (200 SVG units =
  `DisplayRadius`).

## Decided

- **Look** (user): the prototype's. Palette from `globals.css`: disc border
  `#9eb3b5`, background radial `#0e222a` → `#081116` (62%) → `#050708`,
  crosshair `#50666a` at .55 opacity, rings `#6c8586` (inner dashed),
  cardinal letters `#c2d0c9` 12px,   ownship `#5aa3f5` with an 11px monospace
  FL label beneath, contact symbol `#f1d26d`; readouts `#e4ca66` 13px
  monospace. (Contact label sizes: see below.)
- **Controls below the scope** (user), as HTML `<button>`s in `radar.html`
  bound to `$scope` functions in `RadarCtrl`, wired to the existing range,
  band, full-screen and sound logic. Labels: `Ra−` = smaller range, `Ra+` =
  larger range, `Alt−` = narrower band, `Alt+` = wider band (today's
  semantics). The sound button shows the current mode label
  (`BpSp`/`Beep`/`Spch`/`SnOff`); the F/S button shows an active state while
  full screen.
- **Full-bleed, whole screen below the header** (user), like Map. No
  breadcrumb or title row on Radar.
- **Contact labels keep the pre-redesign layout and sizes** (user: "this is
  important information for pilots to be able to easier see/read"). Beside
  each positioned contact: the altitude difference with sign and climb arrow
  as the largest text (today `textPlane`, 1.8em), with speed in kts and the
  tail smaller beneath it (today `textPlaneSmall`/`textPlaneReg`, 0.8em),
  at today's offsets from the symbol. Bearingless circles likewise keep the
  large alt-diff (`textCirc`, 1.8em) with the small tail beneath. Only the
  colours change to the instrument palette: alt-diff `#f1d26d`, speed/tail
  `#b7c9c7`, with a dark halo (today's outline-text technique, recoloured
  to the disc's dark) so labels stay legible over rings and crosshairs. The
  prototype's 10px two-line label is **not** used. Symbol rotated to track;
  labels stay horizontal.
- **Scope text scales with the scope** (my call): SVG text sizes are in
  viewBox units, as today, so everything grows in full screen and on large
  tablets and shrinks on phones together with the disc.
- **Bearingless circles stay green** (my call): the help text and contract
  call them the "green circle". Solid stroke so they cannot be mistaken for
  the dashed alarm ring; alt-diff and tail labels in the instrument palette.
- **F/S makes the whole instrument full screen** (my call): today it
  full-screens only the SVG, which would now hide the control bar.
- **The range, band and FL texts leave the SVG corners** (my call): range and
  band move into the control-bar readouts, FL moves beneath ownship (as the
  help text already describes).
- **Help text updated** (my call): "buttons left and right of the radar" →
  below it; "red aircraft symbols" → the new marker colour.

## Left to the builder

- Exact SVG construction (viewBox, whether rings/crosshair are SVG or CSS
  behind a transparent SVG, the contact marker glyph or path), provided the
  result matches the prototype at a glance and the geometry rule holds.
- How the scope's square size is computed and kept current on resize and
  orientation change, within the browser floor.
- How the readouts reach Angular (digest handling from socket callbacks).
- Trail colour and weight, chip strip spacing, control-bar spacing and
  wrapping on narrow/portrait screens.

## Verification

- `node dev/check-contract.mjs` exits 0.
- Dev server (`node dev/server.mjs`) with fixture traffic: contacts with and
  without positions render; every control changes what it should (range and
  band readouts update, contacts reposition while the rings stay fixed as
  `DisplayRadius` and its half, sound label cycles, F/S toggles); both themes.
- Layout comparison (`dev/visual-compare`, Task 15 Step 2a) for the radar
  screen. Its element map (`radar.badges`, `radar.scope`) may be updated to
  follow the new structure; tolerances are never edited. The full-bleed
  layout (no breadcrumb/title row, scope sized to the remaining height)
  will fail the prototype's scope/badge position and size by design: those
  become entries in `dev/visual-compare/accepted-differences.json` with the
  reason "full-bleed radar (user ruling)", reviewed by the user with the
  rest of the list. The comparison's job on this screen is then to catch
  anything else (badge strip padding, missing elements).
- Side-by-side screenshot with the prototype for the user's Step 6 sign-off.
