# Stratux UI dev server

Runs the real `web/` UI locally in a browser, fully populated with fixture data,
without a Raspberry Pi, without Docker, and without building the Go binary.

```
node dev/server.mjs                # http://127.0.0.1:8080
node dev/server.mjs --port 3000
node dev/server.mjs --host 0.0.0.0  # listen on all interfaces (containers, LAN, tunnels)
```

`--port` / `--host` can also be given as `PORT` / `HOST` environment variables.
The default bind is loopback only.

Then edit files under `web/` and refresh the browser. There is no build step:
the UI is plain HTML/CSS/JS (AngularJS 1.x + mobile-angular-ui + OpenLayers) and
the server hands it off disk.

Requires Node 22+. No dependencies, nothing to install.

## Viewing from another machine

Everything — UI, REST and all WebSockets — is on the one port (8080), so a
single forwarded port is enough.

- **Inside a Docker container:** start with `--host 0.0.0.0`, otherwise a
  published port reaches nothing. Publish it (`-p 8080:8080`), or point a
  container on the same Docker network at `http://<container-name>:8080`.
- **Cloudflare Tunnel:** target `http://localhost:8080` (or the container
  address above). WebSockets pass through without extra config. For a
  throwaway URL with no account:
  `cloudflared tunnel --no-autoupdate --url http://127.0.0.1:8080`.

Tunnels serve the page over HTTPS; see the `wss://` note below for why the
live data still works.

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

## Deliberate deviations from production

**`status.Clock` is added.** The real Go `status` struct has no `Clock` field,
but `plates/js/traffic.js` and `plates/js/radar.js` both read `globalStatus.Clock`
— on real hardware those two screens display *"Invalid Date"*. It is supplied
here so the flaw does not dominate your attention while judging the UI.

Delete the `// CLOCK` line in `server.mjs` for byte-faithful behaviour, or fix
the Go struct — either is a real change worth making deliberately.

**`js/main.js` is rewritten on the fly to pick `wss://` on HTTPS pages.** The
file hardcodes `"ws://"` for every WebSocket URL, and browsers block `ws://`
from an HTTPS page — so behind a tunnel every screen loads but shows no live
data. (Modern browsers auto-upgrade `http://` links, so using the plain-HTTP
tunnel URL does not avoid it.) The server substitutes a protocol check when
serving that one file; over plain HTTP the result is still `ws://`, and the
file on disk is untouched. Real hardware is HTTP-only, so it never hits this.

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

## Putting the UI on a real Stratux

`dev/deploy-ui.sh` copies the committed `web/` UI onto a running Stratux over
SSH, so a UI change does not need a new image. One-time setup on the machine
that runs it:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519   # skip if you already have a key
ssh-copy-id pi@<stratux-ip>                         # asks for the Pi password once
```

Then:

```bash
dev/deploy-ui.sh pi@<stratux-ip>             # install the UI from the last commit
dev/deploy-ui.sh --restore pi@<stratux-ip>   # put back the UI the Pi first had
```

The host can also come from `STRATUX_HOST`; it defaults to
`pi@192.168.10.1`, the Stratux access point. Only committed files are sent,
the same as an image build.

On the Pi it unlocks the read-only SD card with `overlayctl` (as Stratux's
own updater does), saves the first UI it replaces as
`/opt/stratux/www.original` and the one before each install as
`www.previous`, swaps in the new files, stamps `stratux.appcache` so browsers
drop their cached copy, locks the card, reboots, and waits until the Pi
serves the new UI. `--no-reboot` skips the reboot; the new files may not show
until the next one. An official Stratux update (`.deb`) later replaces the UI
with the one it carries.

## A UI-only update package

`dev/build-ui-deb.sh [output-dir]` packs the committed `web/` UI into
`stratux-ui-<version>-all.deb` (package `stratux-ui`, any Pi model). The
version is the latest tag plus the commit count and hash, e.g.
`2.0-pre5+ui121.g3b84f34`.

Install it like any Stratux update: **Settings > System Update** uploads it and
the Pi installs it while rebooting. That path only works on Stratux built from
upstream `master` after June 2026; v2.0-pre4 and pre5 have a broken package
installer, so on those use `sudo dpkg -i` with the overlay disabled.

The files live in `/opt/stratux-ui/www` and are copied over `/opt/stratux/www`.
The first install saves the UI it replaces as `/opt/stratux/www.stock`;
`dpkg -r stratux-ui` puts it back. A later `stratux` package update overwrites
the UI with its own, and installing `stratux-ui` again re-applies the redesign.

## Not shipped

`dev/` is at the repo root, outside `web/`. `web/Makefile` copies an explicit
whitelist into the image, so nothing here can reach a built image or the `.deb`.
