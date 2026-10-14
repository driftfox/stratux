# AGENTS.md

This file provides guidance to coding agents (Claude Code, etc.) when working with code in this repository.

## What Stratux is

Stratux turns a Raspberry Pi + RTL-SDR dongles into a multi-band aviation receiver
(1090 ADS-B, 978 UAT, OGN/FLARM on 868MHz, AIS) and broadcasts the fused traffic,
weather, GPS and AHRS data to Electronic Flight Bags (ForeFlight, etc.) as **GDL90**
over Wi-Fi. It is a single long-running Go daemon plus several bundled C programs, served
alongside a web configuration UI. This repo is the EU-flavored community fork (originally
cyoung/Stratux) that also targets the US and rest of world.

## Environment limits (this checkout)

- **The Go build does not work on Windows.** `main/sdr.go` calls `syscall.Sysinfo`
  (Linux-only) and the module pulls cgo deps: `github.com/jpoirier/gortlsdr`
  (needs librtlsdr) and `github.com/mattn/go-sqlite3`. Do not attempt `go build ./...`
  here as a verification step — it fails for reasons unrelated to your change.
- `make` is **not installed** on this machine. `go`, `docker`, and `wsl` are.
- Real build paths: `make ddpkg` (Docker, Debian bookworm) or native Linux/WSL.
- Submodules are **not initialized by default** — `git submodule status` shows `-`
  prefixes. Run `git submodule update --init --recursive` before any build.
  Affected: `dump1090`, `rtl-ais`, `ogn/ogn-tracker`, `image_build/pi-gen`.

## Build

Stratux mixes Go and C and pulls C sources in via git submodules. **Always init submodules
first** or the build fails:

```sh
git submodule update --init --recursive
```

Common targets (see `Makefile`):

| Command | Result |
|---|---|
| `make` / `make all` | Builds everything: `libdump978.so`, `dump1090`, `rtl_ais`, the main `stratuxrun` binary, and `fancontrol` |
| `make stratuxrun` | Just the main Go daemon (needs `libdump978.so` present) |
| `make www` | Copies the web UI into `$STRATUX_HOME/www` (default `/opt/stratux`) |
| `make optinstall` | Installs binaries/libs/web/config into `/opt/stratux` (needed before running on a dev machine so it can find dump1090, ogn-rx, etc.) |
| `make dpkg` | Builds the `.deb`. **Only works on the target OS/arch** (Debian 12 Bookworm, arm64) |
| `make dall` / `make ddpkg` | Runs `make all` / `make dpkg` inside Docker (`docker_run.sh`) — use this to produce target-arch artifacts from any host |
| `make test` | Compiles the standalone diagnostic utilities in `test/` (see Testing) |
| `make clean` | Cleans Go output and the C submodule builds |

Notes:
- The Go build needs CGO and the locally-built shared lib: the Makefile sets
  `LIBRARY_PATH=$(CURDIR)` and `CGO_CFLAGS_ALLOW="-L$(CURDIR)"`. Replicate these env vars if
  building `stratuxrun` by hand.
- `make debug=true ...` adds `-gcflags '-N -l'` for delve debugging.
- Version comes from the latest git tag (`scripts/getversion.sh`); arch from `uname -m`
  normalized by `scripts/getarch.sh` (`x86_64`→`amd64`, `aarch64`→`arm64`). The chosen
  `ogn-rx-eu` prebuilt binary depends on arch.
- There is **no separate lint step**; rely on `go vet`/`gofmt` and the CI build (`.github/workflows/ci.yml`).

## Running & testing

- **On the Pi**, Stratux runs as the systemd `stratux` service. Aliases (from
  `image_build/.../stxAliases.txt`, available in the image shell): `stxstart`, `stxstop`,
  `stxrestart`. Typical dev loop: `stxstop` then `make && make install && stxrestart`.
- **Not running as root** (i.e. local desktop dev), `main()` remaps the web dir to `./web/`
  next to the binary and config to `~/.stratux.conf` instead of `/opt/stratux` and
  `/boot/firmware/stratux.conf`.
- The binary is `stratuxrun`. Useful flags (parsed in `main/gen_gdl90.go`):
  `-replay -uatlog <file>` (replay a UAT log), `-trace <file> -traceSpeed -traceFilter`
  (replay a recorded trace; filter contexts: `ais,nmea,aprs,ogn-rx,dump1090,godump978,lowpower_uat`),
  `-port <n>`, `-cpuprofile <file>`, `-write-network-config`.
- **There are no Go unit tests** (`*_test.go`). The `test/` directory is a collection of
  independent `package main` diagnostic tools (e.g. `icao2reg.go`, `uat_read.go`,
  `nexrad_annunciator.go`); `make -C test` just compiles each one. Sample input lives in
  `test-data/`.
- **VSCode** has preconfigured Build + debug tasks (`.vscode/tasks.json`, `launch.json`).
  ⚠️ These still reference an older `gen_gdl90` binary/target; the current Makefile produces
  `stratuxrun`. If using them, expect to update the program/target name.

## Web UI development (`web/`)

- The entire UI is here: **AngularJS 1.x + ui-router + mobile-angular-ui + OpenLayers**.
  Plain static HTML/CSS/JS. **No `package.json`, no bundler, no build step** —
  edit a file, refresh the browser. Do not introduce a toolchain casually; the
  absence is deliberate and `web/Makefile` assumes plain files.
- Served off disk by `http.FileServer` in `main/managementinterface.go`
  (`STRATUX_WWW_DIR`, normally `/opt/stratux/www/`). Not embedded in the binary.
- **Run it locally with `node dev/server.mjs`** → <http://127.0.0.1:8080>.
  Static files plus fixture REST/WebSocket data; no Pi, no Go build, no Docker.
  Endpoints, cadences, fixtures, and known UI/backend mismatches: `dev/README.md`.
  The Go backend will not start without hardware, so this is the only cheap local loop.
  It binds loopback only; from a container, LAN, or tunnel use `--host 0.0.0.0`
  (single port — UI, REST and WebSockets all on 8080).
- **The UI is driven by WebSockets**, not REST: `/status`, `/situation`, `/traffic`,
  `/weather`, `/radar`. REST (`/getStatus`, `/getSettings`, `/getTowers`,
  `/getSatellites`) is secondary. `/getWeather` does not exist.
- **`/tiles/tilesets` must return JSON**, not 404. `plates/js/map.js` attaches the
  aircraft layers *inside* that callback, so with no answer the map silently shows
  zero aircraft.
- `web/stratux.appcache` enumerates every asset. `web/Makefile` appends the build
  time and git hash to the *deployed* copy — that is what busts AppCache. If you
  add a new JS/CSS file, add it to the manifest too.
- `/developer` in `web/js/main.js` is not implemented server-side; `developer.js`
  uses `/status` anyway.

## Architecture

### The daemon (`main/` package → `stratuxrun`)

`main/gen_gdl90.go` holds `func main()` and the central shared state. Everything else in
`main/` is a feature module that `main()` wires together by launching goroutines. Key shared
globals (all defined in `gen_gdl90.go`, guarded by mutexes):

- `globalSettings` — the user config, serialized to `stratux.conf`. Adding a setting means
  adding a struct field here; it is automatically exposed via the `/getSettings` /
  `/setSettings` API and the web UI reads it by field name.
- `globalStatus` — runtime status (message counts, device state, CPU temp, errors), exposed
  via `/getStatus`.
- `mySituation` — current GPS/AHRS fix and attitude.

### Signal sources — three different C-integration patterns

Understanding these three patterns is the key to the codebase:

1. **978 UAT → linked C library.** `dump978/` is compiled into `libdump978.so` and bound into
   Go through the `godump978` package via cgo (`#cgo LDFLAGS: -ldump978`). Raw UAT frames are
   decoded in-process, then parsed by the `uatparse` package (FIS-B weather, NEXRAD, etc.).
2. **1090 ES, OGN, AIS → external subprocesses.** `main/sdr.go` launches `dump1090`
   (FlightAware fork, submodule) and pipes its output over TCP `:30006`; `ogn-rx-eu` (prebuilt
   binary in `ogn/`) for 868MHz; and `rtl_ais` (submodule) for AIS. Each is spawned with
   `exec.Command`, monitored, and **auto-restarted on crash**. OGN APRS parsing is in
   `main/ogn.go` / `main/ogn-aprs.go`; AIS in `main/ais.go`.
3. **GPS / baro / IMU → direct hardware.** `main/gps.go` (serial GPS, large file with chip
   autodetect for various u-blox/SiRF modules), `main/sensors.go`, and the `sensors/` package
   (BMP280/388 baro, ICM20948/MPU9250 IMU drivers).

SDR dongles are assigned to bands by EEPROM serial prefix (`stx:1090`, `stx:978`, etc.);
`main/sdr.go` owns this assignment and reconfiguration when settings change.

### Fusion and output

`main/traffic.go` is the heart: it merges traffic targets from all sources, dedupes,
extrapolates positions between updates, and estimates Mode-S target distance. Outputs:

- **GDL90** binary messages — `gen_gdl90.go` builds them; sent over **UDP :4000** to EFB
  clients (`main/network.go`, `clientconnection.go`) and mirrored over the `/gdl90` WebSocket.
- **FLARM / NMEA** (PFLAA/PFLAU) — `main/flarm-nmea.go`, over **TCP :2000** and serial.
- **Bluetooth LE** traffic output, **Cursor-on-Target** (`cot-in.go`), **X-Plane**
  (`xplane.go`).
- Traffic/situation history logged to SQLite via `main/datalog.go`.

### Web UI + HTTP/WebSocket API (`main/managementinterface.go`)

`managementInterface()` is the HTTP server. It serves the web UI and the JSON/WebSocket API
documented in `docs/http-api.md` (e.g. `GET /getStatus`, `/getSituation`, `POST
/setSettings`, WebSocket `/gdl90`, `/situation`, `/traffic`, `/weather`). No auth — it's a
local AP network. The frontend (`web/`) is an **AngularJS** single-page app (mobile-angular-ui +
OpenLayers for maps). Each screen is a "plate": HTML in `web/plates/*.html` with its controller
in `web/plates/js/*.js`, talking to the API above.

### Other binaries

- `fancontrol_main/` → `fancontrol` binary (PID-controlled cooling fan), its own systemd
  service.
- `common/` holds code shared between `main` and `fancontrol` (CPU temp, aviation equations,
  helpers).

## Repo layout quick map

- `main/` — the daemon (Go). `common/` — shared Go helpers.
- `dump978/` (C lib, built locally), `godump978/` (cgo wrapper), `uatparse/` (UAT/FIS-B parser).
- `dump1090/`, `rtl-ais/`, `ogn/ogn-tracker/`, `image_build/pi-gen/` — git **submodules**.
- `sensors/` — baro/IMU hardware drivers.
- `web/` — AngularJS UI and assets.
- `debian/` — systemd units, udev rules, `.deb` packaging scripts, boot/network templates.
- `image_build/` — pi-gen stages that produce the Raspberry Pi SD-card image.
- `test/` — standalone diagnostic tools. `test-data/` — sample logs. `notes/` — design notes.
- `dev/` — local web UI dev server with fixtures (`dev/README.md`) and `deploy-ui.sh`.
- `docs/` — developer docs: architecture, building, dev setup, the HTTP/WebSocket API
  (`http-api.md`), the integration guide (`integration/`), the settings reference, and
  hardware support (`hardware/`). Index in `docs/README.md`.

## Versioning & OTA

Semantic `MAJOR.MINOR` (e.g. `3.6`). **OTA updates work only between minor versions.** Two OTA
mechanisms run through the same boot-time path (`debian/stratux-pre-start.sh`): a `.deb` for the
Stratux app, and a legacy update script (`US`) for system-level changes. Full flow in
`docs/building.md`.

## Packaging and images

- `image_build/build.sh` **git-clones the repo into pi-gen** rather than using your
  working tree. **Uncommitted changes will not be in the image.** Commit first.
- `image_build/pi-gen` is a submodule; the script skips pi-gen stages 3–5 and
  rsyncs `image_build/stage2/10-stratux/` in as a custom stage.
- Output: `image_build/pi-gen/deploy/*.img` plus the `.deb`.
- `web/Makefile` copies an explicit whitelist into the www dir
  (`css js img maui plates index.html alert.wav stratux.appcache`). Anything outside
  `web/` — including `dev/` — can never reach the image or the `.deb`.

## CI (`.github/workflows/`)

- `ci.yml` — on push to `master`, on PRs, and manually (`workflow_dispatch`), runner `ubuntu-24.04-arm`, runs
  `make ddpkg`, uploads the `.deb`. No test, lint, or typecheck step.
- `release.yml` — on tags `v*.*`, additionally runs `image_build/build.sh` and
  attaches the image to a draft release.

## Conventions

- Match the style of the file/area you are editing (project guidance in `docs/building.md`).
- User-facing docs live in the GitHub **wiki**; **developer** docs that track the code live in
  `docs/` in this repo (so they're reviewed in PRs alongside code changes).
- Keep the image small: the target is to fit the SD-card image on a 4GB card.
