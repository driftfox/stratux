# Stratux UI Redesign — Design Brief

Paste everything below this line into v0 (v0.app). It is written to be
self-contained: the reader has no access to the Stratux repository.

---

You are a senior product designer. Build a complete, navigable design
prototype of a real aviation web application called **Stratux**.

This is a **design prototype**, not production code. You may use React,
Tailwind, and shadcn/ui — your normal stack. Mock data lives inline in the
component files. There is no backend. Every screen must render fully
populated, as a real product screenshot would, not as an empty wireframe.

Deliver the whole application in one pass: the shell plus all ten screens
below, navigable via your normal routing.

## 1. What Stratux is

Stratux is an open-source ADS-B / weather receiver that flies in light
aircraft. The hardware is a Raspberry Pi in a small case with software-defined
radios. It sits in the cockpit and receives:

- **1090 MHz ADS-B** — positions of nearby aircraft
- **978 MHz UAT / FIS-B** — weather: METARs, TAFs, NEXRAD radar, SIGMETs, PIREPs, NOTAMs
- **OGN (868 MHz)** — gliders and trackers
- **AIS (162 MHz)** — marine vessels
- **GPS** — ownship position; an **IMU** for attitude; a **barometer** for pressure altitude

The pilot connects a phone or tablet to the Stratux's own WiFi access point
and opens its web page. The device has **no internet connection in flight**,
so the interface must work entirely offline.

**Where and how it is used:** in a cockpit, in daylight, on a tablet held at
arm's length, sometimes on a phone. Often one-handed, sometimes with the
aircraft moving. Glances are short. Touch targets must be generous. Data must
be readable in bright sun and in a dark cockpit.

**Who uses it:** cost-conscious pilots, homebuilt-experimental aircraft
owners, and glider pilots — people who chose a $200 open-source receiver
over a $2,000 certified one. They are technically capable but not
professional software users; they are aviators first.

**Non-negotiable:** this is a reskin. Nothing gets added. Nothing gets
removed. Every screen, control, field, and toggle below must exist in your
output. Layout, grouping, hierarchy, navigation order, and visual treatment
are entirely yours to change.

## 2. The application shell

A top navbar, a slide-out left menu, a slide-out right **Help** drawer, and a
main content area.

- **Left menu** items, in this order: Status, Weather, Traffic, GPS/AHRS,
  Towers, Logs, Settings, Radar, Map, Developer. (Weather and Towers only
  appear when the relevant radios are enabled; Developer only appears in
  developer mode — treat all ten as present in the prototype.)
- **Help drawer** shows contextual help for the current screen — a short
  prose explanation of what the pilot is looking at. Every screen has its own
  help text; the same visual treatment applies throughout.
- The Help drawer and menu must feel like first-class parts of the product,
  not afterthoughts. Contextual help matters when you're at 8,000 feet.

## 3. The ten screens

### 3.1 Status (home screen)
The one-glance health check. Shows:

- App version and build (small, quiet — but tappable to reveal a hidden
  developer mode)
- A green/red **Connected** badge, and a yellow **Developer Mode** badge when active
- **Recent clients** (count of connected devices), **SDR devices** detected,
  Ping/Pong receiver status, Pong heartbeats
- **Message rate bars** — one horizontal bar each for UAT, 1090ES, AIS, OGN,
  showing current messages/minute as a filled bar against the all-time peak
  as a number. This is the signature visual of the screen: live throughput.
  An OGN noise bar (0–25 dB, color shifts green → yellow → orange → red)
- **OGN statistics**: background noise, receiver gain, link to an RF spectrogram
- **UAT statistics** — a small 2×4 grid: Towers, METARs, TAFs, NEXRAD, PIREP,
  SIGMET, NOTAMs, Other
- **GPS**: hardware detected, protocol, solution quality with accuracy in
  metres, satellites locked / seen / tracked
- **System row**: uptime (d/hh:mm:ss), CPU temperature (°C and °F), free
  storage in MiB
- **Frame totals** per radio
- An **Errors** panel (red, only present when errors exist)

One action: a **Region select** modal (US / EU) shown on first boot.

### 3.2 Weather
Decoded aviation weather as it arrives. Two sections in an accordion:
**Watch List** (the pilot's chosen airports) and **Recent Reports** (last 10).

Each report row shows: ICAO **location**, **type** badge (METAR, SPECI, TAF,
PIREP, WINDS), **age** ("02h 14m old", or "from now" if a forecast), and the
**full raw report text**.

Flight category badges are the color system here: **VFR** green, **MVFR**
blue, **IFR** crimson, **LIFR** dark orchid. Non-METAR types get neutral
badges (TAF, PIREP, WINDS). No interactive controls — it is a reading screen.

### 3.3 Traffic
Live tabular list of everything Stratux has heard in the last minute. Two
tables:

1. **ADS-B and TIS-B Traffic** — targets with valid positions, sorted nearest first
2. **Basic Mode S and No-Position Messages** — targets without position, sorted by ICAO

Columns for table 1: callsign or tail number, ICAO code or squawk, category,
location *or* distance + bearing, altitude (ft, rounded to 25), vertical speed
(with climb/descent arrows), speed (kt), course (°), signal power (dB), age (s).
Table 2 replaces location with an estimated distance.

Each row leads with a colored **callsign chip**, plus a glyph — aircraft or
ship. The chip color encodes receiving source *and* target type: 1090ES
cornflower blue / sky blue, UAT dark orange / orange, OGN green / green
yellow. AIS vessels are colored by **vessel category** instead — cargo orange,
passenger blue, tanker red, sailing maroon, fishing silver, tugs cyan, and so
on.

Four **toggle switches** in a footer strip: Show Tail Number, Show Squawk,
Show Category, Show Distance. These change the columns live.

A footer note explains that Mode S targets without position are estimated.

### 3.4 GPS / AHRS
The avionics self-test screen. Four panels:

- **AHRS** — a real **attitude indicator** (artificial horizon: sky, earth,
  pitch ladder, roll scale, slip/skid ball, heading tape along the bottom).
  Below it: four LED status chips (**Ready**, **GPS**, **ATT**, **ALT** — each
  green/amber/red), two buttons (**Set Level**, **Zero Drift**), and an
  eight-cell readout grid: Heading, Pitch, Roll, Pressure Altitude /
  Magnetic Heading, Slip/Skid, Turn Rate, G Load.
  Overlay warnings appear on the horizon when degraded ("GROUND TEST MODE —
  GPS REQUIRED", "NO AHRS AVAILABLE", "CALIBRATING — FLY STRAIGHT", "WARNING —
  USING GPS PSEUDO AHRS"). Tapping the AHRS title collapses the other three
  panels for a fullscreen horizon.
- **GPS** — a small scrolling world map with a crosshair at ownship, plus
  Location (lat/lon ± accuracy m), Altitude MSL (± accuracy ft, with vertical
  speed), Height above WGS-84 ellipsoid, Track (° @ kt).
- **Satellites** — table of satellite ID (G=GPS, S=SBAS, R=GLONASS), elevation,
  azimuth, signal in dB-Hz; a checkmark when in solution. Footer: solution
  quality and sample rate, plus "N in solution; N seen; N tracked".
- **G-Meter** — a round analog dial with current, min, and max G pointers,
  red limit marks at the configured G limits, and a RESET control on the dial.

### 3.5 Towers
A live table of UAT ground stations heard in the last minute. Columns:
**Location** (lat/long in DMS), **Current Power (dB)**, **Avg Power (dB)**,
**Max Power (dB)**, **Msgs Last Minute**. Green/red connection badge.

### 3.6 Logs
Deliberately minimal: a link to `stratux.log`, a link to the log directory
(system, AHRS, replay logs), and two lines of browser debug info (user agent,
viewport size).

### 3.7 Settings
The biggest screen — a two-column arrangement of panels. Every field below
must exist.

- **AHRS** — button *Set AHRS Sensor Orientation* (opens a calibration
  walkthrough modal), and *G Limits* (space-separated negative/positive
  values, e.g. `-1.76 4.4`)
- **Commands** — *System Update* file picker with Install / Uploading states,
  **Reboot** button, **Shutdown** button (both confirm via modal)
- **Theme** — a single *Dark Mode* switch
- **Tracker Configuration** (only when an OGN tracker is present) — Tracker
  Address Type, Tracker Address (hex), Aircraft Type, Pilot Name,
  Registration, Transmit Power (dBm), and a **Configure Tracker** button
- **Configuration** — Ownship Mode S/OGN Codes, Watch List, PPM Correction,
  SDR Dump 1090 ES Gain (developer mode), Serial Output Baudrate (conditional),
  Static IPs, Pressure Altitude Offset (when a baro is present), and a
  *GDL90 bearingless target circle emulation* switch. Text fields save on
  blur or Enter — there is no Save button.
- **WiFi Settings** — WiFi Mode (AccessPoint / WiFi-Direct / AP+Client),
  WiFi Country, SSID, Network Security switch, Passphrase, WiFi-Direct Pin
  (conditional), WiFi Channel (conditional), Stratux IP Address, Internet
  Passthrough switch, and a repeatable list of client networks with
  add/remove. One explicit **Submit WiFi Changes** button, then a
  success/error modal.
- **Hardware** (developer mode) — eleven switches: GPS, 978 MHz (UAT),
  1090 MHz (ADS-B/Mode-S), 868 MHz (OGN), 162 MHz (AIS), Internet (OGN APRS),
  AHRS Sensor, Baro Sensor, Ping ADS-B, Pong ADS-B Receiver, OGN Transmission
  via I²C/GPIO HAT — plus *Minimum fan duty cycle %*. These auto-save on toggle.
- **Diagnostics** (developer mode) — Show Traffic Source in Callsign, Verbose
  Message Log, Record Replay Logs, Record Trace Logs, Record AHRS Logs,
  Persistent logging (triggers a reboot-required modal), and a Pong Firmware
  Update file picker.
- **Raw Configuration** (developer mode) — the raw JSON config dump.

Modals: reboot confirmation, shutdown confirmation, reboot-required, the
three-step AHRS orientation calibration (set forward → finish → failed),
WiFi success, WiFi errors, plus status banners for rebooting / shutting down.

**Saving model to preserve visually:** toggles save instantly; text fields
save on blur; only WiFi and Tracker have explicit submit buttons. The
interface should make that distinction legible rather than hiding it.

### 3.8 Radar
A **panel-mount instrument**. A north-up, own-ship-centered radar scope:

- Black scope frame, white range rings (outer = full range, inner = half
  range = the **alarm circle**), N/S/W/E compass letters
- Own-ship aircraft symbol at center in blue with its **flight level** beneath
- The whole scope **rotates** so own track always points up
- Each contact: a plane symbol rotated to its heading, with three labels —
  altitude difference in hundreds of feet with a climb/descent arrow
  (`+5↑` / `-2↓`), ground speed (`245kts`), and the tail number
- A dashed **trail** behind each contact
- Bearingless targets (no position) as circles sized by estimated distance
- Fixed overlay controls: **Ra− / Ra+** (range steps 2 → 5 → 10 → 20 → 40 nm),
  **Alt+ / Alt−** (altitude band steps ±500 → ±1,000 → ±2,000 → ±5,000 →
  ±10,000 → ±50,000 ft), **F/S** fullscreen toggle, and a **sound toggle**
  cycling `BpSp` → `Beep` → `Spch` → `SnOff`
- Top-left shows range ("10 nm"), top-right shows the altitude band ("±2000ft")
- Header pills: connection state, altitude source (**Baro-Alt** green, or
  amber "No Baro-Alt, using GPS-Alt" / "No Baro-Alt, using ADSB", red
  "No Altitude!"), **No GPS!** when invalid, and CPU temperature
  (blue < 70 °C, amber 70–79, red ≥ 80)
- Contacts inside the inner circle trigger a beep and a spoken callout:
  "Traffic at 10 o'clock plus 500 feet"

This screen should feel like equipment, not like a web page.

### 3.9 Map
Also **panel-mount**. A full-bleed moving map:

- Base layers: OpenStreetMap, OpenAIP aeronautical, plus any user-uploaded
  tilesets — exposed through a collapsible **layer switcher** in a map corner
- Live aircraft as colored, **rotating aircraft icons** chosen by type
  (light, heavy, helicopter, glider, balloon, undefined, vessel), recolored by
  receiving source, with a label beneath: tail number, altitude in ft, speed in kt
- Opacity **fades with age** — a target dims linearly over 59 seconds after
  its last report. AIS vessels hold full opacity for 30 minutes instead.
- **5 NM snail trails** behind each aircraft
- Own-ship marker (a map pin), map recenters on first GPS fix
- Panel heading "Traffic Map" with the connection badge

### 3.10 Developer
Four small panels: **Restart Stratux application**, **Logfile** (size,
Download, Delete), **AHRS Log Files** (size, Download, Delete), **Database**
(Download). Note: delete actions currently have no confirmation — preserve
that behaviour.

## 4. Design direction

**Reference point:** a modern tablet aviation app — ForeFlight, SkyDemon.
Generous spacing, large touch targets, real visual hierarchy, a restrained
palette, contemporary app chrome. Not a panel-mount glass cockpit…

**…with three exceptions.** **Map**, **GPS/AHRS**, and **Radar** should lean
toward instrument avionics: denser, more technical, numerics-forward,
data-first layouts that look like equipment rather than a website. Those
three are where the "this is serious aviation gear" impression is won. The
other seven screens stay modern tablet.

**Dark-first.** Design the dark theme as the primary artifact — it is what a
cockpit wants. The light theme must still exist and work as a simpler,
faithful derivation of the same system (the app ships a working theme toggle).
*Construction note for whoever translates this: light is the base stylesheet
and `css/dark-mode.css` holds the dark override — but dark is still the theme
being designed. See §5.1.1 of the contract.*

**Anti-goals — what would make this a failure:**

- It must not look cheap or AI-generated. Specifically avoid: purple/blue
  gradient hero areas, emoji, generic Bootstrap-looking cards, oversized
  marketing headline type, gratuitous rounded pills on everything, and a
  rainbow of arbitrary accent colors.
- No decorative imagery, no illustrations, no charts that aren't already in
  the spec. The data *is* the visual interest.
- No new features. If you find yourself wanting to add a control, a tab, a
  chart, or a metric that isn't listed above — don't.

**What "professional and expensive" means here:** one restrained accent color
plus semantic colors used only for meaning (green/amber/red for state, the
flight-category colors, the source-encoding colors); a tight type scale;
**tabular numerals** everywhere numbers appear, since values tick live;
consistent spacing on a 4px grid; hairline rules instead of heavy borders;
clear hierarchy between label, value, and unit; deliberate information
density — aviation people want data, not whitespace.

**Preserve these color meanings** — they carry information and are referenced
by help text: the traffic chip colors above (source × target type, with AIS
vessel categories), flight categories (VFR green / MVFR blue / IFR crimson /
LIFR dark orchid), and status semantics (green ok / amber degraded / red bad).
These values are applied from JavaScript, so the prototype should use them as
given rather than inventing a tidier mapping.

**Touch:** minimum comfortable target ~44px. The app is used one-handed in a
moving aircraft.

## 5. Mock data

Use realistic, plausible values — the prototype is judged on whether it looks
like a screenshot from a real flight.

- **Status**: UAT ~480 msgs/min against a peak of ~1,400; 1090ES ~95 against
  ~600; 4 SDR devices; 3 connected clients; 182 METARs, 61 TAFs, 940 NEXRAD,
  12 SIGMETs, 7 PIREPs, 44 NOTAMs; GPS "3D GPS + SBAS", 11 satellites locked
  of 22 seen / 29 tracked, ±1.2 m; uptime 6h 14m 03s; CPU 48.9 °C / 120.0 °F;
  free storage 4,208 MiB; no errors.
- **Traffic**: 12 aircraft with real-looking callsigns and registrations
  (N172DB, N88KP, SWA2187, UAL1442, DAL993, N5198F, CYQ8821, JBU614, N4472S,
  N737SP, UPS1309, EJA552) spanning altitudes 1,200 ft to FL380, speeds
  0–480 kt, mixed sources, mixed vertical speeds, ages 0.3–45 s; plus 4
  bearingless Mode S targets in the second table. Include at least one
  glider and one AIS vessel.
- **Weather**: real-format METARs for KBOS, KATL, KORD, KLAX covering VFR,
  MVFR, IFR and LIFR; one SPECI; one TAF; one PIREP; one winds-aloft report.
  Use genuine METAR syntax, e.g.
  `KBOS 121956Z 27012KT 10SM FEW250 18/09 A3002 RMK AO2 SLP164`.
- **GPS/AHRS**: 14 satellites with plausible NMEA IDs (G07, G12, G15, S33,
  R04…), elevations −5 to 89°, azimuths 0–359°, signals 20–48 dB-Hz; heading
  274°, pitch −1.5°, roll 4°, pressure altitude 8,450 ft, magnetic heading
  278°, slip/skid 1.2°, turn rate ∞, G load 1.05.
- **Towers**: 6 towers with lat/long in DMS and powers between −12 and
  −31 dB, message counts 40–460.
- **Radar**: 7 contacts — varied altitude deltas including two inside the
  alarm circle, speeds 110–450 kt, tails, and a couple of bearingless circles.
- **Map**: the same 12 aircraft, positioned plausibly around ownship with
  trails.
- **Settings**: filled in — SSID `Stratux`, ownship code `F00000`, watch list
  `KBOS KATL KORD KLAX`, channel 1, IP `192.168.10.1`, G limits `-1.76 4.4`,
  gain 37.2 dB, and so on.

## 6. Output

Produce the complete, runnable application: routing so all ten screens are
reachable from the left menu, the shell (navbar, menu, help drawer), all
screens populated with the data above, and both themes with dark as default.
