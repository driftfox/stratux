# Switchable UI themes — design

**Status: draft, awaiting approval.** Branch: on top of `ui-redesign`.

## Intent

Stratux serves exactly one web UI, out of `/opt/stratux/www` on a read-only
root filesystem. The user wants several complete front ends ("themes") on the
same image, with the choice of which one is served at `/`.

Two reasons, both the user's:

1. **Ship the redesigned UI and the classic UI side by side.** Anyone who
   dislikes the redesign switches back with one tap.
2. **Open the door to other people's front ends.** A developer or designer can
   build an entirely custom front end against the existing HTTP/WebSocket API
   and install it on their Stratux without rebuilding the image.

What would make it a failure even if it works: a pilot installs a theme, it is
broken (blank page, no settings screen), and they cannot get back to a working
UI from the iPad.

## Goals

- Two **built-in** themes ship in the read-only image: the redesigned UI and
  the classic UI. Both are maintained as Stratux evolves; new settings are
  added to both.
- Users **install** additional themes two ways:
  - upload a zip on the theme manager page; usable immediately, no reboot;
  - copy a theme folder onto the SD card's boot partition from a PC; it
    appears the next time the theme manager lists themes.
- One **active theme** for the whole device (not per client), stored in
  `stratux.conf`. Switching takes effect immediately, no restart.
- A **theme manager page** served by the Go backend, independent of every
  theme, that is also the recovery page. It lists themes, switches the active
  one, uploads, and deletes installed (non-built-in) themes.
- A **starter kit** for theme developers: a contract doc, dev-server support,
  and a minimal example theme.

## Non-goals

- No server-side code in themes. A theme is static files only.
- No new API for themes. Themes use the API documented in `docs/http-api.md`.
- No requirement that a theme expose every setting. If a theme cannot change
  a setting, the user switches to one that can.
- No theme marketplace, signing, or online download.
- No authentication on the theme manager. Anyone on the Stratux Wi-Fi can use
  it, exactly as they can use `/updateUpload` today.
- No sandbox. Themes are not isolated from the full API (see Security).
- No per-client theme choice.

## What a theme is

- A folder of static files with `index.html` at its top level. Any build
  tooling the author likes; what lands on the Pi is plain HTML/CSS/JS/images.
- Talks to Stratux only through the existing REST and WebSocket endpoints.
- Served at `/` from the active theme's folder. Paths the backend already
  owns (API routes, WebSockets, `/mapdata/`, `/logs/`, `/tiles/`, the theme
  manager) are not shadowed by theme files; the contract doc lists them.
- Optional metadata file `theme.json` at the top level: `name`,
  `description`, `author`, `version`. All optional; the folder name is the
  theme's identity. *(Builder's call on exact fields; the user did not ask for
  metadata.)*

## Storage

- **Built-in themes:** inside the read-only image under `/opt/stratux`,
  installed by the `.deb`. They cannot be deleted from the manager and cannot
  be overwritten by uploads. Exact directory layout is the builder's call.
- **Installed themes:** `/boot/firmware/themes/<id>/` on the FAT32 boot
  partition — the only persistent writable place on the card (the root
  overlay is an in-memory tmpfs that is lost on reboot). The user accepted the
  small risk of writing to the boot partition in exchange for instant install
  and drag-and-drop install from a PC.
- **Theme id** (folder name): lowercase letters, digits, and dashes only
  (FAT32 is case-insensitive and restrictive). Folders in
  `/boot/firmware/themes/` that don't match, or lack `index.html`, are listed
  as invalid or ignored, never served.
- Uploading a theme whose id matches an installed theme **replaces** it (how
  a developer ships a new version). An upload whose id matches a built-in is
  rejected.

## Switching and fallback

- New setting in `globalSettings` holding the active theme id (empty = the
  default built-in). `handleSettingsSetRequest` needs an explicit `case` for
  it, like every other setting.
- `defaultServer` in `main/managementinterface.go` resolves the active
  theme's folder per request. If the folder is missing or has no
  `index.html` (e.g. deleted from a PC), it serves the default built-in.
- **Default built-in:** the redesigned UI (user's decision). It is also the
  fallback when the active theme is missing.
- After a switch, an iPad must show the new theme on its next load without
  the user clearing caches. Today the UI is served with `max-age=360` and an
  AppCache manifest (`web/stratux.appcache`), so the builder must design cache
  busting in (both the HTTP cache and AppCache).

## Theme manager / recovery page

- One page served by the backend at a fixed path (e.g. `/themes`), built so
  it does not depend on any theme's files. Its own HTML/CSS/JS live with the
  backend, not in a theme folder.
- Shows: each theme (built-in vs installed, metadata if present, which one is
  active), a switch action, delete for installed themes, and a zip upload.
- Shows a plain warning near upload: themes have full control of your
  Stratux; only install themes from people you trust.
- Both built-in UIs link to it from their Settings screen. Custom themes are
  encouraged (in the contract doc) to link to it too.
- Must work in the same browsers as the redesigned UI (old iPad Safari):
  no network fonts, no modern-only CSS/JS.
- Reachable even when a client has a stale cached theme.

## Security

The user accepted this posture: **themes are trusted software.** The API has
no auth and `/updateUpload` installs code that runs as root at next boot, so
a malicious theme already has full control; that cannot be fixed without a
sandbox, which is out of scope. Within that posture, the builder must:

1. **Harden zip extraction.** Reject entries whose cleaned path escapes the
   theme folder (`..`, absolute paths), reject symlinks and other non-regular
   files, cap total unpacked size and file count, and check free space on the
   boot partition first, so a crafted zip can neither overwrite
   `config.txt` / `cmdline.txt` / `stratux.conf` nor fill the partition.
   Unpack to a temp folder on the same partition and rename into place so a
   failed upload never leaves a half-written theme. Never unpack into
   `/boot/firmware/StratuxUpdates` (the boot script executes what lands there).
2. **Keep installed themes offline.** Serve files from installed themes with
   a Content-Security-Policy that allows loading from and connecting to the
   Stratux origin only (including its WebSockets), so a theme cannot pull
   remote scripts or send data out through an iPad's cellular connection.
   Built-in themes are exempt *(my call: the built-in map may use online
   tile sources)*. Inline scripts/styles and `eval` may be allowed so
   ordinary frameworks work; the point is origin restriction.
3. **Escape theme-supplied text** (`theme.json` fields, folder names) on the
   manager page.
4. **Validate the active-theme setting** against the id rules before using it
   to build a path.

## Developer starter kit

- `docs/themes.md`: the contract (folder layout, `index.html`, `theme.json`,
  zip layout, reserved paths, CSP limits, which API to use, linking to the
  manager). Indexed from `docs/README.md`. New endpoints go in
  `docs/http-api.md`; the new setting in `docs/settings-reference.md`.
- `dev/server.mjs` can serve a theme folder in place of `web/` with the same
  fixture API (e.g. a `--theme <dir>` flag), documented in `dev/README.md`.
- A minimal example theme (e.g. one page showing GPS position and traffic
  count) kept in the repo but **not** shipped in the image or `.deb`.

## Constraints

- Keep the image small (target: fits a 4 GB card). Shipping the classic UI
  adds roughly the size of `web/` (~6 MB).
- The Go build and `.deb` only build on Linux/Docker (`make ddpkg`); no Go
  unit tests exist.
- **Branch:** built on top of `ui-redesign`, in its own commits after the
  redesign's (user's decision). It goes upstream together with the redesign,
  not on its own. The classic UI is `web/` as it is on `upstream/master`
  before the redesign, and from then on is maintained in this repo alongside
  the redesigned UI.

## Left to the builder

- Where the classic UI's source lives in the repo and how both built-ins get
  installed by `web/Makefile` / the `.deb`.
- How the existing UI-only package (`dev/build-ui-deb.sh`, which replaces
  `/opt/stratux/www`) fits the new layout.
- Exact route names, endpoint shapes, size limits, and the manager page's
  look.
- Naming in the UI: the feature is "Themes"; the existing dark/light switch
  stays "Dark mode" *(my call, to avoid confusion with `toggleTheme()`)*.
