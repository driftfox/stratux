# Stratux UI dev server

Runs the real `web/` UI locally in a browser, fully populated with fixture data,
without a Raspberry Pi, without Docker, and without building the Go binary.

```
node dev/server.mjs              # http://127.0.0.1:8080
node dev/server.mjs --port 3000
```

Then edit files under `web/` and refresh the browser. There is no build step:
the UI is plain HTML/CSS/JS (AngularJS 1.x + mobile-angular-ui + OpenLayers) and
the server hands it off disk.

Requires Node 22+. No dependencies, nothing to install.

## What it does

| | |
|---|---|
| Static files | Served from `web/` with caching disabled, so edits show up on refresh. |
| REST | `/getStatus`, `/getSituation`, `/getSettings`, `/getTowers`, `/getSatellites`, `/getRegion`, `/tiles/tilesets`, `/logs/…` answered from `fixtures/`. |
| WebSockets | `/status` (1 s), `/situation` (100 ms), `/traffic` (1 s), `/radar` (1 s), `/weather` (burst + trickle), `/developer` aliased to `/status`. Cadence matches `main/managementinterface.go`. |
| Writes | `/setSettings` merges only the keys the real handler accepts, so toggles behave as they do in production. `/setRegion` works. `/reboot`, `/shutdown`, `/restart` and friends acknowledge and do nothing. |

Data is **fixed**; only freshness counters move. Traffic ages are held constant
between 0.5 s and 6.2 s, well under the UI's 59-second staleness sweep, so the
aircraft list never empties itself.

Traffic positions are derived from `fixtures/situation.json` (ownship) plus two
dev-only fields on each target — `_bearingDeg` and `_distanceM` — so bearing and
distance are always consistent with where the aircraft sits on the map. Those
`_`-prefixed fields are stripped before the payload is sent.

## Fixtures

Edit these and restart the server:

| File | Feeds |
|---|---|
| `status.json` | `/getStatus` + `/status` websocket — the status, settings and developer screens |
| `situation.json` | `/getSituation` + `/situation` websocket — GPS, radar ownship, map ownship, gmeter |
| `settings.json` | `/getSettings` — the whole settings screen, theme, watch list |
| `traffic.json` | `/traffic` + `/radar` — aircraft and vessel list, map and radar symbols |
| `weather.json` | `/weather` — METAR/TAF/PIREP feed |
| `towers.json` | `/getTowers` — tower screen and the status screen's tower count |
| `satellites.json` | `/getSatellites` — GPS sky view |

Time-dependent values (`Clock`, `Uptime`, `GPSTime`, satellite ages, weather
report times) are recomputed on every tick so the screens do not go stale while
you work.

## Deliberate deviation from production

**`status.Clock` is added.** The real Go `status` struct has no `Clock` field,
but `plates/js/traffic.js` and `plates/js/radar.js` both read `globalStatus.Clock`
— on real hardware those two screens display *"Invalid Date"*. It is supplied
here so the flaw does not dominate your attention while judging the UI.

Delete the `// CLOCK` line in `server.mjs` for byte-faithful behaviour, or fix
the Go struct — either is a real change worth making deliberately.

## Known mismatches the UI tolerates (these also exist on real hardware)

Faithfulness is deliberate: the mock is not more forgiving than the backend.

- `status.RY835AI_connected` (read by `developer.js`) — removed from Go.
- `settings.GDL90MSLAlt_Enabled` (read by `settings.js`) — not in the Go struct, so the toggle never persists.
- `settings.RegionSelect` (read by `status.js`) — the struct has `RegionSelected` (an int).
- `/getWeather` does not exist; all weather arrives over the websocket.
- `/developer` is not a real endpoint; aliased to `/status` here since `developer.js` uses `/status` anyway.

## Not covered

- `/jsonio`, `/gdl90` — consumed by external tools, not by the UI.
- Real map tiles. `/tiles/tilesets` returns `{}`, so the basemap is OpenLayers'
  OSM layer. This matters: `map.js` attaches its aircraft layers *inside* the
  tilesets callback, so that endpoint must answer or the map shows no aircraft.

## Not shipped

`dev/` is at the repo root, outside `web/`. `web/Makefile` copies an explicit
whitelist into the image, so nothing here can reach a built image or the `.deb`.
