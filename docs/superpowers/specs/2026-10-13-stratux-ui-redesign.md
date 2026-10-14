# Stratux UI Redesign — Translation Contract

Date: 2026-10-13
Status: reference document for the second pass (design → AngularJS)

## 1. Intent

Replace the visual design of the Stratux web UI with a modern, professional
aviation product while changing **zero** backend behaviour. A designer agent
produces a design prototype from `docs/ui-redesign-brief.md`; this document
is the contract that turns that prototype into templates that load in the
real application.

Why the split: the target stack (AngularJS 1.x + mobile-angular-ui) is far
off-distribution for design-oriented generators. The design decisions are
made once, visually approved, and the translation is then mechanical and
contract-driven.

## 2. Goals, non-goals, anti-goals

**Goals**
- A visually modern, professional, aviation-appropriate UI.
- Every existing screen, control, field, and modal survives.
- Dark theme is the primary design; light theme still works.
- Map, GPS/AHRS, and Radar carry an instrument/avionics character; the other
  seven screens carry a modern tablet-app character.
- Drop-in replacement inside `web/` with no backend changes.

**Non-goals**
- No new functionality, endpoints, screens, controls, or metrics.
- No framework migration. AngularJS 1.x stays.
- No build toolchain. `web/` stays plain static files.
- No changes to the Go backend.

**Anti-goals (failure conditions)**
- A template that fails to load, silently blanks a screen, or drops a bound
  field.
- A design that reads as generic or AI-generated: gradients, emoji,
  decorative imagery, marketing-scale type, arbitrary accent colors.
- Rewriting `plates/js/*.js` controllers. The controllers are the contract's
  other side; if a change seems to require editing a controller, the change
  is wrong.

## 3. Constraints and environment

- **No Go build on Windows.** `main/sdr.go` uses `syscall.Sysinfo`
  (Linux-only) and the module needs cgo (`gortlsdr`, `go-sqlite3`). Do not use
  `go build ./...` as a verification step here.
- **`make` is not installed** on this machine; `go`, `docker`, `wsl` are.
- **Submodules are not initialized** by default (`git submodule status`
  shows `-`). Needed for any real build: `dump1090`, `rtl-ais`,
  `ogn/ogn-tracker`, `image_build/pi-gen`.
- **No unit tests exist** (zero `*_test.go`). CI's only gate is `make ddpkg`.
- **Local verification loop:** `node dev/server.mjs` →
  <http://127.0.0.1:8080>. Static files plus fixture REST/WebSocket data. This
  is the real feedback loop for UI work.
- **Image builds clone the repo** (`image_build/build.sh` git-clones into
  pi-gen), so **uncommitted changes do not reach the image**. Commit first.
- `web/Makefile` copies an explicit whitelist
  (`css js img maui plates index.html alert.wav stratux.appcache`) into the
  www dir. Anything outside that whitelist never reaches the `.deb` or the
  image.

## 4. Decisions already made

| Decision | Call |
|---|---|
| Design tool | v0 (v0.app), used as a design studio producing a React/Tailwind prototype — **not** production code |
| Output shape | Whole application in one response |
| Where the design brief lives | `docs/ui-redesign-brief.md` (paste-into-v0 prompt, self-contained, no repo access needed) |
| Theme | Dark-first; light theme retained as a faithful derivation |
| Character | Modern tablet aviation app, with Map / GPS-AHRS / Radar as instrument-style exceptions |
| Information architecture | Free to rearrange; nothing may be added or removed |
| Data during development | Fixtures via `dev/server.mjs`; live data from the device is not required |
| Controllers | Untouched |
| Prototype design source | `stratux-aviation-dashboard-prototype` — v0 output, reviewed 2026-10-13 |
| Design source per screen | Original retained for GPS/AHRS/G-Meter and Map; v0 retained for Radar and all data pages (§6.1) |
| Completeness rule | The final UI may not display less data than the original (§6) |
| AppCache manifest | Repair it as part of this work — add all missing assets plus any new files (§5.8 defect 10). *Still awaiting confirmation; override here if wrong.* |
| Theme architecture | **Light is the base stylesheet; `css/dark-mode.css` holds the complete dark theme.** `main.js` stays untouched and the filename stays truthful. Dark remains the *designed* priority — see §5.1.1 |
| Browser floor | **Conservative — 2015-era tablets.** See §5.1.2 |
| `<ui-switch>` substitution | Allowed — builder may use its own switch markup provided `ng-model` binds to the same scope variable |
| Dead `WiFiRestart` banner | Drop it rather than edit `settings.js` to fix it |
| If output is too large to translate at once | Design-system first, then one screen per pass, reviewed per screen |

## 5. The contract

### 5.1 Stack and file layout

AngularJS 1.x, loaded as plain `<script>` tags in `web/index.html` (no
bundler, no npm). Load order matters:

**CSS:** `css/addtohomescreen.css`, `maui/css/mobile-angular-ui-base.min.css`,
`maui/css/mobile-angular-ui-hover.min.css`,
`maui/css/mobile-angular-ui-desktop.min.css`, `css/main.css`, `css/ahrs.css`,
`css/radar.css`, `css/ol.css`, `css/ol-layerswitcher.css`, `css/map.css`, then
`<link rel="stylesheet" id="themeStylesheet" href="">`.

**JS:** `js/svg.min.js`, `js/NoSleep.min.js`, `js/addtohomescreen.min.js`,
`js/ol.js`, `js/olms.js`, `js/ol-layerswitcher.js`, then
`maui/js/angular.min.js`, `maui/js/angular-ui-router.min.js`,
`maui/js/mobile-angular-ui.min.js`, `maui/js/mobile-angular-ui.gestures.min.js`,
then `js/main.js`, then every `plates/js/*.js`.

Module declaration (`web/js/main.js`):

```js
angular.module('stratux', ['ui.router', 'mobile-angular-ui',
                           'mobile-angular-ui.gestures', 'appControllers']);
var appControllers = angular.module('appControllers', []);
```

Files the redesign may touch: `web/index.html`, `web/plates/*.html`,
`web/plates/*-help.html`, `web/css/*.css`. **New CSS files are permitted**
(see §5.7).

#### 5.1.1 Theme architecture

`MainCtrl.updateTheme()` (in `web/js/main.js`) sets `#themeStylesheet` to
`css/dark-mode.css` when `DarkMode` is true, and to `''` when false. That is
the entire mechanism and it is **not being changed**.

Consequences:

- **Light is the base stylesheet** (`css/main.css` and friends carry light
  values by default).
- **`css/dark-mode.css` carries the complete dark theme**, loaded as an
  override. The filename is accurate; do not rename or repurpose it.
- `main.js` is not edited.

**Design priority is the opposite of construction order.** Dark is the theme
that gets designed and reviewed first, because that is what a cockpit wants.
Light is the derivation. Do not let "light is the base file" drift into
"light is the theme we cared about" — if the two ever disagree, dark wins and
`dark-mode.css` is adjusted.

#### 5.1.2 Browser / CSS floor

Target: **2015-era tablets** (iOS 9-era Safari, old Android webviews). This is
a hard constraint on the stylesheet, not a preference. Stripped out:

| Feature | Replacement |
|---|---|
| `gap` in flexbox | Margins on children |
| CSS nesting | Flat selectors |
| `:has()` | Angular class/`ng-class` toggles |
| Container queries | Existing Bootstrap-style breakpoints |
| `aspect-ratio` | Padding-top hack or explicit heights |
| `backdrop-filter` | Solid backgrounds |
| Webfonts (`@font-face`) | System font stack — also required by offline/AppCache; no network font may be fetched |
| `position: sticky` | Absolute/fixed positioning within `.scrollable` |

Permitted: flexbox (2015 syntax), grid with explicit tracks, transitions and
transforms, media queries, `font-variant-numeric: tabular-nums` (verify on the
target iOS; fall back to a monospace stack for numerics if needed).

**CSS custom properties are marginal** (Safari 9.1, Chrome 49). If used, they
must degrade gracefully — no design element may depend on a variable to
render. Prefer plain CSS with the token values written out.

**Mapping the prototype's CSS.** `globals.css` already matches the chosen
architecture and the font constraint:

- It sets `font-family: Arial, Helvetica, sans-serif` on `:root` — **no
  webfont**, so nothing needs replacing there.
- It defines tokens on `:root` (light) and redefines them under `.app.dark`.
  Port `:root{…}` → `css/main.css` and `.app.dark{…}` → `css/dark-mode.css`.
  Because both blocks are pure custom properties, the two files stay
  mechanically in sync.
- **What must be rewritten for the 2015 floor:** `gap` used in flex and grid
  containers (appears throughout `header`, `.crumb`, `.brand`,
  `.header-actions`, `.title-row`), `place-items`, `width:min(340px,90vw)`,
  `color-scheme`. Replace `gap` with margins on children, `place-items` with
  explicit `align-items`/`justify-content`, `min()` with a media-query
  fallback, and drop `color-scheme`.
- Keep `min-width: 44px; min-height: 44px` on `.icon-button` — it is already
  the correct touch-target size.

### 5.2 Shell contract (`web/index.html`)

| Element / directive | Why it must survive |
|---|---|
| `<body ng-app="stratux" ng-controller="MainCtrl" ui-prevent-touchmove-defaults>` | App bootstrap and touch scrolling |
| `<link id="themeStylesheet">` | `MainCtrl.updateTheme()` sets its `href` to `css/dark-mode.css` or `''`. Renaming the id kills theme switching |
| `<div ui-yield-to="modals">` | Slot filled by plates using `ui-content-for="modals"` |
| `<div ui-yield-to="title">`, `<div ui-yield-to="navbarAction">` | Navbar slots. Only `developer.html` currently fills `title`; nothing fills `navbarAction` (its default content is the Help button) |
| `ui-toggle="uiSidebarLeft"` / `ui-toggle="uiSidebarRight"` | Menu and Help open |
| `ui-track-as-search-param='true'` on the left sidebar | Sidebar state mirrored into the URL |
| `<div class="list-group" ui-turn-off='uiSidebarLeft'>` | Tapping a nav item closes the menu |
| `ui-swipe-right` / `ui-swipe-left` on `.app` | Gesture open/close of the menu |
| `<div ng-include="helppage">` in the right sidebar | Every controller sets `$scope.$parent.helppage`; without it Help is blank |
| `.app` > `.app-body` > `.app-content` > `.scrollable` > `.scrollable-content` > `div[ui-view]` | mobile-angular-ui's scroll layout; the ui-router outlet |

**Left menu** — items in order, with route and visibility condition:

| Label | href | Condition |
|---|---|---|
| Status | `#/` | — |
| Weather | `#/weather` | `UAT_Enabled \|\| Ping_Enabled \|\| Pong_Enabled` |
| Traffic | `#/traffic` | — |
| GPS/AHRS | `#/gps` | — |
| Towers | `#/towers` | `UAT_Enabled \|\| Ping_Enabled \|\| Pong_Enabled` |
| Logs | `#/logs` | — |
| Settings | `#/settings` | — |
| Radar | `#/radar` | — |
| Map | `#/map` | — |
| Developer | `#/developer` | `DeveloperMode` |

`MainCtrl` fetches `/getSettings` once and publishes `DeveloperMode`,
`UAT_Enabled`, `Ping_Enabled`, `Pong_Enabled`, `DarkMode` on root scope —
these drive menu visibility and theming.

### 5.3 Routing

Defined in `web/js/main.js`. State name → URL → template → controller, all
with `reloadOnSearch: false`, fallback `/`:

| State | URL | Template | Controller |
|---|---|---|---|
| `home` | `/` | `plates/status.html` | `StatusCtrl` |
| `towers` | `/towers` | `plates/towers.html` | `TowersCtrl` |
| `weather` | `/weather` | `plates/weather.html` | `WeatherCtrl` |
| `traffic` | `/traffic` | `plates/traffic.html` | `TrafficCtrl` |
| `gps` | `/gps` | `plates/gps.html` | `GPSCtrl` |
| `logs` | `/logs` | `plates/logs.html` | `LogsCtrl` |
| `settings` | `/settings` | `plates/settings.html` | `SettingsCtrl` |
| `radar` | `/radar` | `plates/radar.html` | `RadarCtrl` |
| `map` | `/map` | `plates/map.html` | `MapCtrl` |
| `developer` | `/developer` | `plates/developer.html` | `DeveloperCtrl` |

Routes, controllers, and template filenames are fixed. The redesign may
rearrange *where* a feature appears in the UI, but it must still be reachable
through the existing state it belongs to — moving a control between plates is
allowed only if it stays bound to the same controller scope.

### 5.4 Per-screen contract

Scope variable names, `ng-model` names, and `ng-click` handler names are
**API**. Markup around them can change freely.

#### `plates/status.html` → `StatusCtrl`

Bindings: `Version`, `Build`, `ConnectState`, `DeveloperMode`,
`Connected_Users`, `Pong_Heartbeats`, `Pong_connected`, `Devices`,
`Ping_connected`, `uatStyleColor`, `esStyleColor`, `aisStyleColor`,
`ognStyleColor`, `UAT_messages_last_minute/max/total`,
`ES_messages_last_minute/max/total`, `AIS_messages_last_minute/max/total`,
`AIS_connected`, `OGN_messages_last_minute/max/total`, `OGN_connected`,
`OGN_noise_db`, `OGN_noise_color`, `OGN_gain_db`, `OGN_range_loss_factor`,
`OGN_Status_url`, `UAT_Towers`, `UAT_METAR_total`, `UAT_TAF_total`,
`UAT_NEXRAD_total`, `UAT_PIREP_total`, `UAT_SIGMET_total`, `UAT_NOTAM_total`,
`UAT_OTHER_total`, `GPS_hardware`, `GPS_protocol`, `GPS_NetworkRemoteIp`,
`GPS_solution`, `GPS_position_accuracy`, `GPS_satellites_locked/seen/tracked`,
`Uptime`, `CPUTemp`, `CPUTempMin`, `CPUTempMax`, `DiskSpace`, `Errors`,
`visible_uat`, `visible_es`, `visible_ogn`, `visible_ais`, `visible_ping`,
`visible_pong`, `visible_gps`, `visible_errors`, `Region`.

Handlers: `VersionClick()` (8 taps in 3 s toggles developer mode),
`setRegionClick('US'|'EU')`, `Clamp(num, min, max)`.

Directives: `ui-content-for="modals"`, `ui-if="RegionSelect"`,
`ui-state="RegionSelect"`, `ui-turn-off="RegionSelect"`. The US/EU buttons
use inline `onclick="angular.element(this).scope().setRegionClick('US')"` —
keep or convert to `ng-click`, but the handler signature must match.

#### `plates/traffic.html` → `TrafficCtrl`

Bindings: `ConnectState`, `data_list`, `data_list_invalid`, `showReg`,
`showSquawk`, `showCategory`, `RelDist`, `GPS_connected`.

Row fields: `aircraft.reg`, `.tail`, `.icao`, `.squawk`, `.addr_type`,
`.category`, `.lat`, `.lon`, `.dist`, `.bearing`, `.alt`, `.vspeed`,
`.speed`, `.heading`, `.signal`, `.Age`, `.distEst`, `.trafficColor`,
`.addr_symb`, `.isStratux`.

Four `<ui-switch>` elements with `ng-model` `showReg`, `showSquawk`,
`showCategory`, `RelDist` — the switches are functional, not decorative.

Parent-scope colors consumed by the help partial:
`$scope.$parent.esStyleColor`, `.uatStyleColor`, `.ognStyleColor`,
`.aisStyleColor`.

#### `plates/map.html` → `MapCtrl`

**`<div id="map_display">` is mandatory** — `map.js` calls
`new ol.Map({ target: 'map_display' })`. The container must fill its panel
(currently `height: calc(100vh - 160px)` in `css/map.css`); if the new shell
changes navbar or panel chrome, recompute that offset.

Bindings: `ConnectState`. Help partial: **`plates/radar-help.html`**
(no `map-help.html` exists).

#### `plates/gps.html` → `GPSCtrl`

**Mandatory element ids:** `ahrs_display` (attitude indicator),
`gMeter_display` (G-meter) — both are `<div>`s that svg.js injects an inline
`<svg>` into. **`map_display` also appears here** as the world-map div; this
is a separate element from the Map page's (different template, so no
collision), but it must keep that id because `gps.js` binds
`background-position` to it.

Also mandatory: the four status chips
`status-calibrating`, `status-gps`, `status-imu`, `status-bmp` — `gps.js`
sets their `innerText` and toggles classes `off` / `on` / `warn` / `blink`
directly, bypassing Angular. And the `.hider` class on the GPS, Satellites
and G-Meter panels: tapping the AHRS title calls `hideClick()`, which sets
`display:none` on every `.hider` element for the fullscreen horizon.

Bindings: `ConnectState`, `IsCaging`, `IMU_Sensor_Enabled`, `ahrs_heading`,
`ahrs_pitch`, `ahrs_roll`, `ahrs_alt`, `ahrs_heading_mag`, `ahrs_slip_skid`,
`ahrs_turn_rate`, `ahrs_gload`, `map_pos_x`, `map_pos_y`, `map_width`,
`map_height`, `map_opacity`, `map_mark_x`, `map_mark_y`, `map_mark_opacity`,
`data_list` (satellites: `SatelliteID`, `InSolution`, `Elevation`,
`Azimuth`, `Signal`, `SatelliteNMEA`), `SolutionText`,
`GPS_PositionSampleRate`, `Satellites`, `GPS_satellites_seen`,
`GPS_satellites_tracked`, `gps_lat`, `gps_lon`, `gps_horizontal_accuracy`,
`gps_alt`, `gps_vertical_accuracy`, `gps_vert_speed`,
`gps_height_above_ellipsoid`, `gps_track`, `gps_speed`.

Handlers: `hideClick()`, `AHRSCage()`, `AHRSCalibrate()`, `GMeterReset()`.

#### `plates/radar.html` → `RadarCtrl`

**`<div id="radar_display">` is mandatory** — `radar.js` does
`SVG('radar_display').viewbox(-201,-201,402,302)`. The whole scope, including
the Ra−/Ra+/Alt+/Alt−/F/S/sound controls, is SVG drawn by the controller; the
template owns only the chrome.

Bindings: `ConnectState`, `BaroAltValid`, `GPSValid`, `CPUTemp`.

#### `plates/weather.html` → `WeatherCtrl`

Bindings: `ConnectState`, `watching`, `watch_count`, `watch_list`,
`data_count`, `data_list`; per item `location`, `type`, `update`,
`flight_condition`, `age`, `time`, `data`, `backcolor`.

Accordion directives: `ui-state="weatherAccordion"`, `ui-default="1"`,
`ui-set="{'weatherAccordion':1}"`, `ui-if="weatherAccordion == 1"`.

Flight-category classes: `flight_condition_VFR`, `_MVFR`, `_IFR`, `_LIFR`;
type fallbacks `report_TAF`, `report_PIREP`, `report_WINDS`.

#### `plates/towers.html` → `TowersCtrl`

Bindings: `ConnectState`, `data_list`; per tower `tower.lat`, `tower.lon`,
`tower.power`, `tower.power_last_min`, `tower.power_max`, `tower.messages`.
No ui-* directives.

#### `plates/settings.html` → `SettingsCtrl`

Panels: AHRS, Commands, Theme, Tracker Configuration, Configuration, WiFi
Settings, Hardware, Diagnostics, Raw Configuration.

Switch bindings (auto-save via `$watchGroup(toggles)`): `DarkMode`,
`EstimateBearinglessDist`, `UAT_Enabled`, `ES_Enabled`, `OGN_Enabled`,
`AIS_Enabled`, `APRS_Enabled`, `GPS_Enabled`, `IMU_Sensor_Enabled`,
`BMP_Sensor_Enabled`, `Ping_Enabled`, `Pong_Enabled`, `OGNI2CTXEnabled`,
`DisplayTrafficSource`, `DEBUG`, `ReplayLog`, `TraceLog`, `AHRSLog`,
`PersistentLogging`.

Text/number bindings (save on blur/Enter): `GLimits`, `OwnshipModeS`,
`WatchList`, `PPM`, `Dump1090Gain`, `Baud`, `StaticIps`, `AltitudeOffset`.
**Exception:** `PWMDutyMin` uses `ng-change="updatePWMDutyMin()"`
(`plates/settings.html:411`) and commits on every keystroke, not on blur.

WiFi bindings (explicit submit): `WiFiMode`, `WiFiCountry`, `WiFiSSID`,
`WiFiSecurityEnabled`, `WiFiPassphrase`, `WiFiDirectPin`, `WiFiChannel`,
`WiFiIPAddress`, `WiFiInternetPassThroughEnabled`, `WiFiClientNetworks`
(entries `.SSID`, `.Password`).

Tracker bindings: `OGNAddrType`, `OGNAddr`, `OGNAcftType`, `OGNPilot`,
`OGNReg`, `OGNTxPower`.

Conditional rendering flags: `DeveloperMode`, `hasTracker`,
`gpsHardwareCode`, `BMP_Sensor_Enabled`, `IMU_Sensor_Enabled`, `Pong_Enabled`,
`visible_serialout`, `WiFiMode`, `update_files`, `uploading_update`,
`pong_uploading_update`.

Handlers: `updateGLimits`, `updatemodes`, `updatewatchlist`, `updateppm`,
`updategain`, `updateBaud`, `updatestaticips`, `updatealtitudeoffset`,
`updatePWMDutyMin`, `updateOgnTrackerConfig`, `updateWiFi`,
`addWiFiClientNetwork`, `removeWiFiClientNetwork`, `resetSettings`,
`setOrientation`, `postReboot`, `postShutdown`, `setUploadFile`,
`uploadFile`, `setPongUploadFile`, `uploadPongFile`, `wifiModeStr`.

Input-validation directives defined in `settings.js` and used as attributes:
`hex-input`, `watchlist-input`, `ssid-input`, `wpa-input`, `pin-input`,
`ip-list-input`, `ip-addr-input`, `g-limits-input`, `pilotname-input`,
`ognreg-input`. These must remain on their inputs or validation is lost.

Shared-state (modal) names: `modalReboot`, `modalRebootRequired`,
`modalShutdown`, `modalCalibrateForward`, `modalCalibrateDone`,
`modalCalibrateFailed`, `modalSuccessWiFi`, `modalErrorWiFi`,
`modalCancelWiFi`, `rebooting`, `shuttingdown`, `WiFiRestart`,
`RegionSelect`.

#### `plates/logs.html` → `LogsCtrl`

Bindings: `userAgent`, `deviceViewport`. Two anchors to `../logs/stratux.log`
and `../logs/`.

#### `plates/developer.html` → `DeveloperCtrl`

Uses `<div ui-content-for="title">Developer</div>` (navbar title override).

Bindings: `Logfile_Size`, `AHRS_LogFiles_Size`. Handlers: `postRestart`,
`postDownloadLog`, `postDeleteLog`, `postDownloadAHRSLogs`,
`postDeleteAHRSLogs`, `postDownloadDB`.

### 5.5 Shared `craftService`

Defined in `web/js/main.js`, chained off the `stratux` module (line 149 —
**not** on `appControllers`, which stays empty), and injected into `StatusCtrl`,
`TrafficCtrl`, and `MapCtrl`. Templates and the help partials call it:
`getCategory(craft)`, `getTrafficSourceColor(source)`,
`isTrafficAged(craft)`, `isTrafficAged2(craft, targetVar)`,
`getTransportColor(craft)`. The color mappings carry meaning and appear in
help text — do not re-map them.

### 5.6 Endpoints

WebSockets (drive nearly all on-screen data, hard-coded `ws://`):
`/status`, `/situation`, `/traffic`, `/weather`, `/radar`. These five are all
the Go backend registers (`main/managementinterface.go:1251–1275`).

`URL_DEVELOPER_WS = /developer` exists as a constant in `web/js/main.js:33`
but **is never connected to and is not served** — `DeveloperCtrl` uses
`/status` (`plates/js/developer.js:13`). Do not "fix" this by opening it.

REST GET: `/getStatus`, `/getSettings`, `/getRegion`, `/getTowers`,
`/getSatellites`, `/develmodetoggle`, `/tiles/tilesets`,
`/tiles/<file>/{z}/{x}/{-y}.<format>`, `/logs/`, `/logs/stratux.log`.

REST POST: `/setSettings`, `/setRegion`, `/reboot`, `/shutdown`, `/restart`,
`/cageAHRS`, `/calibrateAHRS`, `/orientAHRS`, `/resetGMeter`,
`/updateUpload`, `/updatePong`, `/deleteahrslogfiles`, `/deletelogfile`,
`/downloadlog`, `/downloadahrslogs`, `/downloaddb`.

External: `http://<host>:8082/rf-spectro.jpg` (OGN spectrogram),
`https://api.tiles.openaip.net/...` (OpenAIP tiles).

### 5.7 Assets and build

- `web/stratux.appcache` is the AppCache manifest referenced by
  `<html manifest="stratux.appcache">`. **Any new JS or CSS file must be added
  to it**, or it will not be cached. Note it is *already incomplete* — see
  defect 10 in §5.8 — so treat "add your file" as the rule, not "the manifest
  is complete".
  `web/Makefile` appends build time + git hash to the *deployed* copy — that
  is what busts the cache.
- `web/Makefile` copies only `css js img maui plates index.html alert.wav
  stratux.appcache`. New CSS files must live under `web/css/`.
- Icons in use: FontAwesome (ships with mobile-angular-ui under `maui/`) and
  `img/actype/*.svg` (aircraft symbols used by OpenLayers), `img/logo-*.png`.
- `alert.wav` is loaded by `radar.js` for audible traffic alerts.

### 5.8 Known defects — fix, don't reproduce

Present in the current UI; the redesign is explicitly licensed to correct
these because they are presentation, not behaviour:

1. Map page shows **Radar** help (`helppage = 'plates/radar-help.html'`) —
   there is no `map-help.html`.
2. `settings-help.html` section names ("System", "WiFi", "Calibrate AHRS
   Sensors") don't match the rendered panel headings ("Commands", "WiFi
   Settings", "Set AHRS Sensor Orientation").
3. Three GPS-page panels are invisible unless the user taps the "AHRS" title
   — discoverable nowhere in the UI.
4. `WiFiRestart` status banner can never appear (nothing sets it).
5. `status.html` has a typo class `secion_invisible` (missing `t`) on the
   Pong heartbeats row.
6. `weather.js` never assigns `backcolor`, so the inline
   `background-color` on report time is always empty.
7. `pong_uploading_update` (HTML) vs `uploading_pong_update` (JS) name
   mismatch — Pong upload progress never displays.
8. Developer page Delete actions have no confirmation — *preserve*; flagged
   here so nobody "fixes" it silently.
9. Duplicate form name `ppmForm` on the PPM and Baud rows.
10. `web/stratux.appcache` is missing large parts of the app: Radar, Map and
    Developer plates and their JS, `dark-mode.css`, all OpenLayers assets,
    `alert.wav`, `img/actype/*.svg`, several help partials. Today's offline
    cache therefore lacks the Radar/Map/Developer screens and the entire dark
    theme. Repairing the manifest is in scope for this redesign (it is
    presentation-adjacent and no behaviour changes); see §4.

## 6. Completeness checklist (post-prototype gap analysis)

The v0 prototype lives at `C:\Users\Russell\src\stratux-aviation-dashboard-prototype`
(single file: `app/page.tsx`, ten screen components; `app/globals.css` carries the
visual system). It was reviewed against every original plate, controller, and
help partial. The translation pass must satisfy this checklist: **the final UI
may not show less data than the original did.**

### 6.1 Which design wins, per screen

| Screen | Design source | Consequence |
|---|---|---|
| GPS / AHRS / G-Meter | **Original retained** | v0's version discarded |
| Map | **Original retained** | v0's version discarded |
| Radar | **v0's version** | gaps below must be fixed inside it |
| Status, Weather, Traffic, Towers, Logs, Settings, Developer, shell | **v0's version** | gaps below must be filled |

### 6.2 Reverted screens — no action

The original `plates/gps.html` and `plates/map.html` already carry their full
data set. Confirm nothing was lost in the revert and move on:

- **GPS/AHRS:** the four overlay states (ground-test, calibrating, no-AHRS,
  GPS-pseudo-AHRS), the heading tape on the attitude indicator, GPS position
  `±accuracy m`, altitude `@ ft/min` vertical speed, satellite **Elevation**
  and **Azimuth** columns with `---` fallbacks, the per-satellite ✅ in-solution
  marker, the `.hider` fullscreen toggle on the AHRS title, and the degraded
  `--` / `---` / `∞` value states.
- **G-Meter:** working RESET control, red limit marks at `GLimits`, latched
  min/max pointers.
- **Map:** real basemaps (OSM, OpenAIP, `/tiles/tilesets` MBTiles), the layer
  switcher with per-layer visibility persistence, the "Aircraft trails 5NM"
  layer, the ownship pin and auto-recenter, age-based opacity fade, symbol
  rotation by track, tail + altitude labels.
  Remember `dev/README.md`: the map silently shows **zero aircraft** unless
  `/tiles/tilesets` returns JSON.

### 6.3 Settings (v0 kept — largest gap)

- [x] **Diagnostics panel** (DeveloperMode): Show Traffic Source in Callsign,
  Verbose Message Log, Record Replay Logs, Record Trace Logs, Record AHRS
  Logs, Persistent logging — *none of these exist in the prototype; the entire
  logging pipeline currently has no switch.*
- [x] **Pong Firmware Update** file picker with Install / Uploading states
  (`ng-show="Pong_Enabled"`).
- [x] **Raw Configuration** panel — `stratux.conf` pretty-printed JSON.
- [x] **WiFi:** WiFi-Direct Pin, Internet Passthrough, **Add WiFi Client
  Network** + repeatable Client SSID / Passphrase / Remove rows. Without these
  AP+Client and WiFi-Direct modes are unusable.
- [x] **Convert free-text inputs back to selects:** WiFi Mode (3 options),
  WiFi Country (~240 codes), WiFi Channel (1–11), SDR Dump 1090 ES Gain (28
  discrete values, `37.2 DEFAULT`), Tracker Address Type (Random/ICAO/Flarm/OGN).
- [x] **Modals:** reboot confirmation, reboot-required, the 3-step AHRS
  orientation calibration including the failure modal with
  `{{Orientation_Failure_Message}}`, WiFi success recap, WiFi error modal.
- [x] **System Update states:** select → `Install {{name}}` → `Uploading…`.
- [x] **Field hint text:** Ownship "Hex, comma separated", Watch List
  "space-delimited 4-letter identifiers", Static IPs, G Limits placeholder,
  Transmit Power "-32 = no transmission…", fan duty 0–100.
- [x] **Gating:** Hardware and Diagnostics panels are `ng-show="DeveloperMode"`
  — the prototype shows Hardware to everyone. Preserve the gate.
- [x] Tracker rows conditional on `gpsHardwareCode` (13/15 hide Pilot Name,
  Registration, Transmit Power and some aircraft types).
- [x] Post-action status messages: rebooting / shutting down / WiFi restarting.
  *(WiFi restarting dropped per §4 — dead banner, defect 4.)*

### 6.4 Status (v0 kept)

- [x] **Errors panel** — red list, present only when `Errors` is non-empty.
  The prototype can only ever render `● ALL SYSTEMS NOMINAL`; a device with a
  failed SDR must be able to look broken.
- [x] **GPS hardware + protocol** row (detected type, protocol, network-IP link).
- [x] **OGN Statistics:** Background Noise@Gain, **Receiver Gain (dB)**,
  **RF Spectrogram download link**.
- [x] OGN noise bar: `range loss: {{OGN_range_loss_factor}}x` and the
  "Half range for each 6 dB noise" caption.
- [x] Separate **Ping device** and **Pong device** status labels — not one
  combined "Ping / Pong OK".
- [x] `(disconnected)` suffix on AIS and OGN rate rows when that receiver is down.
- [x] **Developer Mode** badge.
- [x] First-boot **Region (US / EU) modal** (`ui-content-for="modals"`).
- [x] CPU temperature min/max range `[min - max]` (DeveloperMode only).
- [x] Version + build line, remaining tappable (8 taps / 3 s → `/develmodetoggle`).

### 6.5 Traffic (v0 kept)

The prototype ships all four toggles with no data behind them.

- [x] **Code column** — ICAO hex with the `(TFID)` marker for `addr_type == 3`.
- [x] **Squawk column** — zero-padded 4 digits, `0` renders `----`; swapped in
  for Code by `showSquawk`.
- [x] **Category column** — emitter category *and* AIS vessel categories;
  swapped in by `showCategory`.
- [x] **Tail Num ↔ Callsign switching** (`reg` vs `tail`, `[--N/A--]` fallback)
  driven by `showReg`.
- [x] **Bearing column** (degrees true) and the **lat/lon fallback** when GPS
  is unavailable or `RelDist` is off — `showDistance`'s `ng-hide` on
  `GPS_connected` must be represented.
- [x] **Unit suffixes:** `ft`, `KTS`, `dB`, `s`, `NM`, and `---` for invalid.
- [x] **Source fidelity:** six variants — ADSB1090, ADSR1090, TISB1090,
  ADSB978, ADSR978, TISB978 — with their glyphs (aircraft / antenna / ship)
  and the Stratux-own-traffic marker.
- [x] **Mode S table** gets real values: altitude, speed, course, vertical
  speed, squawk, category, estimated distance — the prototype fills every one
  with `—`.
- [x] Sort primary table by distance, secondary by ICAO.

### 6.6 Radar (v0 kept — fix inside v0's design)

- [x] **Bearingless / no-position targets** drawn as distance-estimated
  circles sized by `DistanceEstimated`, labeled with altitude difference,
  climb arrow, and tail. *This is the core alarm feature for Mode-S-only
  traffic; the prototype has none of it.*
- [x] **Trail polylines** behind each contact.
- [x] **Sound toggle cycles four states** with visible label change:
  `BpSp → Beep → Spch → SnOff`.
- [x] Degraded badges: `No GPS!`, `No Baro-Alt, using GPS-Alt`,
  `No Baro-Alt, using ADSB`, `No Altitude!` — not just happy-path `Baro-Alt`.
- [x] CPU temperature **color tiers** (info < 70 °C, warning 70–79, danger ≥ 80).
- [x] Altitude-diff label fallbacks: absolute altitude / `u/s` when own altitude
  is invalid.
- [x] Symbols rotated to track, labels counter-rotated to stay horizontal.
- [x] Range steps 2 → 5 → 10 → 20 → 40 nm; altitude bands
  ±500 → ±1,000 → ±2,000 → ±5,000 → ±10,000 → ±50,000 ft.

### 6.7 Weather, Towers, Logs, Developer

- [x] **Weather:** `Watching {{watching}} ({{watch_count}})` — the actual
  configured identifiers and count — plus `Recent Reports ({{data_count}})`,
  and staleness color on the age cell.
- [x] **Towers:** its own column headers — Location / Current Power (dB) /
  Avg Power (dB) / Max Power (dB) / Msgs Last Minute. The prototype reuses the
  traffic table's headers, so dB values render under "Altitude".
- [x] **Logs:** complete as-is (verify hrefs resolve to `../logs/stratux.log`
  and `../logs/`).
- [x] **Developer:** complete as-is; remember the screen is DeveloperMode-gated.

### 6.8 Shell and cross-cutting

- [x] **Nav gating:** Weather and Towers hidden unless
  `UAT_Enabled || Ping_Enabled || Pong_Enabled`; Developer hidden unless
  `DeveloperMode`.
- [x] **Contextual help** — every `-help.html` partial's substance must
  survive. The prototype reduces each to one sentence. Non-negotiable
  content: the traffic-source color/symbol legend, the G/S/R constellation
  prefixes, the "reference only — must not be used for flight operations"
  warning, the AHRS calibration procedure, fan-duty tuning, the alarm-circle
  explanation, the 60-second current-vs-peak definition.
- [x] Help drawer, menu, and theme toggle wired to real scope state
  (`helppage`, `DeveloperMode`, `DarkMode`).

### 6.9 Defects inside the prototype itself

Fix these during translation — they are wrong, not design choices:

1. **Traffic table data is shifted one column left of its headers** — aircraft
   type renders under "Altitude", altitude under "Position / distance".
2. **Towers reuses the traffic table** and emits only 5 of 9 columns.
3. Weather pills for `TAF`, `PIREP`, `WINDS` have **no CSS** — they render
   unstyled.
4. Traffic badge says `12 targets` over 7 rows.
5. Prototype **Dark Mode switch is not wired** to the `dark` state.
6. `SectionTitle()` is dead code (`page.tsx:39`).

## 7. Workflow

1. ~~Paste `docs/ui-redesign-brief.md` into v0~~ — **done.** Prototype at
   `C:\Users\Russell\src\stratux-aviation-dashboard-prototype`, reviewed and
   accepted with per-screen design-source decisions recorded in §6.1.
2. Translate the prototype into the files in §5.1 against the contract in §5,
   satisfying every unchecked item in §6.
3. Verify with `node dev/server.mjs` at <http://127.0.0.1:8080> — all ten
   screens, both themes, help drawer, modals, and a side-by-side against the
   original for data completeness (§6).
4. Commit. Only committed work reaches an image.
5. Build an image (`image_build/build.sh`, needs submodules initialized) and
   run it on the Pi.

## 8. What is left to the builder

- Translating the approved prototype design into AngularJS templates — the
  design call is made, the mechanical work is not.
- Concretizing the visual system into CSS: type scale, spacing scale, color
  tokens, dark/light theme structure.
- Deciding how the instrument-style screens frame their fixed-ID mounts
  without changing the mounts.
- Deciding how far the information-architecture rearrangement goes, subject
  to §2 non-goals.
- Working the §6 checklist to zero.
- Verification at each step; there is no automated test to lean on.
