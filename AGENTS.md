# AGENTS.md

Stratux — open-source ADS-B/UAT/OGN traffic and weather receiver for Raspberry Pi.
Written for agents; every line is something you would probably get wrong without it.

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

## Build commands

```
make            # = make all: libdump978.so, xdump1090, xrtlais, stratuxrun, fancontrol
make dpkg       # stratux-<version>-<arch>.deb — this is what ships
make www        # copies web/ -> $(STRATUX_HOME)/www (only on Linux; writes to /opt/stratux)
make dall       # make all inside Docker
make ddpkg      # make dpkg inside Docker — what CI runs
make clean
```

- Main binary target is **`stratuxrun`** (builds `./main/`), not `gen_gdl90`.
  `.vscode/tasks.json` still says `make gen_gdl90` — that target no longer exists.
- Version comes from `scripts/getversion.sh` = `git describe --tags --abbrev=0`.
  A shallow clone without tags builds garbage or fails; CI sets `fetch-depth: 0`.
- `debug=true make` adds `-gcflags '-N -l'`.

## Testing and linting

- **There are no unit tests.** Zero `*_test.go` files in the repo.
- `make test` does not run tests — it *compiles* the standalone programs in `test/`
  (`replay.go`, `uat_read.go`, `extract_metar.go`, …). Some need hardware or librtlsdr.
- **No linter or formatter config exists** (no golangci-lint, no gofmt CI step).
- CI's only gate is: does `make ddpkg` succeed. Manual verification against a
  running device or the dev server below is the real feedback loop.

## Web UI (`web/`)

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

## Packaging and images

- `image_build/build.sh` **git-clones the repo into pi-gen** rather than using your
  working tree. **Uncommitted changes will not be in the image.** Commit first.
- `image_build/pi-gen` is a submodule; the script skips pi-gen stages 3–5 and
  rsyncs `image_build/stage2/10-stratux/` in as a custom stage.
- Output: `image_build/pi-gen/deploy/*.img` plus the `.deb`.
- `web/Makefile` copies an explicit whitelist into the www dir
  (`css js img plates index.html alert.wav stratux.appcache`). Anything outside
  `web/` — including `dev/` — can never reach the image or the `.deb`.

## CI (`.github/workflows/`)

- `ci.yml` — on push to `master` and on PRs, runner `ubuntu-24.04-arm`, runs
  `make ddpkg`, uploads the `.deb`. No test, lint, or typecheck step.
- `release.yml` — on tags `v*.*`, additionally runs `image_build/build.sh` and
  attaches the image to a draft release.

## Conventions

From `docs/DEVELOPING.md`:

- Match the coding style of the file you are editing or the files around it.
  There is no repo-wide formatter, and the existing style varies by era.
- Fork + PR. Trivial one-liners may go straight to `master`.
- Code should be self-documenting; external docs are for general topics
  (OS setup, protocols), not for explaining a specific function.

## Other docs

- `docs/DEVELOPING.md` — build modes, repo layout, release flow, OTA update path.
- `docs/dev_setup.md` — remote-on-Pi (recommended) vs. local x86 Linux setup.
- `docs/app-vendor-integration.md` — the API for third-party EFB apps.
- `dev/README.md` — local UI dev server and its fixtures.
